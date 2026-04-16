import { db } from "@/db";
import { users, memberships, bookings } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { UserActions } from "./user-actions";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("admin");

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) notFound();

  const userMemberships = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, id))
    .orderBy(desc(memberships.year));

  const userBookings = await db
    .select({
      id: bookings.id,
      rangeId: bookings.rangeId,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      status: bookings.status,
    })
    .from(bookings)
    .where(eq(bookings.userId, id))
    .orderBy(desc(bookings.startsAt))
    .limit(20);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">{t("userDetail")}</h1>

      <div className="mt-6 space-y-6">
        <div className="rounded-lg border p-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="font-medium">Meno</dt>
            <dd>{user.firstName} {user.lastName}</dd>
            <dt className="font-medium">E-mail</dt>
            <dd>{user.email}</dd>
            <dt className="font-medium">Telefón</dt>
            <dd>{user.phoneE164}</dd>
            <dt className="font-medium">Rola</dt>
            <dd>{user.role}</dd>
            <dt className="font-medium">Stav</dt>
            <dd>{user.status}</dd>
            <dt className="font-medium">Jazyk</dt>
            <dd>{user.locale}</dd>
            <dt className="font-medium">Vytvorený</dt>
            <dd>{user.createdAt.toLocaleString()}</dd>
            <dt className="font-medium">Posledné prihlásenie</dt>
            <dd>{user.lastLoginAt?.toLocaleString() ?? "-"}</dd>
          </dl>
        </div>

        <UserActions userId={user.id} status={user.status} />

        <div>
          <h2 className="text-lg font-semibold">Členstvo</h2>
          {userMemberships.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-500">Žiadne členstvo</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {userMemberships.map((m) => (
                <li key={m.year}>
                  {m.year} — {m.feeAmount} {m.currency}{" "}
                  {m.paidAt ? `(zaplatené ${m.paidAt.toLocaleDateString()})` : "(nezaplatené)"}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold">Posledné rezervácie</h2>
          {userBookings.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-500">Žiadne rezervácie</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {userBookings.map((b) => (
                <li key={b.id}>
                  {b.rangeId} — {b.startsAt.toLocaleString()} → {b.endsAt.toLocaleString()} [{b.status}]
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
