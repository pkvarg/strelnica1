"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  CalendarCheck,
  User,
  BarChart3,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

export function AppNav({ user, labels, locale }: AppNavProps) {
  const pathname = usePathname();

  const links: NavLink[] = [
    { href: `/${locale}/app`, label: labels.dashboard, icon: LayoutDashboard },
    { href: `/${locale}/app/rezervacie`, label: labels.bookings, icon: CalendarCheck },
    { href: `/${locale}/app/profil`, label: labels.profile, icon: User },
    { href: `/${locale}/app/statistiky`, label: labels.statistics, icon: BarChart3 },
  ];

  return (
    <nav className="flex h-screen sticky top-0 w-56 flex-col border-r border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-6 border-b border-zinc-800 pb-4">
        <p className="font-semibold text-zinc-100">{user.name}</p>
        <p className="text-xs text-zinc-500">{user.role === "admin" ? "Admin" : "Člen"}</p>
      </div>

      <div className="flex flex-1 flex-col gap-0.5">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-zinc-800 font-medium text-amber-500"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
              }`}
            >
              <Icon size={16} className={isActive ? "text-amber-500" : "text-zinc-500"} />
              {link.label}
            </Link>
          );
        })}
      </div>

      <div className="space-y-2 border-t border-zinc-800 pt-4">
        {user.role === "admin" && (
          <Link
            href={`/${locale}/admin`}
            className="flex w-full items-center gap-2 rounded-md bg-amber-600/10 px-3 py-2 text-sm font-medium text-amber-500 transition-colors hover:bg-amber-600/20"
          >
            <ShieldCheck size={14} />
            Administrácia
          </Link>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 border-zinc-700 text-zinc-400 hover:text-zinc-200"
          onClick={() => signOut({ callbackUrl: `/${locale}/prihlasenie` })}
        >
          <LogOut size={14} />
          {labels.logout}
        </Button>
      </div>
    </nav>
  );
}
