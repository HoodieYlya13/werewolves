import type { Metadata } from "next";
import { locales, type Locale } from "@/lib/i18n/config";

/** The public address: canonical URLs, the sitemap and share links point here, even from previews. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://werewolves.hy13dev.com";

/** Pages worth finding on a search engine, as paths after the language. */
export const publicPaths = ["", "/rules", "/roles", "/faq"] as const;
export type PublicPath = (typeof publicPaths)[number];

const ogLocale: Record<Locale, string> = { en: "en_US", fr: "fr_FR" };

/** Every language's address for one page, plus the default for other languages. */
export function languageAlternates(path: string) {
  return {
    ...Object.fromEntries(locales.map((l) => [l, `${SITE_URL}/${l}${path}`])),
    "x-default": `${SITE_URL}/en${path}`,
  };
}

/** A public page's title, description, canonical URL, translations and share card. */
export function pageMetadata(
  locale: Locale,
  path: PublicPath,
  { title, description }: { title: string; description: string },
): Metadata {
  const url = `${SITE_URL}/${locale}${path}`;
  // Set here: a page's own Open Graph settings replace the share image it would inherit.
  const images = [{ url: `${SITE_URL}/${locale}/opengraph-image`, width: 1200, height: 630, alt: title }];
  return {
    // Each title already names the game: no "· Werewolves" after it.
    title: { absolute: title },
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      locale: ogLocale[locale],
      alternateLocale: locales.filter((l) => l !== locale).map((l) => ogLocale[l]),
      images,
    },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

/** Screens of a room or an account: nothing for a search engine there. */
export const privatePage: Metadata = { robots: { index: false, follow: false } };

/** Structured data for search engines, escaped so no string can close the script tag. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
  );
}
