import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Crown, Drama, HandHelping, ListChecks, Music, ShieldCheck, Smartphone, Trophy, Undo2, Users } from "lucide-react";
import { CreateRoomButton } from "@/components/home/create-room-button";
import { InstallApp } from "@/components/home/install-app";
import { JoinForm } from "@/components/home/join-form";
import { WhenStartScreenIsShort } from "@/components/home/when-start-screen-is-short";
import { GuestGamesNudge } from "@/components/guest-games";
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
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-10 sm:px-6">
      <JsonLd data={app} />
      {/* Starting a game, all at once between the top and the bottom bar. */}
      <div className="first-screen snap-start">
        <div className="first-screen-content flex flex-col justify-center">
          {/* Centered on its own: the install card hangs below it, so it never moves the rest as it shows up. */}
          <div className="relative flex flex-col gap-4 sm:gap-8">
            <div className="flex flex-col gap-3 text-center sm:gap-4">
              <h1 className="font-display text-4xl font-bold tracking-wide sm:text-6xl">{dict.app.name}</h1>
              {/* Where the first screen is tall enough; else it waits below it. */}
              <p className="start-screen-description mx-auto max-w-xl text-balance text-muted-foreground">{dict.app.tagline}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="card flex flex-col gap-3 p-5 sm:gap-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <Crown aria-hidden className="size-6 shrink-0 text-moon" />
                  <h2 className="text-xl font-semibold">{dict.home.hostTitle}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{dict.home.hostDescription}</p>
                <CreateRoomButton />
              </section>

              <section className="card flex flex-col gap-3 p-5 sm:gap-4 sm:p-6">
                <div className="flex items-center gap-3">
                  <Smartphone aria-hidden className="size-6 shrink-0 text-moon" />
                  <h2 className="text-xl font-semibold">{dict.home.joinTitle}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{dict.home.joinDescription}</p>
                <JoinForm />
              </section>
            </div>

            <div className="absolute inset-x-0 top-full pt-4 sm:pt-8">
              <InstallApp />
            </div>
          </div>
        </div>
      </div>

      <div className="flex snap-start flex-col gap-16 pt-10">
        <WhenStartScreenIsShort>
          <section className="flex flex-col gap-3 text-center">
            <h2 className="font-display text-3xl font-bold">{dict.home.aboutTitle}</h2>
            <p className="mx-auto max-w-xl text-balance text-muted-foreground">{dict.app.tagline}</p>
          </section>
        </WhenStartScreenIsShort>
        <GuestGamesNudge />

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
      </div>
    </main>
  );
}
