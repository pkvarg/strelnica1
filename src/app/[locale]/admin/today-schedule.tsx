"use client";

import { checkInBookingAdmin } from "./actions";
import { Button } from "@/components/ui/button";

interface TodayBooking {
  id: string;
  rangeId: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  userName: string;
  userLastName: string;
}

const statusColors: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  checked_in: "bg-blue-100 text-blue-800",
  completed: "bg-zinc-100 text-zinc-700",
  no_show: "bg-red-100 text-red-600",
  requested: "bg-yellow-100 text-yellow-800",
};

export function TodaySchedule({ bookings }: { bookings: TodayBooking[] }) {
  if (bookings.length === 0) {
    return <p className="text-sm text-zinc-500">-</p>;
  }

  return (
    <div className="space-y-2">
      {bookings.map((b) => (
        <div
          key={b.id}
          className="flex items-center gap-4 rounded-lg border p-3 text-sm"
        >
          <span className="font-medium">{b.rangeId}</span>
          <span>
            {b.startsAt.toLocaleTimeString("sk-SK", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {" - "}
            {b.endsAt.toLocaleTimeString("sk-SK", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span>
            {b.userName} {b.userLastName}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[b.status] ?? "bg-zinc-100"}`}
          >
            {b.status}
          </span>
          {b.status === "approved" && (
            <Button
              size="xs"
              onClick={() => checkInBookingAdmin(b.id)}
            >
              Check-in
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
