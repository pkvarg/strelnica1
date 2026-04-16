"use client";

import { useState } from "react";
import { approveBookingInline, declineBookingInline } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PendingBooking {
  id: string;
  rangeId: string;
  startsAt: Date;
  endsAt: Date;
  guestCount: number;
  userNote: string | null;
  requestedAt: Date;
  userName: string;
  userLastName: string;
  userEmail: string;
}

export function PendingQueue({ bookings }: { bookings: PendingBooking[] }) {
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  if (bookings.length === 0) {
    return <p className="text-sm text-zinc-500">Žiadne čakajúce žiadosti</p>;
  }

  return (
    <div className="space-y-3">
      {bookings.map((b) => (
        <div key={b.id} className="rounded-lg border p-4">
          <div className="flex items-start justify-between">
            <div className="text-sm">
              <p className="font-medium">
                {b.userName} {b.userLastName}
                <span className="ml-2 text-zinc-500">{b.userEmail}</span>
              </p>
              <p className="mt-1">
                <span className="font-medium">{b.rangeId}</span>
                {" — "}
                {b.startsAt.toLocaleDateString("sk-SK")}
                {" "}
                {b.startsAt.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}
                {" - "}
                {b.endsAt.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}
                {b.guestCount > 0 && ` (${b.guestCount} hostí)`}
              </p>
              {b.userNote && (
                <p className="mt-1 text-xs text-zinc-500">{b.userNote}</p>
              )}
              <p className="mt-1 text-xs text-zinc-400">
                Žiadosť: {b.requestedAt.toLocaleString("sk-SK")}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => approveBookingInline(b.id)}
              >
                Schváliť
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() =>
                  decliningId === b.id
                    ? undefined
                    : setDecliningId(b.id)
                }
              >
                Zamietnuť
              </Button>
            </div>
          </div>

          {decliningId === b.id && (
            <div className="mt-3 flex gap-2">
              <Input
                placeholder="Dôvod zamietnutia"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  declineBookingInline(b.id, reason);
                  setDecliningId(null);
                  setReason("");
                }}
              >
                Potvrdiť
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDecliningId(null);
                  setReason("");
                }}
              >
                Zrušiť
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
