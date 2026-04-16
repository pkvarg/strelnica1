import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AppNav } from "./nav";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getLatestConsentVersion } from "@/lib/consent";

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

  const [user] = await db
    .select({
      gdprConsentVersion: users.gdprConsentVersion,
      rangeRulesConsentVersion: users.rangeRulesConsentVersion,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (user) {
    const latestGdpr = await getLatestConsentVersion("gdpr");
    const latestRules = await getLatestConsentVersion("range_rules");

    if (
      (latestGdpr && user.gdprConsentVersion !== latestGdpr) ||
      (latestRules && user.rangeRulesConsentVersion !== latestRules)
    ) {
      redirect(`/${locale}/suhlas`);
    }
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
