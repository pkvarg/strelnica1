"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateToken, hashToken } from "@/lib/tokens";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

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
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { error: "Unauthorized" };
  }

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const phone = (formData.get("phone") as string)?.trim();
  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const locale = (formData.get("locale") as string) || "sk";

  if (!email || !phone || !firstName || !lastName) {
    return { error: "All fields are required" };
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    return { error: "User with this email already exists" };
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

  // TODO M4: send invitation email via hono_bun

  revalidatePath("/admin/pouzivatelia");

  return { success: true, invitationUrl };
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
      firstName: "Anonymizovaný",
      lastName: "Používateľ",
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
