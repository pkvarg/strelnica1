import { startPgBoss } from "@/lib/pgboss";
import { registerBookingExpiryHandler } from "./booking-expiry";

let registered = false;

export async function registerAllJobs() {
  if (registered) return;

  const boss = await startPgBoss();
  registerBookingExpiryHandler(boss);

  registered = true;
}
