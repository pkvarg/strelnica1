import { getLocale } from "next-intl/server";
import { getLatestConsent } from "@/lib/consent";
import { marked } from "marked";

export default async function GdprPage() {
  const locale = (await getLocale()) as "sk" | "hu";
  const doc = await getLatestConsent("gdpr", locale);

  if (!doc) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold">
          {locale === "hu" ? "Adatvédelem" : "Ochrana osobných údajov"}
        </h1>
        <p className="mt-4 text-zinc-500">
          {locale === "hu" ? "A dokumentum még nem érhető el." : "Dokument ešte nie je dostupný."}
        </p>
      </div>
    );
  }

  const html = await marked(doc.contentMd);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold">
        {locale === "hu" ? "Adatvédelem" : "Ochrana osobných údajov"}
      </h1>
      <p className="mt-1 text-xs text-zinc-400">
        {locale === "hu" ? "Verzió" : "Verzia"}: {doc.version} — {doc.publishedAt.toLocaleDateString(locale === "hu" ? "hu-HU" : "sk-SK")}
      </p>
      <div
        className="prose mt-6 max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
