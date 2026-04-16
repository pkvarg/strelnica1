"use client";

import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

interface ContactLog {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  locale: string;
  ip: string | null;
  userAgent: string | null;
  referer: string | null;
  acceptLanguage: string | null;
  timeSpent: number | null;
  screenSize: string | null;
  platform: string | null;
  emailSent: boolean;
  createdAt: string;
  handledAt: string | null;
}

export function ContactLogManager() {
  const [logs, setLogs] = useState<ContactLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/contact-logs")
      .then((r) => r.json())
      .then((data) => {
        setLogs(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = logs.filter((log) => {
    const s = searchTerm.toLowerCase();
    return (
      log.name?.toLowerCase().includes(s) ||
      log.email?.toLowerCase().includes(s) ||
      log.phone?.toLowerCase().includes(s) ||
      log.message?.toLowerCase().includes(s) ||
      log.ip?.toLowerCase().includes(s)
    );
  });

  const formatTime = (ms: number | null) => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kontaktné správy ({logs.length})</h1>
      </div>

      <div className="mt-4">
        <Input
          placeholder="Hľadať podľa mena, emailu, IP..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Odosielateľ</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Čas vyplnenia</TableHead>
              <TableHead>Stav</TableHead>
              <TableHead>Dátum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((log) => {
              const isExpanded = expandedId === log.id;
              const suspiciousTime = log.timeSpent !== null && log.timeSpent < 5000;

              return (
                <React.Fragment key={log.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-zinc-800/30"
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{log.name}</p>
                        <p className="text-xs text-zinc-500">{log.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.ip ?? "-"}</TableCell>
                    <TableCell>
                      <span className={suspiciousTime ? "text-amber-400 font-medium" : ""}>
                        {formatTime(log.timeSpent)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {log.emailSent ? (
                        <span className="rounded-full bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-400 ring-1 ring-green-600/30">
                          Odoslaný
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-amber-600/30">
                          Zaznamenaný
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(log.createdAt).toLocaleString("sk-SK")}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow key={`${log.id}-detail`}>
                      <TableCell colSpan={5} className="bg-zinc-900/50">
                        <div className="grid grid-cols-2 gap-4 p-2 text-sm">
                          <div className="space-y-2">
                            <p><span className="text-zinc-500">Meno:</span> {log.name}</p>
                            <p><span className="text-zinc-500">Email:</span> {log.email}</p>
                            <p><span className="text-zinc-500">Telefón:</span> {log.phone ?? "-"}</p>
                            <div>
                              <span className="text-zinc-500">Správa:</span>
                              <p className="mt-1 whitespace-pre-wrap rounded bg-zinc-800/50 p-2 text-xs">
                                {log.message}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p><span className="text-zinc-500">IP:</span> <span className="font-mono text-xs">{log.ip ?? "-"}</span></p>
                            <div>
                              <span className="text-zinc-500">User Agent:</span>
                              <p className="mt-1 break-all rounded bg-zinc-800/50 p-2 font-mono text-xs">
                                {log.userAgent ?? "-"}
                              </p>
                            </div>
                            <p><span className="text-zinc-500">Accept-Language:</span> <span className="text-xs">{log.acceptLanguage ?? "-"}</span></p>
                            <p><span className="text-zinc-500">Referer:</span> <span className="text-xs">{log.referer ?? "-"}</span></p>
                            <p><span className="text-zinc-500">Obrazovka:</span> <span className="text-xs">{log.screenSize ?? "-"}</span> | <span className="text-zinc-500">Platforma:</span> <span className="text-xs">{log.platform ?? "-"}</span></p>
                            <p><span className="text-zinc-500">Jazyk:</span> {log.locale} | <span className="text-zinc-500">Čas:</span> {formatTime(log.timeSpent)}</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-zinc-500">
                  Žiadne správy
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
