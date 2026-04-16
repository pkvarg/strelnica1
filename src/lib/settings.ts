import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export type SmsMode = "off" | "admin_only" | "members_only" | "all";
export type Audience = "admin" | "member";

const SINGLETON_ID = 1;

export async function getSmsMode(): Promise<SmsMode> {
  const [row] = await db
    .select({ smsMode: appSettings.smsMode })
    .from(appSettings)
    .where(eq(appSettings.id, SINGLETON_ID))
    .limit(1);

  return (row?.smsMode as SmsMode | undefined) ?? "all";
}

export async function setSmsMode(mode: SmsMode, updatedBy: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ id: SINGLETON_ID, smsMode: mode, updatedBy, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: { smsMode: mode, updatedBy, updatedAt: new Date() },
    });
}

export async function shouldSendSms(audience: Audience): Promise<boolean> {
  const mode = await getSmsMode();
  switch (mode) {
    case "off":
      return false;
    case "all":
      return true;
    case "admin_only":
      return audience === "admin";
    case "members_only":
      return audience === "member";
  }
}
