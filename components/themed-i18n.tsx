"use client";

import { I18nProvider, useI18n } from "@/components/i18n-provider";
import { useSiteTheme } from "@/components/site-title";
import { themeDictionary } from "@/lib/themes";

/** Re-provides the dictionary with a theme's names, for everything inside a game (the header's title too). */
export function ThemedI18n({ theme, children }: { theme: string | undefined; children: React.ReactNode }) {
  const { locale, dict } = useI18n();
  useSiteTheme(theme);
  return (
    <I18nProvider locale={locale} dict={themeDictionary(dict, theme, locale)}>
      {children}
    </I18nProvider>
  );
}
