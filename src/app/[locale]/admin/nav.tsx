"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";

interface AdminNavProps {
  user: { name: string };
  labels: {
    dashboard: string;
    users: string;
    bookings: string;
    membership: string;
    openingHours: string;
    closures: string;
    statistics: string;
    audit: string;
    logout: string;
  };
  locale: string;
}

export function AdminNav({ user, labels, locale }: AdminNavProps) {
  const pathname = usePathname();

  const links = [
    { href: `/${locale}/admin`, label: labels.dashboard },
    { href: `/${locale}/admin/pouzivatelia`, label: labels.users },
    { href: `/${locale}/admin/rezervacie`, label: labels.bookings },
    { href: `/${locale}/admin/clenstvo`, label: labels.membership },
    { href: `/${locale}/admin/otvaracie-hodiny`, label: labels.openingHours },
    { href: `/${locale}/admin/uzavretia`, label: labels.closures },
    { href: `/${locale}/admin/statistiky`, label: labels.statistics },
    { href: `/${locale}/admin/audit`, label: labels.audit },
  ];

  return (
    <nav className="flex w-56 flex-col border-r bg-zinc-50 p-4 dark:bg-zinc-900">
      <div className="mb-6">
        <p className="font-semibold">{user.name}</p>
        <p className="text-xs font-medium text-red-600">Admin</p>
      </div>

      <div className="flex flex-1 flex-col gap-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-md px-3 py-2 text-sm transition-colors ${
              pathname === link.href
                ? "bg-zinc-200 font-medium dark:bg-zinc-800"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => signOut({ callbackUrl: `/${locale}/prihlasenie` })}
      >
        {labels.logout}
      </Button>
    </nav>
  );
}
