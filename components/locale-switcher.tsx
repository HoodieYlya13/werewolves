"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { LOCALE_COOKIE, locales, type Locale } from "@/lib/i18n/config";

/** The same page in `locale`: `rest` is the path after the current locale ("" on the home page). */
export function pathInLocale(locale: Locale, rest: string) {
  return `/${locale}${rest ? `/${rest}` : ""}` as const;
}

/** The path after the locale (`/fr/host/ABCD` → "host/ABCD"). */
export function pathAfterLocale(pathname: string) {
  return pathname.split("/").slice(2).join("/");
}

/** Remembered so `/` redirects to it next time. */
export function rememberLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
}

export function LocaleSwitcher() {
  // On dynamic routes (/host/ABCD) the pathname is only known at request time,
  // so the static shell links to each locale's home until it streams in.
  return (
    <Suspense fallback={<LocaleLinks rest="" />}>
      <LocaleLinksForPath />
    </Suspense>
  );
}

function LocaleLinksForPath() {
  const pathname = usePathname();
  return <LocaleLinks rest={pathAfterLocale(pathname)} />;
}

function LocaleLinks({ rest }: { rest: string }) {
  const { locale, dict } = useI18n();
  return (
    <nav aria-label={dict.settings.language} className="segmented">
      {locales.map((l) => (
        <Link
          key={l}
          href={pathInLocale(l, rest)}
          hrefLang={l}
          aria-current={l === locale ? "true" : undefined}
          onClick={() => rememberLocale(l)}
        >
          {l.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
