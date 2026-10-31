import type { Metadata } from "next";
import { GuidePage } from "@/components/guide/guide-page";
import { getGuide } from "@/lib/content/guide";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return pageMetadata(locale, "/rules", dict.seo.rules);
}

export default async function RulesPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const t = getGuide(locale).rules;
  return (
    <GuidePage locale={locale} path="/rules" title={t.title} intro={t.intro} cta={t.cta} startLabel={dict.nav.start}>
      {t.sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-3">
          <h2 className="font-display text-2xl font-bold">{section.title}</h2>
          {section.paragraphs.map((p, i) => (
            <p key={i} className="leading-relaxed text-pretty">
              {p}
            </p>
          ))}
          {section.list && (
            <ol className="flex list-decimal flex-col gap-2 pl-6 leading-relaxed marker:text-moon">
              {section.list.map((item) => (
                <li key={item} className="text-pretty">
                  {item}
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </GuidePage>
  );
}
