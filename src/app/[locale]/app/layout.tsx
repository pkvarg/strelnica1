import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AppNav } from "./nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const locale = await getLocale();

  if (!session?.user) {
    redirect(`/${locale}/prihlasenie`);
  }

  const t = await getTranslations("common");

  return (
    <div className="flex min-h-full">
      <AppNav
        user={session.user}
        labels={{
          dashboard: t("dashboard"),
          bookings: t("bookings"),
          profile: t("profile"),
          statistics: t("statistics"),
          logout: t("logout"),
        }}
        locale={locale}
      />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
