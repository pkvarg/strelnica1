"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Membership {
  userId: string;
  year: number;
  feeAmount: string;
  currency: string;
  paidAt: Date | null;
  paymentMethod: string | null;
  note: string | null;
  cancelledAt: Date | null;
  cancelledReason: string | null;
}

interface Row {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  membership: Membership | null;
}

export function MembershipTable({ rows, year }: { rows: Row[]; year: number }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Člen</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Stav účtu</TableHead>
          <TableHead>Suma</TableHead>
          <TableHead>Zaplatené</TableHead>
          <TableHead>Spôsob</TableHead>
          <TableHead>Poznámka</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const m = r.membership;
          const paid = m?.paidAt && !m.cancelledAt;
          const cancelled = !!m?.cancelledAt;

          return (
            <TableRow key={r.id}>
              <TableCell className="font-medium">
                {r.lastName} {r.firstName}
              </TableCell>
              <TableCell className="text-xs">{r.email}</TableCell>
              <TableCell>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  r.status === "active" ? "bg-green-100 text-green-800" :
                  r.status === "suspended" ? "bg-red-100 text-red-800" :
                  "bg-zinc-100 text-zinc-500"
                }`}>
                  {r.status}
                </span>
              </TableCell>
              <TableCell>
                {m ? `${m.feeAmount} ${m.currency}` : "-"}
              </TableCell>
              <TableCell>
                {cancelled ? (
                  <span className="text-xs text-red-600">Zrušené</span>
                ) : paid ? (
                  <span className="text-xs text-green-700">
                    {m.paidAt!.toLocaleDateString("sk-SK")}
                  </span>
                ) : (
                  <span className="text-xs text-amber-600">Nezaplatené</span>
                )}
              </TableCell>
              <TableCell className="text-xs">{m?.paymentMethod ?? "-"}</TableCell>
              <TableCell className="max-w-[150px] truncate text-xs text-zinc-500">
                {m?.note ?? "-"}
              </TableCell>
            </TableRow>
          );
        })}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-zinc-500">-</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
