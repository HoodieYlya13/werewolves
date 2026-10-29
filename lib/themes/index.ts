import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { mafia } from "./mafia";
import { spaceship } from "./spaceship";
import { vampires } from "./vampires";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/**
 * A theme reskins the game: same rules, different names. `rename` swaps whole
 * words in every string (longest first, so "Big Bad Wolf" wins over "Wolf");
 * `overrides` replaces the few strings a simple swap can't phrase well.
 */
export type Theme = {
  id: string;
  name: Record<Locale, string>;
  description: Record<Locale, string>;
  rename?: Record<Locale, Record<string, string>>;
  overrides?: Partial<Record<Locale, DeepPartial<Dictionary>>>;
};

const werewolves: Theme = {
  id: "werewolves",
  name: { en: "Werewolves", fr: "Loups-Garous" },
  description: {
    en: "The original village of Thiercelieux, haunted by werewolves.",
    fr: "Le village de Thiercelieux d'origine, hanté par les loups-garous.",
  },
};

export const themes = { werewolves, mafia, vampires, spaceship } satisfies Record<string, Theme>;
export type ThemeId = keyof typeof themes;
export const themeIds = Object.keys(themes) as ThemeId[];
export const defaultTheme: ThemeId = "werewolves";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && value in themes;
}

const cache = new Map<string, Dictionary>();

/** The dictionary with a theme's names applied. Cached per theme and language. */
export function themeDictionary(dict: Dictionary, themeId: string | undefined, locale: Locale): Dictionary {
  const theme: Theme = isThemeId(themeId) ? themes[themeId] : werewolves;
  if (!theme.rename && !theme.overrides) return dict;
  const key = `${theme.id}:${locale}:${dict.app.name}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const swaps = theme.rename?.[locale] ?? {};
  const words = Object.keys(swaps).sort((a, b) => b.length - a.length);
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Whole words only: a name inside a longer hyphenated name is left alone.
  const pattern = words.length
    ? new RegExp(`(?<![\\p{L}\\d-])(?:${words.map(escape).join("|")})(?![\\p{L}\\d-])`, "gu")
    : null;
  const swap = (s: string) => (pattern ? s.replace(pattern, (m) => swaps[m]) : s);

  const themed = merge(mapStrings(dict, swap), theme.overrides?.[locale]) as Dictionary;
  cache.set(key, themed);
  return themed;
}

function mapStrings(value: unknown, fn: (s: string) => string): unknown {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn)]));
  }
  return value;
}

function merge(base: unknown, patch: unknown): unknown {
  // Lists (narration lines) are replaced whole.
  if (Array.isArray(patch)) return patch;
  if (!patch || typeof patch !== "object" || !base || typeof base !== "object") return patch ?? base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch)) out[k] = merge(out[k], v);
  return out;
}
