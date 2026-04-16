import { getTranslations } from "next-intl/server";

export default async function AdminDashboard() {
  const t = await getTranslations();

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("admin.title")}</h1>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold">{t("admin.pendingBookings")}</h2>
          <p className="mt-1 text-sm text-zinc-500">0</p>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="font-semibold">{t("admin.todaySchedule")}</h2>
          <p className="mt-1 text-sm text-zinc-500">0</p>
        </div>
      </div>
    </div>
  );
}
