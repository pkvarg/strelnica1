"use server";

import { auth } from "@/lib/auth";
import { getSmsMode, setSmsMode, type SmsMode } from "@/lib/settings";
import { writeAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

const VALID_MODES: SmsMode[] = ["off", "admin_only", "members_only", "all"];

export async function updateSmsMode(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
) {
  const t = await getTranslations("admin.errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { error: t("unauthorized") };
  }

  const mode = formData.get("smsMode") as string;
  if (!VALID_MODES.includes(mode as SmsMode)) {
    return { error: t("invalidMode") };
  }

  const before = await getSmsMode();
  if (before === mode) {
    return { success: true };
  }

  await setSmsMode(mode as SmsMode, session.user.id);

  await writeAudit({
    actorUserId: session.user.id,
    action: "update_settings",
    entityType: "app_settings",
    entityId: "1",
    before: { smsMode: before },
    after: { smsMode: mode },
  });

  revalidatePath("/admin/nastavenia");
  return { success: true };
}
