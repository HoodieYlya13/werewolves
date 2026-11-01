"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { isThemeId, themes, type ThemeId } from "@/lib/themes";

// The theme of the game on screen, if any: the header's title follows it.
let current: ThemeId | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
function setCurrent(theme: ThemeId | null) {
  current = theme;
  listeners.forEach((listener) => listener());
}

/** While mounted, the header is titled after `theme` (a Mafia game reads "Mafia"). */
export function useSiteTheme(theme: string | undefined) {
  useEffect(() => {
    if (!isThemeId(theme)) return;
    setCurrent(theme);
    return () => setCurrent(null);
  }, [theme]);
}

/** The header's title and link home: the app's name, or the theme of the game on screen. */
export function SiteTitle() {
  const { dict, locale } = useI18n();
  const theme = useSyncExternalStore(subscribe, () => current, () => null);
  return (
    <Link href={`/${locale}`} className="font-display text-lg font-bold tracking-wide">
      {theme && theme !== "werewolves" ? themes[theme].name[locale] : dict.app.name}
    </Link>
  );
}
