"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cancelBooking } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Booking {
  id: string;
  rangeId: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  guestCount: number;
  userNote: string | null;
}

interface Range {
  id: string;
  nameSk: string;
  nameHu: string;
}

const statusColors: Record<string, string> = {
  requested: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
  cancelled: "bg-zinc-100 text-zinc-500",
  checked_in: "bg-blue-100 text-blue-800",
  completed: "bg-zinc-100 text-zinc-700",
  no_show: "bg-red-100 text-red-600",
};

export function BookingsList({
  bookings,
  ranges,
}: {
  bookings: Booking[];
  ranges: Range[];
}) {
  const t = useTranslations("booking");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const rangeMap = Object.fromEntries(ranges.map((r) => [r.id, r.nameSk]));

  if (bookings.length === 0) {
    return <p className="text-sm text-zinc-500">{t("noBookings")}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("range")}</TableHead>
          <TableHead>{t("date")}</TableHead>
          <TableHead>{t("startTime")}</TableHead>
          <TableHead>{t("hours")}</TableHead>
          <TableHead>{t("guestCount")}</TableHead>
          <TableHead>Status</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map((b) => {
          const durationH = Math.round(
            (b.endsAt.getTime() - b.startsAt.getTime()) / 3600000,
          );
          const canCancel =
            ["requested", "approved"].includes(b.status) &&
            b.startsAt > new Date();

          return (
            <TableRow key={b.id}>
              <TableCell>{rangeMap[b.rangeId] ?? b.rangeId}</TableCell>
              <TableCell>{b.startsAt.toLocaleDateString()}</TableCell>
              <TableCell>
                {b.startsAt.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </TableCell>
              <TableCell>{durationH}h</TableCell>
              <TableCell>{b.guestCount}</TableCell>
              <TableCell>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[b.status] ?? ""}`}
                >
                  {t(`status.${b.status}` as "status.requested")}
                </span>
              </TableCell>
              <TableCell>
                {canCancel && cancellingId !== b.id && (
                  <Button
                    variant="destructive"
                    size="xs"
                    onClick={() => setCancellingId(b.id)}
                  >
                    {t("cancel")}
                  </Button>
                )}
                {cancellingId === b.id && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="destructive"
                      size="xs"
                      onClick={async () => {
                        await cancelBooking(b.id);
                        setCancellingId(null);
                      }}
                    >
                      {t("cancel")}
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setCancellingId(null)}
                    >
                      x
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
