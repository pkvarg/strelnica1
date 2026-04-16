"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { openingHoursTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function addOpeningHours(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { error: "Unauthorized" };
  }

  const rangeId = formData.get("rangeId") as string;
  const weekdays = formData.getAll("weekdays").map((v) => parseInt(v as string, 10));
  const startTime = formData.get("startTime") as string;
  const endTime = formData.get("endTime") as string;
  const validFrom = formData.get("validFrom") as string;
  const validTo = (formData.get("validTo") as string) || null;

  if (!rangeId || weekdays.length === 0 || !startTime || !endTime || !validFrom) {
    return { error: "All fields are required" };
  }

  if (weekdays.some((d) => isNaN(d) || d < 0 || d > 6)) {
    return { error: "Invalid weekday" };
  }

  await db.insert(openingHoursTemplates).values(
    weekdays.map((weekday) => ({
      rangeId,
      weekday,
      startTime,
      endTime,
      validFrom,
      validTo,
      createdBy: session.user.id,
    })),
  );

  revalidatePath("/admin/otvaracie-hodiny");
  return { success: true };
}

export async function deleteOpeningHours(id: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }

  await db
    .delete(openingHoursTemplates)
    .where(eq(openingHoursTemplates.id, id));

  revalidatePath("/admin/otvaracie-hodiny");
}
