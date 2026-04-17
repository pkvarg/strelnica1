import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { db } from "@/db";
import {
  bookings,
  auditLog,
  notificationsLog,
  botLog,
  contactMessages,
  adminApprovalTokens,
  verificationCodes,
  memberships,
  closures,
  openingHoursTemplates,
  users,
} from "@/db/schema";
import { sql, count, ne, desc, eq } from "drizzle-orm";
import { isDangerZoneUnlocked } from "./actions";
import { UnlockForm } from "./unlock-form";
import { DangerTable } from "./danger-table";
import { UsersRowsTable } from "./rows-users";
import { BookingsRowsTable } from "./rows-bookings";
import { AdminsRowsTable } from "./rows-admins";
import { fmtDateTime } from "@/lib/format";

async function getCounts() {
  const [
    [bookingsCount],
    [auditCount],
    [notifCount],
    [botCount],
    [contactCount],
    [tokenCount],
    [codeCount],
    [membershipCount],
    [closureCount],
    [openingCount],
    [nonAdminUsers],
    pgbossJobs,
  ] = await Promise.all([
    db.select({ c: count() }).from(bookings),
    db.select({ c: count() }).from(auditLog),
    db.select({ c: count() }).from(notificationsLog),
    db.select({ c: count() }).from(botLog),
    db.select({ c: count() }).from(contactMessages),
    db.select({ c: count() }).from(adminApprovalTokens),
    db.select({ c: count() }).from(verificationCodes),
    db.select({ c: count() }).from(memberships),
    db.select({ c: count() }).from(closures),
    db.select({ c: count() }).from(openingHoursTemplates),
    db.select({ c: count() }).from(users).where(ne(users.role, "admin")),
    db
      .execute(
        sql.raw(
          `SELECT COUNT(*)::int AS c FROM "${process.env.PGBOSS_SCHEMA || "pgboss"}"."job"`,
        ),
      )
      .catch(() => [{ c: 0 }] as Array<{ c: number }>),
  ]);

  return {
    bookings: bookingsCount.c,
    audit_log: auditCount.c,
    notifications_log: notifCount.c,
    bot_log: botCount.c,
    contact_messages: contactCount.c,
    admin_approval_tokens: tokenCount.c,
    verification_codes: codeCount.c,
    memberships: membershipCount.c,
    closures: closureCount.c,
    opening_hours_templates: openingCount.c,
    nonAdminUsers: nonAdminUsers.c,
    pgbossJobs: (pgbossJobs[0] as { c: number } | undefined)?.c ?? 0,
  };
}

export default async function DangerZonePage() {
  const session = await auth();
  const locale = await getLocale();

  if (!session?.user) redirect(`/${locale}/prihlasenie`);
  if (session.user.role !== "admin") redirect(`/${locale}/app`);

  const unlocked = await isDangerZoneUnlocked(session.user.id);

  if (!unlocked) {
    return (
      <div className="max-w-md">
        <h1 className="font-[family-name:var(--font-bebas)] text-3xl tracking-wide text-red-500">
          Danger Zone
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Na zobrazenie je potrebné heslo. Odomknutie platí 15 minút.
        </p>
        <UnlockForm />
      </div>
    );
  }

  const [counts, userRows, adminRows, bookingRows] = await Promise.all([
    getCounts(),
    db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phoneE164: users.phoneE164,
        role: users.role,
        status: users.status,
      })
      .from(users)
      .where(ne(users.role, "admin"))
      .orderBy(desc(users.createdAt))
      .limit(100),
    db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        status: users.status,
      })
      .from(users)
      .where(eq(users.role, "admin"))
      .orderBy(desc(users.createdAt)),
    db
      .select({
        id: bookings.id,
        rangeId: bookings.rangeId,
        startsAt: bookings.startsAt,
        status: bookings.status,
        userFirst: users.firstName,
        userLast: users.lastName,
        userEmail: users.email,
      })
      .from(bookings)
      .leftJoin(users, eq(bookings.userId, users.id))
      .orderBy(desc(bookings.startsAt))
      .limit(100),
  ]);

  const bookingsForTable = bookingRows.map((b) => ({
    id: b.id,
    rangeId: b.rangeId,
    startsAt: fmtDateTime(b.startsAt),
    status: b.status,
    userLabel: b.userFirst
      ? `${b.userFirst} ${b.userLast} · ${b.userEmail}`
      : "—",
  }));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-[family-name:var(--font-bebas)] text-3xl tracking-wide text-red-500">
          Danger Zone
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Trvalé vymazanie dát z produkčnej DB. Nereverzibilné. Používať iba na konci testovacieho obdobia.
        </p>
      </div>

      <DangerTable counts={counts} />

      <section>
        <h2 className="mb-3 font-semibold text-zinc-200">
          Admini{" "}
          <span className="text-zinc-500">· {adminRows.length}</span>
        </h2>
        <p className="mb-3 text-xs text-zinc-500">
          Dočasne suspenduj admina, ak potrebuješ testovať, aby notifikácie chodili len na jeden účet. Suspendovaný admin sa nevie prihlásiť. Seba zmeniť nemôžeš.
        </p>
        <AdminsRowsTable
          admins={adminRows.map((a) => ({
            ...a,
            isSelf: a.id === session.user.id,
          }))}
        />
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-zinc-200">
          Používatelia (neadmin){" "}
          <span className="text-zinc-500">· {counts.nonAdminUsers}</span>
        </h2>
        <p className="mb-3 text-xs text-zinc-500">
          Hard delete zmaže aj všetky rezervácie, notifikácie, členstvá a tokeny daného člena. Audit log zostane, referencia sa nastaví na NULL.
        </p>
        <UsersRowsTable users={userRows} />
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-zinc-200">
          Rezervácie{" "}
          <span className="text-zinc-500">· {counts.bookings} (zobrazených max 100)</span>
        </h2>
        <p className="mb-3 text-xs text-zinc-500">
          Hard delete zmaže rezerváciu a jej notifikačné záznamy. Schvaľovacie tokeny sa kaskádovo odstránia.
        </p>
        <BookingsRowsTable bookings={bookingsForTable} />
      </section>
    </div>
  );
}
