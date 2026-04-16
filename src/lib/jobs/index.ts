import { startPgBoss } from "@/lib/pgboss";
import { registerBookingExpiryHandler } from "./booking-expiry";
import { registerBookingReminderHandler } from "./booking-reminder";
import { registerNoShowHandler } from "./booking-noshow";
import { registerAutoCompleteHandler } from "./booking-autocomplete";
import { registerRetentionSweepHandler, scheduleRetentionSweep } from "./retention-sweep";

let registered = false;

export async function registerAllJobs() {
  if (registered) return;

  const boss = await startPgBoss();
  registerBookingExpiryHandler(boss);
  registerBookingReminderHandler(boss);
  registerNoShowHandler(boss);
  registerAutoCompleteHandler(boss);
  registerRetentionSweepHandler(boss);
  await scheduleRetentionSweep(boss);

  registered = true;
}
