import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

const SINGLETON_ID = 1;

/**
 * The only lifecycle SMS that can fire at all. When false, the booking
 * reminder is email-only. Phone-change OTP SMS is independent of this flag.
 */
export async function isReminderSmsEnabled(): Promise<boolean> {
  const [row] = await db
    .select({ reminderSmsEnabled: appSettings.reminderSmsEnabled })
    .from(appSettings)
    .where(eq(appSettings.id, SINGLETON_ID))
    .limit(1);

  return row?.reminderSmsEnabled ?? true;
}

export async function setReminderSmsEnabled(
  enabled: boolean,
  updatedBy: string,
): Promise<void> {
  await db
    .insert(appSettings)
    .values({
      id: SINGLETON_ID,
      reminderSmsEnabled: enabled,
      updatedBy,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: { reminderSmsEnabled: enabled, updatedBy, updatedAt: new Date() },
    });
}
