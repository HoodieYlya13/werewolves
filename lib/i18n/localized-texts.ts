import type { Locale } from "./config";

type OtherLocale = Exclude<Locale, "en">;

/** A piece of the dictionaries, kept next to the code it belongs to: every language must have the same keys as English. */
export function localizedTexts<Texts extends object>(texts: { en: Texts } & Record<OtherLocale, NoInfer<Texts>>): Record<Locale, Texts> {
  return texts;
}
