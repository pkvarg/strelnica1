"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  truncateTableAction,
  clearPgBossAction,
  nukeEverythingAction,
  lockDangerZone,
} from "./actions";

interface Counts {
  bookings: number;
  audit_log: number;
  notifications_log: number;
  bot_log: number;
  contact_messages: number;
  admin_approval_tokens: number;
  verification_codes: number;
  memberships: number;
  closures: number;
  opening_hours_templates: number;
  nonAdminUsers: number;
  pgbossJobs: number;
}

interface Row {
  key: keyof Counts;
  label: string;
  note?: string;
}

const rows: Row[] = [
  { key: "bookings", label: "Rezervácie" },
  { key: "notifications_log", label: "Notifikačné logy" },
  { key: "audit_log", label: "Audit log", note: "Bude znovu založený po každej akcii" },
  { key: "bot_log", label: "Bot log" },
  { key: "contact_messages", label: "Kontakt správy" },
  { key: "admin_approval_tokens", label: "Schvaľovacie tokeny" },
  { key: "verification_codes", label: "OTP kódy" },
  { key: "memberships", label: "Členstvá" },
  { key: "closures", label: "Uzávierky" },
  { key: "opening_hours_templates", label: "Otváracie hodiny" },
];

const TABLE_KEY_TO_DB_NAME: Record<string, string> = {
  bookings: "bookings",
  audit_log: "audit_log",
  notifications_log: "notifications_log",
  bot_log: "bot_log",
  contact_messages: "contact_messages",
  admin_approval_tokens: "admin_approval_tokens",
  verification_codes: "verification_codes",
  memberships: "memberships",
  closures: "closures",
  opening_hours_templates: "opening_hours_templates",
};

export function DangerTable({ counts }: { counts: Counts }) {
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<string | null>(null);

  const totalRows =
    counts.bookings +
    counts.audit_log +
    counts.notifications_log +
    counts.bot_log +
    counts.contact_messages +
    counts.admin_approval_tokens +
    counts.verification_codes +
    counts.memberships +
    counts.closures +
    counts.opening_hours_templates +
    counts.nonAdminUsers +
    counts.pgbossJobs;

  function doTruncate(key: string) {
    if (confirm !== key) {
      setConfirm(key);
      return;
    }
    setConfirm(null);
    startTransition(async () => {
      await truncateTableAction(TABLE_KEY_TO_DB_NAME[key]);
    });
  }

  function doClearPgBoss() {
    if (confirm !== "pgboss") {
      setConfirm("pgboss");
      return;
    }
    setConfirm(null);
    startTransition(async () => {
      await clearPgBossAction();
    });
  }

  function doNuke() {
    if (confirm !== "nuke") {
      setConfirm("nuke");
      return;
    }
    setConfirm(null);
    startTransition(async () => {
      await nukeEverythingAction();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
        <p className="text-sm text-zinc-400">
          <span className="font-medium text-zinc-200">{totalRows}</span> záznamov
          celkovo · Odomknuté na 15 minút
        </p>
        <form action={lockDangerZone}>
          <Button type="submit" variant="outline" size="sm">
            Zamknúť
          </Button>
        </form>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tabuľka</TableHead>
            <TableHead className="text-right">Počet</TableHead>
            <TableHead className="w-40" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const c = counts[row.key];
            const isConfirm = confirm === row.key;
            return (
              <TableRow key={row.key}>
                <TableCell>
                  <div className="font-medium">{row.label}</div>
                  {row.note && (
                    <div className="text-xs text-zinc-500">{row.note}</div>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{c}</TableCell>
                <TableCell>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending || c === 0}
                    onClick={() => doTruncate(row.key)}
                    className={
                      isConfirm
                        ? "w-full bg-red-600 text-zinc-50 hover:bg-red-500"
                        : "w-full bg-zinc-800 text-zinc-200 hover:bg-red-900/40 hover:text-red-300"
                    }
                  >
                    {isConfirm ? "Potvrdiť vymazanie" : "Vymazať"}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}

          <TableRow>
            <TableCell>
              <div className="font-medium">pg-boss jobs & schedules</div>
              <div className="text-xs text-zinc-500">
                Zmaže všetky naplánované a bežiace jobs
              </div>
            </TableCell>
            <TableCell className="text-right font-mono text-sm">
              {counts.pgbossJobs}
            </TableCell>
            <TableCell>
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                onClick={doClearPgBoss}
                className={
                  confirm === "pgboss"
                    ? "w-full bg-red-600 text-zinc-50 hover:bg-red-500"
                    : "w-full bg-zinc-800 text-zinc-200 hover:bg-red-900/40 hover:text-red-300"
                }
              >
                {confirm === "pgboss" ? "Potvrdiť vymazanie" : "Vymazať"}
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4">
        <h2 className="font-semibold text-red-400">Vymazať všetko</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Vyprázdni všetky tabuľky vyššie <span className="font-medium text-zinc-200">+</span>{" "}
          zmaže <span className="font-medium text-zinc-200">{counts.nonAdminUsers}</span>{" "}
          neadmin používateľov. Admini a zdrojové dáta (strelnice, GDPR dokumenty) zostávajú.
        </p>
        <Button
          type="button"
          disabled={isPending}
          onClick={doNuke}
          className={
            confirm === "nuke"
              ? "mt-3 bg-red-600 text-zinc-50 hover:bg-red-500"
              : "mt-3 bg-red-900/40 text-red-300 hover:bg-red-900/60"
          }
        >
          {confirm === "nuke"
            ? "Potvrdiť vymazanie všetkého"
            : "Vymazať všetko"}
        </Button>
      </div>
    </div>
  );
}
