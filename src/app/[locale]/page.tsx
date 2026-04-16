import { useTranslations } from "next-intl";

export default function HomePage() {
  const t = useTranslations();

  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">{t("landing.title")}</h1>
      <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
        {t("landing.subtitle")}
      </p>
    </div>
  );
}
