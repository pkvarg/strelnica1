import { startPgBoss } from "@/lib/pgboss";
import { registerBookingExpiryHandler } from "./booking-expiry";
import { registerBookingReminderHandler } from "./booking-reminder";
import { registerNoShowHandler } from "./booking-noshow";
import { registerAutoCompleteHandler } from "./booking-autocomplete";
import { registerRetentionSweepHandler, scheduleRetentionSweep } from "./retention-sweep";
import { registerLicenseExpiryHandler, scheduleLicenseExpiry } from "./license-expiry";
import {
  registerMembershipRolloverHandler,
  registerMembershipReminderHandler,
  scheduleMembershipCrons,
} from "./membership";

let registered = false;

export async function registerAllJobs() {
  if (registered) return;

  const boss = await startPgBoss();
  registerBookingExpiryHandler(boss);
  registerBookingReminderHandler(boss);
  registerNoShowHandler(boss);
  registerAutoCompleteHandler(boss);
  registerRetentionSweepHandler(boss);
  registerLicenseExpiryHandler(boss);
  registerMembershipRolloverHandler(boss);
  registerMembershipReminderHandler(boss);

  await scheduleRetentionSweep(boss);
  await scheduleLicenseExpiry(boss);
  await scheduleMembershipCrons(boss);

  registered = true;
}
