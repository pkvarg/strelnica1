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
    { href: `/${locale}/admin/kontakt-log`, label: "Kontakt log" },
    { href: `/${locale}/admin/suhlasy`, label: "Súhlasy" },
  ];

  const externalLinks = [
    { href: "https://umami-p00gs00gwcwo00s4k4c4kgg8.pictusweb.com/share/9XzhLLnYeCtWULx9", label: "Analytics" },
  ];

  return (
    <nav className="flex h-screen sticky top-0 w-56 flex-col border-r bg-zinc-50 p-4 dark:bg-zinc-900">
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
        <div className="mt-4 border-t border-zinc-800 pt-3">
          {externalLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {link.label}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-50">
                <path d="M3.5 1.5H10.5V8.5M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ))}
        </div>
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
