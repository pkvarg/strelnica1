"use server";

import { auth } from "@/lib/auth";
import {
  isReminderSmsEnabled,
  setReminderSmsEnabled,
} from "@/lib/settings";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

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
