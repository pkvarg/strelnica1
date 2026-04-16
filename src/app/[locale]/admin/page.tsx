import { db } from "@/db";
import { bookings, users } from "@/db/schema";
import { eq, asc, and, gte, lte } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { PendingQueue } from "./pending-queue";

export default async function AdminDashboard() {
  const t = await getTranslations();

  const pending = await db
    .select({
      id: bookings.id,
      rangeId: bookings.rangeId,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      guestCount: bookings.guestCount,
      userNote: bookings.userNote,
      requestedAt: bookings.requestedAt,
      userName: users.firstName,
      userLastName: users.lastName,
      userEmail: users.email,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.userId, users.id))
    .where(eq(bookings.status, "requested"))
    .orderBy(asc(bookings.requestedAt));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayBookings = await db
    .select({
      id: bookings.id,
      rangeId: bookings.rangeId,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      status: bookings.status,
      userName: users.firstName,
      userLastName: users.lastName,
    })
    .from(bookings)
    .innerJoin(users, eq(bookings.userId, users.id))
    .where(
      and(
        gte(bookings.startsAt, todayStart),
        lte(bookings.startsAt, todayEnd),
      ),
    )
    .orderBy(asc(bookings.startsAt));

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("admin.title")}</h1>

      <div className="mt-6">
        <h2 className="text-lg font-semibold">{t("admin.pendingBookings")} ({pending.length})</h2>
        <div className="mt-2">
          <PendingQueue bookings={pending} />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">{t("admin.todaySchedule")} ({todayBookings.length})</h2>
        {todayBookings.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">-</p>
        ) : (
          <div className="mt-2 space-y-2">
            {todayBookings.map((b) => (
              <div key={b.id} className="flex items-center gap-4 rounded-lg border p-3 text-sm">
                <span className="font-medium">{b.rangeId}</span>
                <span>
                  {b.startsAt.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}
                  {" - "}
                  {b.endsAt.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span>{b.userName} {b.userLastName}</span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs">{b.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
