"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface User {
  id: string;
  email: string;
  phoneE164: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  locale: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

const statusColors: Record<string, string> = {
  invited: "bg-yellow-100 text-yellow-800",
  pending_verification: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  suspended: "bg-red-100 text-red-800",
  anonymized: "bg-zinc-100 text-zinc-500",
};

export function UserTable({ users }: { users: User[] }) {
  const locale = useLocale();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Meno</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Telefón</TableHead>
          <TableHead>Rola</TableHead>
          <TableHead>Stav</TableHead>
          <TableHead>Vytvorený</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <Link
                href={`/${locale}/admin/pouzivatelia/${user.id}`}
                className="font-medium hover:underline"
              >
                {user.firstName} {user.lastName}
              </Link>
            </TableCell>
            <TableCell>{user.email}</TableCell>
            <TableCell>{user.phoneE164}</TableCell>
            <TableCell>{user.role}</TableCell>
            <TableCell>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[user.status] ?? ""}`}
              >
                {user.status}
              </span>
            </TableCell>
            <TableCell>
              {user.createdAt.toLocaleDateString(locale)}
            </TableCell>
          </TableRow>
        ))}
        {users.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-zinc-500">
              -
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
