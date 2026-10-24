"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { applyTheme, readTheme, THEME_KEY, type Theme } from "@/lib/theme";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep other tabs in sync.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_KEY) return;
    applyTheme(readTheme());
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function setTheme(theme: Theme) {
  try {
    if (theme === "auto") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {}
  applyTheme(theme);
  listeners.forEach((l) => l());
}

const options = [
  { value: "auto", icon: Monitor, label: "themeAuto" },
  { value: "light", icon: Sun, label: "themeLight" },
  { value: "dark", icon: Moon, label: "themeDark" },
] as const;

export function ThemeSwitcher() {
  const { dict } = useI18n();
  const theme = useSyncExternalStore(subscribe, readTheme, () => "auto" as Theme);

  // React's dev remount resets <html> attributes, dropping what the inline script set.
  useLayoutEffect(() => applyTheme(readTheme()), []);

  return (
    <div role="group" aria-label={dict.settings.theme} className="segmented">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          data-theme-option={value}
          aria-pressed={theme === value}
          title={dict.settings[label]}
          onClick={() => setTheme(value)}
        >
          <Icon aria-hidden className="size-4" />
          <span className="sr-only">{dict.settings[label]}</span>
        </button>
      ))}
    </div>
  );
}
