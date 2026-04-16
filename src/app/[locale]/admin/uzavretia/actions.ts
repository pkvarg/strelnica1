"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { closures } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function addClosure(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { error: "Unauthorized" };
  }

  const rangeId = (formData.get("rangeId") as string) || null;
  const startsAt = formData.get("startsAt") as string;
  const endsAt = formData.get("endsAt") as string;
  const reasonSk = (formData.get("reasonSk") as string) || null;
  const reasonHu = (formData.get("reasonHu") as string) || null;

  if (!startsAt || !endsAt) {
    return { error: "Start and end are required" };
  }

  await db.insert(closures).values({
    rangeId,
    startsAt: new Date(startsAt),
    endsAt: new Date(endsAt),
    reasonSk,
    reasonHu,
    createdBy: session.user.id,
  });

  revalidatePath("/admin/uzavretia");
  return { success: true };
}

export async function deleteClosure(id: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  await db.delete(closures).where(eq(closures.id, id));
  revalidatePath("/admin/uzavretia");
}
