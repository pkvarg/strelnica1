import { getTokenDetails } from "./actions";
import { DecideForm } from "./decide-form";

export default async function DecidePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const details = await getTokenDetails(token);

  if (!details) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-red-600">Neplatný odkaz</p>
      </div>
    );
  }

  if (details.used) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-zinc-600">Tento odkaz už bol použitý.</p>
      </div>
    );
  }

  if (details.expired) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-red-600">Tento odkaz expiroval.</p>
      </div>
    );
  }

  if (details.booking.status !== "requested") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-zinc-600">
          Rezervácia už bola {details.booking.status === "approved" ? "schválená" : "spracovaná"}.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-md space-y-6 p-6">
        <h1 className="text-2xl font-bold">
          {details.action === "approve" ? "Schváliť rezerváciu" : "Zamietnuť rezerváciu"}
        </h1>

        <div className="rounded-lg border p-4 text-sm">
          <dl className="space-y-1">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Člen</dt>
              <dd>{details.member.firstName} {details.member.lastName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">E-mail</dt>
              <dd>{details.member.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Strelnica</dt>
              <dd>{details.booking.rangeId}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Dátum</dt>
              <dd>{details.booking.startsAt.toLocaleDateString("sk-SK")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Čas</dt>
              <dd>
                {details.booking.startsAt.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}
                {" - "}
                {details.booking.endsAt.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">Hostia</dt>
              <dd>{details.booking.guestCount}</dd>
            </div>
            {details.booking.userNote && (
              <div className="flex justify-between">
                <dt className="text-zinc-500">Poznámka</dt>
                <dd>{details.booking.userNote}</dd>
              </div>
            )}
          </dl>
        </div>

        <DecideForm token={token} action={details.action} />
      </div>
    </div>
  );
}
