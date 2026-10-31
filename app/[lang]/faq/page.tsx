import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { GuidePage } from "@/components/guide/guide-page";
import { getGuide } from "@/lib/content/guide";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { JsonLd, pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return pageMetadata(locale, "/faq", dict.seo.faq);
}

export default async function FaqPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const t = getGuide(locale).faq;
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: t.items.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  return (
    <GuidePage locale={locale} path="/faq" title={t.title} intro={t.intro} cta={getGuide(locale).rules.cta} startLabel={dict.nav.start}>
      <JsonLd data={faq} />
      <div className="flex flex-col gap-3">
        {t.items.map(({ q, a }) => (
          // Answers stay in the page (and in search results) even while folded.
          <details key={q} className="card group p-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold [&::-webkit-details-marker]:hidden">
              <h2 className="text-lg">{q}</h2>
              <ChevronDown aria-hidden className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <p className="px-5 pb-5 leading-relaxed text-pretty text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>
    </GuidePage>
  );
}
