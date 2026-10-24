"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { LOCALE_COOKIE, locales } from "@/lib/i18n/config";

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
  return <LocaleLinks rest={pathname.split("/").slice(2).join("/")} />;
}

function LocaleLinks({ rest }: { rest: string }) {
  const { locale, dict } = useI18n();
  return (
    <nav aria-label={dict.settings.language} className="segmented">
      {locales.map((l) => (
        <Link
          key={l}
          href={`/${l}${rest ? `/${rest}` : ""}`}
          hrefLang={l}
          aria-current={l === locale ? "true" : undefined}
          onClick={() => {
            document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; SameSite=Lax`;
          }}
        >
          {l.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}
