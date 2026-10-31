import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Crown, Drama, HandHelping, ListChecks, Music, ShieldCheck, Smartphone, Trophy, Undo2, Users } from "lucide-react";
import { CreateRoomButton } from "@/components/home/create-room-button";
import { JoinForm } from "@/components/home/join-form";
import { getGuide } from "@/lib/content/guide";
import { locales } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";
import { JsonLd, pageMetadata, SITE_URL } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return pageMetadata(locale, "", dict.seo.home);
}

const featureIcons = [ListChecks, Smartphone, Trophy, Undo2, Users, Music];

export default async function HomePage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const guide = getGuide(locale).home;
  const app = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: dict.app.name,
    url: `${SITE_URL}/${locale}`,
    description: dict.seo.home.description,
    applicationCategory: "GameApplication",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires JavaScript",
    inLanguage: [...locales],
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: 0, priceCurrency: "EUR" },
    featureList: guide.features.map((f) => f.title),
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-16 px-4 py-10 sm:px-6">
      <JsonLd data={app} />
      <div className="flex flex-col gap-10">
        <div className="text-center">
          <h1 className="font-display text-4xl font-bold tracking-wide sm:text-6xl">{dict.app.name}</h1>
          <p className="mx-auto mt-4 max-w-xl text-balance text-muted-foreground">{dict.app.tagline}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="card flex flex-col gap-4 p-6">
            <Crown aria-hidden className="size-7 text-moon" />
            <div>
              <h2 className="text-xl font-semibold">{dict.home.hostTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{dict.home.hostDescription}</p>
            </div>
            <CreateRoomButton />
          </section>

          <section className="card flex flex-col gap-4 p-6">
            <Smartphone aria-hidden className="size-7 text-moon" />
            <div>
              <h2 className="text-xl font-semibold">{dict.home.joinTitle}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{dict.home.joinDescription}</p>
            </div>
            <JoinForm />
          </section>
        </div>
      </div>

      <section className="flex flex-col gap-6">
        <h2 className="text-center font-display text-3xl font-bold">{guide.howTitle}</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {guide.steps.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-2">
              <span className="grid size-9 place-items-center rounded-full bg-surface-2 font-display font-bold text-moon">
                {i + 1}
              </span>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="text-sm text-pretty text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-center font-display text-3xl font-bold">{guide.featuresTitle}</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guide.features.map((feature, i) => {
            const Icon = featureIcons[i] ?? ShieldCheck;
            return (
              <li key={feature.title} className="card flex flex-col gap-2 p-5">
                <Icon aria-hidden className="size-6 text-moon" />
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="text-sm text-pretty text-muted-foreground">{feature.body}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card flex flex-col items-center gap-4 p-6 text-center">
        <h2 className="font-display text-2xl font-bold">{guide.learnTitle}</h2>
        <p className="max-w-xl text-pretty text-muted-foreground">{guide.learnBody}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            { href: `/${locale}/rules` as const, label: dict.nav.rules, Icon: BookOpen },
            { href: `/${locale}/roles` as const, label: dict.nav.roles, Icon: Drama },
            { href: `/${locale}/faq` as const, label: dict.nav.faq, Icon: HandHelping },
          ].map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium hover:border-fg/40"
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
