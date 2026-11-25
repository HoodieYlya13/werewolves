"use client";

import type { Route } from "next";
import Link from "next/link";
import { BookOpen, CircleHelp, Languages, SunMoon, VenetianMask, type LucideIcon } from "lucide-react";
import { BarIcon, BarRow, RollingText } from "@/components/bottom-bar/bar-row";
import { PanelList } from "@/components/bottom-bar/panel-list";
import { useI18n } from "@/components/i18n-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";

/** The burger menu: the guides, then the language and theme settings. */
export function MenuPanel() {
  const { dict, locale } = useI18n();
  return (
    <nav aria-label={dict.nav.label}>
      <PanelList>
        <PageLink href={`/${locale}/rules`} icon={BookOpen} label={dict.nav.rules} />
        <PageLink href={`/${locale}/roles`} icon={VenetianMask} label={dict.nav.roles} />
        <PageLink href={`/${locale}/faq`} icon={CircleHelp} label={dict.nav.faq} />
        <SettingRow icon={Languages} label={dict.settings.language}>
          <LocaleSwitcher />
        </SettingRow>
        <SettingRow icon={SunMoon} label={dict.settings.theme}>
          <ThemeSwitcher />
        </SettingRow>
      </PanelList>
    </nav>
  );
}

function PageLink<T extends string>({ href, icon, label }: { href: Route<T>; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} className="block rounded-lg">
      <BarRow tile={<BarIcon icon={icon} />}>
        <RollingText text={label} />
      </BarRow>
    </Link>
  );
}

function SettingRow({ icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <BarRow tile={<BarIcon icon={icon} />}>
      <span className="flex flex-wrap items-center justify-between gap-2">
        <RollingText text={label} />
        {children}
      </span>
    </BarRow>
  );
}
