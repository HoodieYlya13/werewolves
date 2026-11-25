export const locales = ["en", "fr"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Remembers an explicit language choice so `/` redirects to it next time. */
export const LOCALE_COOKIE = "locale";

export function isLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}

/** Picks the best supported locale from an Accept-Language header. */
export function matchLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.slice(0, 2).toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  return ranked.find((r) => isLocale(r.lang))?.lang as Locale ?? defaultLocale;
}

/** The locale a path starts with (`/fr/play/ABCD` → "fr"), if any. */
export function pathLocale(path: string): Locale | null {
  const first = path.split("/")[1];
  return isLocale(first) ? first : null;
}

/** The saved language choice, else the browser's. */
export function preferredLocale(request: { cookies: { get(name: string): { value: string } | undefined }; headers: Headers }): Locale {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  return isLocale(saved) ? saved : matchLocale(request.headers.get("accept-language"));
}

/** Replaces `{name}` placeholders in a dictionary string. */
export function format(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
