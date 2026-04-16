import { db } from "@/db";
import { users, memberships, bookings } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { decrypt } from "@/lib/encryption";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { UserActions } from "./user-actions";
import { LicenseForm } from "./license-form";
import { LicenseVerifyButton } from "./license-verify-button";
import { EditUserForm } from "./edit-form";

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

  // Decrypt zbrojny preukaz number (server-only)
  const zpNumber = user.zbrojnyPreukazNumberEncrypted
    ? decrypt(user.zbrojnyPreukazNumberEncrypted)
    : null;

  // Check if license expires within 60 days
  const zpExpiresAt = user.zbrojnyPreukazExpiresAt;
  const zpExpiringSoon =
    zpExpiresAt != null &&
    new Date(zpExpiresAt).getTime() - Date.now() < 60 * 24 * 60 * 60 * 1000 &&
    new Date(zpExpiresAt).getTime() > Date.now();
  const zpExpired =
    zpExpiresAt != null && new Date(zpExpiresAt).getTime() <= Date.now();

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
            <dd>{fmtDateTime(user.createdAt)}</dd>
            <dt className="font-medium">Posledné prihlásenie</dt>
            <dd>{user.lastLoginAt ? fmtDateTime(user.lastLoginAt) : "—"}</dd>
          </dl>
        </div>

        <UserActions userId={user.id} status={user.status} />

        <EditUserForm
          userId={user.id}
          firstName={user.firstName}
          lastName={user.lastName}
          email={user.email}
          phone={user.phoneE164}
          birthDate={user.birthDate}
          birthPlace={user.birthPlace}
          addressStreet={user.addressStreet}
          addressCity={user.addressCity}
          addressZip={user.addressZip}
          addressCountry={user.addressCountry}
          locale={user.locale}
          role={user.role}
          notesAdmin={user.notesAdmin}
        />

        {/* Zbrojny preukaz — read-only overview */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-100">
                Zbrojný preukaz
              </h2>
              {user.zbrojnyPreukazVerifiedAt ? (
                <span className="rounded-full bg-emerald-900/40 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                  Overený {fmtDate(user.zbrojnyPreukazVerifiedAt)}
                </span>
              ) : user.zbrojnyPreukazCategory ? (
                <span className="rounded-full bg-amber-900/40 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                  Neoverený
                </span>
              ) : null}
            </div>
            {user.zbrojnyPreukazCategory && (
              <LicenseVerifyButton
                userId={user.id}
                isVerified={!!user.zbrojnyPreukazVerifiedAt}
              />
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="font-medium text-zinc-400">Kategoria</dt>
            <dd className="text-zinc-200">
              {user.zbrojnyPreukazCategory ?? "\u2014"}
            </dd>
            <dt className="font-medium text-zinc-400">Cislo preukazu</dt>
            <dd className="text-zinc-200">{zpNumber ?? "\u2014"}</dd>
            <dt className="font-medium text-zinc-400">Vydany dna</dt>
            <dd className="text-zinc-200">
              {user.zbrojnyPreukazIssuedAt ?? "\u2014"}
            </dd>
            <dt className="font-medium text-zinc-400">Platnost do</dt>
            <dd
              className={
                zpExpired
                  ? "font-semibold text-red-400"
                  : zpExpiringSoon
                    ? "font-semibold text-amber-400"
                    : "text-zinc-200"
              }
            >
              {user.zbrojnyPreukazExpiresAt ?? "\u2014"}
              {zpExpired && " (expirovany)"}
              {zpExpiringSoon && " (coskoro expiruje)"}
            </dd>
            <dt className="font-medium text-zinc-400">Vydavajuci organ</dt>
            <dd className="text-zinc-200">
              {user.zbrojnyPreukazIssuingAuthority ?? "\u2014"}
            </dd>
          </dl>
        </div>

        {/* Zbrojny preukaz — edit form */}
        <LicenseForm
          userId={user.id}
          number={zpNumber}
          category={user.zbrojnyPreukazCategory}
          issuedAt={user.zbrojnyPreukazIssuedAt}
          expiresAt={user.zbrojnyPreukazExpiresAt}
          authority={user.zbrojnyPreukazIssuingAuthority}
        />

        <div>
          <h2 className="text-lg font-semibold">Členstvo</h2>
          {userMemberships.length === 0 ? (
            <p className="mt-1 text-sm text-zinc-500">Žiadne členstvo</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {userMemberships.map((m) => (
                <li key={m.year}>
                  {m.year} — {m.feeAmount} {m.currency}{" "}
                  {m.paidAt ? `(zaplatené ${fmtDate(m.paidAt)})` : "(nezaplatené)"}
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
                  {b.rangeId} — {fmtDateTime(b.startsAt)} → {fmtDateTime(b.endsAt)} [{b.status}]
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
