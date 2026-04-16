"use client";

import { useTranslations } from "next-intl";
import { deleteClosure } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Closure {
  id: string;
  rangeId: string | null;
  startsAt: Date;
  endsAt: Date;
  reasonSk: string | null;
  reasonHu: string | null;
}

interface Range {
  id: string;
  nameSk: string;
}

export function ClosureTable({
  closures,
  ranges,
}: {
  closures: Closure[];
  ranges: Range[];
}) {
  const t = useTranslations("closures");
  const rangeMap = Object.fromEntries(ranges.map((r) => [r.id, r.nameSk]));

  if (closures.length === 0) {
    return <p className="text-sm text-zinc-500">-</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("range")}</TableHead>
          <TableHead>{t("startsAt")}</TableHead>
          <TableHead>{t("endsAt")}</TableHead>
          <TableHead>{t("reasonSk")}</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {closures.map((c) => (
          <TableRow key={c.id}>
            <TableCell>
              {c.rangeId ? rangeMap[c.rangeId] ?? c.rangeId : t("allRanges")}
            </TableCell>
            <TableCell>{c.startsAt.toLocaleString()}</TableCell>
            <TableCell>{c.endsAt.toLocaleString()}</TableCell>
            <TableCell>{c.reasonSk ?? "-"}</TableCell>
            <TableCell>
              <Button
                variant="destructive"
                size="xs"
                onClick={() => deleteClosure(c.id)}
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
