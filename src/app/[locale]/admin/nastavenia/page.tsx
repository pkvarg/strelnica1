import { getTranslations } from "next-intl/server";
import { isReminderSmsEnabled } from "@/lib/settings";
import { ReminderSmsForm } from "./reminder-sms-form";
import { BookingRecipientsForm } from "./booking-recipients-form";
import { Settings } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";

export default async function AdminSettingsPage() {
  const enabled = await isReminderSmsEnabled();
  const t = await getTranslations("settings");

  const adminRows = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      receivesBookingRequests: users.receivesBookingRequests,
    })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.status, "active")))
    .orderBy(asc(users.lastName), asc(users.firstName));

  const admins = adminRows.map((a) => ({
    id: a.id,
    name: `${a.firstName} ${a.lastName}`.trim() || a.email,
    email: a.email,
    receivesBookingRequests: a.receivesBookingRequests,
  }));

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2">
        <Settings size={22} className="text-amber-500" />
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-100">
          {t("reminderSmsTitle")}
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          {t("reminderSmsDescription")}
        </p>

        <div className="mt-4">
          <ReminderSmsForm current={enabled} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-zinc-100">
          {t("bookingRecipientsTitle")}
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          {t("bookingRecipientsDescription")}
        </p>

        <div className="mt-4">
          <BookingRecipientsForm admins={admins} />
        </div>
      </section>
    </div>
  );
}
