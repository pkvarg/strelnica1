"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";

interface AppNavProps {
  user: { name: string; role: string };
  labels: {
    dashboard: string;
    bookings: string;
    profile: string;
    statistics: string;
    logout: string;
  };
  locale: string;
}

export function AppNav({ user, labels, locale }: AppNavProps) {
  const pathname = usePathname();

  const links = [
    { href: `/${locale}/app`, label: labels.dashboard },
    { href: `/${locale}/app/rezervacie`, label: labels.bookings },
    { href: `/${locale}/app/profil`, label: labels.profile },
    { href: `/${locale}/app/statistiky`, label: labels.statistics },
  ];

  return (
    <nav className="flex w-56 flex-col border-r bg-zinc-50 p-4 dark:bg-zinc-900">
      <div className="mb-6">
        <p className="font-semibold">{user.name}</p>
        <p className="text-xs text-zinc-500">{user.role}</p>
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
