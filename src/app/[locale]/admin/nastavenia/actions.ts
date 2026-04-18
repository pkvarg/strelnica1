"use server";

import { auth } from "@/lib/auth";
import {
  isReminderSmsEnabled,
  setReminderSmsEnabled,
} from "@/lib/settings";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export async function updateReminderSmsEnabled(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  const t = await getTranslations("admin.errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { error: t("unauthorized") };
  }

  const next = formData.get("reminderSmsEnabled") === "1";
  const before = await isReminderSmsEnabled();

  if (before === next) {
    return { success: true };
  }

  await setReminderSmsEnabled(next, session.user.id);

  await writeAudit({
    actorUserId: session.user.id,
    action: "update_settings",
    entityType: "app_settings",
    entityId: "1",
    before: { reminderSmsEnabled: before },
    after: { reminderSmsEnabled: next },
  });

  revalidatePath("/admin/nastavenia");
  return { success: true };
}

export async function updateBookingRecipients(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  const t = await getTranslations("admin.errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { error: t("unauthorized") };
  }

  const selected = formData.getAll("adminId").map(String);

  const admins = await db
    .select({
      id: users.id,
      receivesBookingRequests: users.receivesBookingRequests,
    })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.status, "active")));

  const selectedSet = new Set(selected);
  const toEnable = admins
    .filter((a) => selectedSet.has(a.id) && !a.receivesBookingRequests)
    .map((a) => a.id);
  const toDisable = admins
    .filter((a) => !selectedSet.has(a.id) && a.receivesBookingRequests)
    .map((a) => a.id);

  if (toEnable.length > 0) {
    await db
      .update(users)
      .set({ receivesBookingRequests: true })
      .where(inArray(users.id, toEnable));
  }
  if (toDisable.length > 0) {
    await db
      .update(users)
      .set({ receivesBookingRequests: false })
      .where(inArray(users.id, toDisable));
  }

  if (toEnable.length > 0 || toDisable.length > 0) {
    await writeAudit({
      actorUserId: session.user.id,
      action: "update_booking_recipients",
      entityType: "app_settings",
      entityId: "booking_recipients",
      before: {
        enabled: admins
          .filter((a) => a.receivesBookingRequests)
          .map((a) => a.id),
      },
      after: { enabled: selected },
    });
  }

  revalidatePath("/admin/nastavenia");
  return { success: true };
}
