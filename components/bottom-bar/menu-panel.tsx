"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CircleHelp, Languages, MessageSquareHeart, SunMoon, VenetianMask, type LucideIcon } from "lucide-react";
import { IconRow } from "@/components/bottom-bar/bar-row";
import { PanelList } from "@/components/bottom-bar/panel-list";
import { useI18n } from "@/components/i18n-provider";
import { LocaleSwitcher, pathAfterLocale, pathInLocale, rememberLocale } from "@/components/locale-switcher";
import { nextTheme, setTheme, ThemeSwitcher } from "@/components/theme-switcher";
import { locales } from "@/lib/i18n/config";
import { readTheme } from "@/lib/theme";

/** The feedback form on my portfolio's contact page, for this app (it lists the apps it takes feedback for). */
const FEEDBACK_URL = "https://www.hy13dev.com/contact?app=werewolves";

/** The burger menu: the guides, then the language and theme settings. */
export function MenuPanel() {
  const { dict, locale } = useI18n();
  return (
    <nav aria-label={dict.nav.label}>
      <PanelList>
        <PageLink href={`/${locale}/rules`} icon={BookOpen} label={dict.nav.rules} />
        <PageLink href={`/${locale}/roles`} icon={VenetianMask} label={dict.nav.roles} />
        <PageLink href={`/${locale}/faq`} icon={CircleHelp} label={dict.nav.faq} />
        <a href={FEEDBACK_URL} className="block rounded-lg">
          <IconRow icon={MessageSquareHeart} label={dict.nav.feedback} />
        </a>
        <LanguageRow />
        <ThemeRow />
      </PanelList>
    </nav>
  );
}

function PageLink<T extends string>({ href, icon, label }: { href: Route<T>; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} className="block rounded-lg">
      <IconRow icon={icon} label={label} />
    </Link>
  );
}

/** The row switches to the other language; the choices beside it pick one. */
function LanguageRow() {
  const { dict, locale } = useI18n();
  const pathname = usePathname();
  const otherLocale = locales.find((candidate) => candidate !== locale) ?? locale;
  return (
    <SettingRow control={<LocaleSwitcher />}>
      <Link href={pathInLocale(otherLocale, pathAfterLocale(pathname))} onClick={() => rememberLocale(otherLocale)} className="block rounded-lg">
        <IconRow icon={Languages} label={dict.settings.language} />
      </Link>
    </SettingRow>
  );
}

/** The row moves to the next theme; the choices beside it pick one. */
function ThemeRow() {
  const { dict } = useI18n();
  return (
    <SettingRow control={<ThemeSwitcher />}>
      <button type="button" onClick={() => setTheme(nextTheme(readTheme()))} className="block w-full rounded-lg text-left">
        <IconRow icon={SunMoon} label={dict.settings.theme} />
      </button>
    </SettingRow>
  );
}

/** A clickable row with its own control beside it. */
function SettingRow({ control, children }: { control: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className="min-w-0 flex-1">{children}</span>
      {control}
    </span>
  );
}
