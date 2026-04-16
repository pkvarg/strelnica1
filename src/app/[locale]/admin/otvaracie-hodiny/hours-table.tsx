"use client";

import { useTranslations } from "next-intl";
import { deleteOpeningHours } from "./actions";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface HoursRow {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  validFrom: string;
  validTo: string | null;
}

export function HoursTable({ hours }: { hours: HoursRow[] }) {
  const t = useTranslations("openingHours");
  const days: string[] = t.raw("days");

  if (hours.length === 0) {
    return <p className="mt-2 text-sm text-zinc-500">-</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("weekday")}</TableHead>
          <TableHead>{t("startTime")}</TableHead>
          <TableHead>{t("endTime")}</TableHead>
          <TableHead>{t("validFrom")}</TableHead>
          <TableHead>{t("validTo")}</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {hours.map((h) => (
          <TableRow key={h.id}>
            <TableCell>{days[h.weekday]}</TableCell>
            <TableCell>{h.startTime}</TableCell>
            <TableCell>{h.endTime}</TableCell>
            <TableCell>{fmtDate(h.validFrom)}</TableCell>
            <TableCell>{h.validTo ? fmtDate(h.validTo) : "—"}</TableCell>
            <TableCell>
              <Button
                variant="destructive"
                size="xs"
                onClick={() => deleteOpeningHours(h.id)}
              >
                {t("delete")}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
