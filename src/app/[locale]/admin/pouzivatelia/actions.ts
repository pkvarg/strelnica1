"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateToken, hashToken } from "@/lib/tokens";
import { encrypt } from "@/lib/encryption";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { notifyInvitation } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";
import { getTranslations } from "next-intl/server";

const INVITATION_TTL_MS = 72 * 60 * 60 * 1000;

interface InviteResult {
  error?: string;
  success?: boolean;
  invitationUrl?: string;
}

export async function inviteMember(
  _prev: InviteResult | null,
  formData: FormData,
): Promise<InviteResult> {
  const t = await getTranslations("admin.errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { error: t("unauthorized") };
  }

  const { allowed } = rateLimit(`invite:${session.user.id}`, 10, 15 * 60 * 1000);
  if (!allowed) return { error: t("tooManyInvitations") };

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const phone = (formData.get("phone") as string)?.trim();
  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const locale = (formData.get("locale") as string) || "sk";

  if (!email || !phone || !firstName || !lastName) {
    return { error: t("allFieldsRequired") };
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    return { error: t("userWithEmailExists") };
  }

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      phoneE164: phone,
      firstName,
      lastName,
      locale: locale as "sk" | "hu",
      status: "invited",
      role: "member",
      invitedBy: session.user.id,
      invitationTokenHash: tokenHash,
      invitationExpiresAt: expiresAt,
    })
    .returning({ id: users.id });

  await writeAudit({
    actorUserId: session.user.id,
    action: "invite",
    entityType: "user",
    entityId: newUser.id,
    after: { email, phone, firstName, lastName, locale },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const invitationUrl = `${appUrl}/${locale}/pozvanka/${token}`;

  notifyInvitation({
    email,
    firstName,
    invitationUrl,
    locale,
    userId: newUser.id,
  }).catch(console.error);

  revalidatePath("/admin/pouzivatelia");

  return { success: true, invitationUrl };
}

interface EditResult {
  error?: string;
  success?: boolean;
}

export async function updateUserAdmin(
  userId: string,
  _prev: EditResult | null,
  formData: FormData,
): Promise<EditResult> {
  const t = await getTranslations("admin.errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { error: t("unauthorized") };
  }

  const { allowed } = rateLimit(`admin-edit-user:${session.user.id}`, 30, 15 * 60 * 1000);
  if (!allowed) return { error: t("tooManyRequests") };

  const [before] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!before) return { error: t("userNotFound") };

  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const phone = (formData.get("phone") as string)?.trim();
  const birthDate = (formData.get("birthDate") as string)?.trim() || null;
  const birthPlace = (formData.get("birthPlace") as string)?.trim() || null;
  const addressStreet = (formData.get("addressStreet") as string)?.trim() || null;
  const addressCity = (formData.get("addressCity") as string)?.trim() || null;
  const addressZip = (formData.get("addressZip") as string)?.trim() || null;
  const addressCountry = (formData.get("addressCountry") as string)?.trim() || null;
  const locale = (formData.get("locale") as string) === "hu" ? "hu" : "sk";
  const role = (formData.get("role") as string) === "admin" ? "admin" : "member";
  const notesAdmin = (formData.get("notesAdmin") as string)?.trim() || null;

  if (!firstName || !lastName || !email || !phone) {
    return { error: t("nameEmailPhoneRequired") };
  }

  // Prevent email / phone collisions with other users
  if (email !== before.email) {
    const [collision] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (collision && collision.id !== userId) {
      return { error: t("emailInUse") };
    }
  }
  if (phone !== before.phoneE164) {
    const [collision] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phoneE164, phone))
      .limit(1);
    if (collision && collision.id !== userId) {
      return { error: t("phoneInUse") };
    }
  }

  // Admin demoting themselves from admin would lock everyone out; guard.
  if (before.id === session.user.id && role !== "admin") {
    return { error: t("cannotRemoveSelfAdmin") };
  }

  await db
    .update(users)
    .set({
      firstName,
      lastName,
      email,
      phoneE164: phone,
      birthDate,
      birthPlace,
      addressStreet,
      addressCity,
      addressZip,
      addressCountry,
      locale,
      role,
      notesAdmin,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  await writeAudit({
    actorUserId: session.user.id,
    action: "admin_edit_user",
    entityType: "user",
    entityId: userId,
    before: {
      firstName: before.firstName,
      lastName: before.lastName,
      email: before.email,
      phoneE164: before.phoneE164,
      role: before.role,
      locale: before.locale,
    },
    after: {
      firstName,
      lastName,
      email,
      phoneE164: phone,
      role,
      locale,
    },
  });

  revalidatePath(`/admin/pouzivatelia/${userId}`);
  revalidatePath("/admin/pouzivatelia");
  return { success: true };
}

export async function setUserStatus(
  userId: string,
  status: "active" | "suspended",
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  const [before] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!before) throw new Error("User not found");

  await db
    .update(users)
    .set({ status, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await writeAudit({
    actorUserId: session.user.id,
    action: "status_change",
    entityType: "user",
    entityId: userId,
    before: { status: before.status },
    after: { status },
  });

  revalidatePath("/admin/pouzivatelia");
}

export async function anonymizeUser(userId: string) {
  const t = await getTranslations("admin.anonymized");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  const [before] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!before) throw new Error("User not found");

  await db
    .update(users)
    .set({
      email: `anonymized-${userId}@deleted.local`,
      phoneE164: `+000${userId.slice(0, 10)}`,
      firstName: t("firstName"),
      lastName: t("lastName"),
      birthDate: null,
      birthPlace: null,
      addressStreet: null,
      addressCity: null,
      addressZip: null,
      zbrojnyPreukazNumberEncrypted: null,
      zbrojnyPreukazCategory: null,
      zbrojnyPreukazIssuedAt: null,
      zbrojnyPreukazExpiresAt: null,
      zbrojnyPreukazIssuingAuthority: null,
      passwordHash: null,
      totpSecretEncrypted: null,
      totpEnabledAt: null,
      notesAdmin: null,
      status: "anonymized",
      anonymizedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  await writeAudit({
    actorUserId: session.user.id,
    action: "anonymize",
    entityType: "user",
    entityId: userId,
    before: {
      email: before.email,
      firstName: before.firstName,
      lastName: before.lastName,
      status: before.status,
    },
    after: { status: "anonymized" },
  });

  revalidatePath("/admin/pouzivatelia");
}

// --- Zbrojny preukaz (firearms license) ---

const VALID_CATEGORIES = ["A", "B", "C", "D", "E", "F"] as const;
type ZPCategory = (typeof VALID_CATEGORIES)[number];

export interface LicenseResult {
  error?: string;
  success?: boolean;
}

export async function updateUserLicense(
  _prev: LicenseResult | null,
  formData: FormData,
): Promise<LicenseResult> {
  const t = await getTranslations("admin.errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { error: t("unauthorized") };
  }

  const userId = formData.get("userId") as string;
  if (!userId) return { error: t("missingUserId") };

  const number = (formData.get("number") as string)?.trim() || null;
  const categoryRaw = (formData.get("category") as string)?.trim() || null;
  const issuedAtRaw = (formData.get("issuedAt") as string)?.trim() || null;
  const expiresAtRaw = (formData.get("expiresAt") as string)?.trim() || null;
  const authority = (formData.get("authority") as string)?.trim() || null;

  // Validate category
  const category =
    categoryRaw && VALID_CATEGORIES.includes(categoryRaw as ZPCategory)
      ? (categoryRaw as ZPCategory)
      : null;

  if (categoryRaw && !category) {
    return { error: t("invalidCategory") };
  }

  // Validate dates (basic ISO date check)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (issuedAtRaw && !dateRegex.test(issuedAtRaw)) {
    return { error: t("invalidIssuedAtFormat") };
  }
  if (expiresAtRaw && !dateRegex.test(expiresAtRaw)) {
    return { error: t("invalidExpiresAtFormat") };
  }

  // Fetch current record for audit diff
  const [before] = await db
    .select({
      zbrojnyPreukazNumberEncrypted: users.zbrojnyPreukazNumberEncrypted,
      zbrojnyPreukazCategory: users.zbrojnyPreukazCategory,
      zbrojnyPreukazIssuedAt: users.zbrojnyPreukazIssuedAt,
      zbrojnyPreukazExpiresAt: users.zbrojnyPreukazExpiresAt,
      zbrojnyPreukazIssuingAuthority: users.zbrojnyPreukazIssuingAuthority,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!before) return { error: t("userNotFound") };

  // Encrypt the license number if provided
  const encryptedNumber = number ? encrypt(number) : null;

  await db
    .update(users)
    .set({
      zbrojnyPreukazNumberEncrypted: encryptedNumber,
      zbrojnyPreukazCategory: category,
      zbrojnyPreukazIssuedAt: issuedAtRaw,
      zbrojnyPreukazExpiresAt: expiresAtRaw,
      zbrojnyPreukazIssuingAuthority: authority,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // Audit log -- do NOT log the actual license number
  const numberChanged =
    (before.zbrojnyPreukazNumberEncrypted == null) !== (encryptedNumber == null) ||
    (before.zbrojnyPreukazNumberEncrypted != null && encryptedNumber != null &&
      before.zbrojnyPreukazNumberEncrypted !== encryptedNumber);

  await writeAudit({
    actorUserId: session.user.id,
    action: "license_update",
    entityType: "user",
    entityId: userId,
    before: {
      numberSet: before.zbrojnyPreukazNumberEncrypted != null,
      category: before.zbrojnyPreukazCategory,
      issuedAt: before.zbrojnyPreukazIssuedAt,
      expiresAt: before.zbrojnyPreukazExpiresAt,
      authority: before.zbrojnyPreukazIssuingAuthority,
    },
    after: {
      numberChanged,
      numberSet: encryptedNumber != null,
      category,
      issuedAt: issuedAtRaw,
      expiresAt: expiresAtRaw,
      authority,
    },
  });

  revalidatePath(`/admin/pouzivatelia/${userId}`);
  revalidatePath("/admin/pouzivatelia");

  return { success: true };
}

export async function verifyUserLicense(userId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  await db
    .update(users)
    .set({
      zbrojnyPreukazVerifiedAt: new Date(),
      zbrojnyPreukazVerifiedBy: session.user.id,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  await writeAudit({
    actorUserId: session.user.id,
    action: "license_verify",
    entityType: "user",
    entityId: userId,
  });

  revalidatePath(`/admin/pouzivatelia/${userId}`);
}

export async function unverifyUserLicense(userId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  await db
    .update(users)
    .set({
      zbrojnyPreukazVerifiedAt: null,
      zbrojnyPreukazVerifiedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  await writeAudit({
    actorUserId: session.user.id,
    action: "license_unverify",
    entityType: "user",
    entityId: userId,
  });

  revalidatePath(`/admin/pouzivatelia/${userId}`);
}
