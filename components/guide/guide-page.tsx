import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import { getGuide } from "@/lib/content/guide";
import { JsonLd, SITE_URL } from "@/lib/seo";

/**
 * The frame of a public reading page (rules, roles, FAQ): breadcrumb, title,
 * intro, the page's content, a way to start a game and the fan-made notice.
 */
export function GuidePage({
  locale,
  path,
  title,
  intro,
  cta,
  startLabel,
  children,
}: {
  locale: Locale;
  path: string;
  title: string;
  intro: string;
  cta: string;
  startLabel: string;
  children: React.ReactNode;
}) {
  const guide = getGuide(locale);
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: guide.breadcrumbHome, item: `${SITE_URL}/${locale}` },
      { "@type": "ListItem", position: 2, name: title, item: `${SITE_URL}/${locale}${path}` },
    ],
  };
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 pb-12 sm:px-6">
      <JsonLd data={breadcrumb} />
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href={`/${locale}`} className="hover:text-fg">
          {guide.breadcrumbHome}
        </Link>
        <ChevronRight aria-hidden className="size-4" />
        <span aria-current="page">{title}</span>
      </nav>
      <header className="flex flex-col gap-4">
        <h1 className="font-display text-3xl font-bold tracking-wide text-balance sm:text-4xl">{title}</h1>
        <p className="text-lg text-pretty text-muted-foreground">{intro}</p>
      </header>
      {children}
      <section className="card flex flex-col items-start gap-4 p-6">
        <p className="text-lg text-pretty">{cta}</p>
        <Button asChild>
          <Link href={`/${locale}`}>
            {startLabel}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </section>
      <p className="text-xs text-muted-foreground">{guide.disclaimer}</p>
    </main>
  );
}
