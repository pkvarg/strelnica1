import { getTranslations } from "next-intl/server";
import { getSmsMode } from "@/lib/settings";
import { SmsModeForm } from "./sms-mode-form";
import { Settings } from "lucide-react";

export default async function AdminSettingsPage() {
  const smsMode = await getSmsMode();
  const t = await getTranslations("settings");

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2">
        <Settings size={22} className="text-amber-500" />
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-100">{t("smsTitle")}</h2>
        <p className="mt-1 text-sm text-zinc-400">
          {t("smsDescription")}
        </p>

        <div className="mt-4">
          <SmsModeForm current={smsMode} />
        </div>
      </section>
    </div>
  );
}
