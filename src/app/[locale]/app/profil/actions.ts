"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { encrypt } from "@/lib/encryption";
import { revalidatePath } from "next/cache";
import { rateLimit } from "@/lib/rate-limit";

export async function updateProfile(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const { allowed } = rateLimit(`profile:${session.user.id}`, 15, 60 * 60 * 1000);
  if (!allowed) return { error: "Too many requests" };

  const [before] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!before) return { error: "User not found" };

  const patch = {
    firstName: (formData.get("firstName") as string)?.trim() || before.firstName,
    lastName: (formData.get("lastName") as string)?.trim() || before.lastName,
    birthDate: (formData.get("birthDate") as string) || before.birthDate,
    birthPlace: (formData.get("birthPlace") as string)?.trim() || before.birthPlace,
    addressStreet: (formData.get("addressStreet") as string)?.trim() || before.addressStreet,
    addressCity: (formData.get("addressCity") as string)?.trim() || before.addressCity,
    addressZip: (formData.get("addressZip") as string)?.trim() || before.addressZip,
    addressCountry: (formData.get("addressCountry") as string)?.trim() || before.addressCountry,
    updatedAt: new Date(),
  };

  // License fields — member can edit, but editing resets verification
  const zpNumber = (formData.get("zpNumber") as string)?.trim() || null;
  const zpCategory = (formData.get("zpCategory") as string)?.trim() || null;
  const zpIssuedAt = (formData.get("zpIssuedAt") as string)?.trim() || null;
  const zpExpiresAt = (formData.get("zpExpiresAt") as string)?.trim() || null;
  const zpAuthority = (formData.get("zpAuthority") as string)?.trim() || null;

  const licenseChanged =
    zpNumber !== null || zpCategory !== null || zpIssuedAt !== null ||
    zpExpiresAt !== null || zpAuthority !== null;

  const licensePatch = licenseChanged
    ? {
        zbrojnyPreukazNumberEncrypted: zpNumber ? encrypt(zpNumber) : before.zbrojnyPreukazNumberEncrypted,
        zbrojnyPreukazCategory: zpCategory || before.zbrojnyPreukazCategory,
        zbrojnyPreukazIssuedAt: zpIssuedAt || before.zbrojnyPreukazIssuedAt,
        zbrojnyPreukazExpiresAt: zpExpiresAt || before.zbrojnyPreukazExpiresAt,
        zbrojnyPreukazIssuingAuthority: zpAuthority || before.zbrojnyPreukazIssuingAuthority,
        // Reset verification when member edits license data
        zbrojnyPreukazVerifiedAt: null as Date | null,
        zbrojnyPreukazVerifiedBy: null as string | null,
      }
    : {};

  await db
    .update(users)
    .set({ ...patch, ...licensePatch })
    .where(eq(users.id, session.user.id));

  await writeAudit({
    actorUserId: session.user.id,
    action: "update_profile",
    entityType: "user",
    entityId: session.user.id,
    before: {
      firstName: before.firstName,
      lastName: before.lastName,
    },
    after: {
      firstName: patch.firstName,
      lastName: patch.lastName,
      licenseEdited: licenseChanged,
    },
  });

  revalidatePath("/app/profil");
  return { success: true };
}
