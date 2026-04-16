"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function updateProfile(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

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

  await db.update(users).set(patch).where(eq(users.id, session.user.id));

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
    },
  });

  revalidatePath("/app/profil");
  return { success: true };
}
