"use client";

import { useState } from "react";
import Link from "next/link";
import { ChartColumn, LogOut, UserCog, Users } from "lucide-react";
import { BarIcon, BarRow, RollingText } from "@/components/bottom-bar/bar-row";
import { PanelList } from "@/components/bottom-bar/panel-list";
import { useI18n } from "@/components/i18n-provider";
import { accountPageUrl, currentPath, markAccountVisit, type Session } from "@/lib/session";

/** The signed-in account's menu: stats, friends, the account page and signing out. */
export function AccountPanel({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const { dict, locale } = useI18n();
  // The page the account page links back to: the one the panel was opened on.
  const [returnPath] = useState(currentPath);
  const accountPage = accountPageUrl(session, locale, returnPath);

  return (
    <PanelList>
      {session.stats && (
        <Link href={`/${locale}/stats`} className="block rounded-lg">
          <BarRow tile={<BarIcon icon={ChartColumn} />}>
            <RollingText text={dict.account.stats} />
          </BarRow>
        </Link>
      )}
      {session.stats && (
        <Link href={`/${locale}/friends`} className="block rounded-lg">
          <BarRow tile={<BarIcon icon={Users} />}>
            <RollingText text={dict.friends.menu} />
          </BarRow>
        </Link>
      )}
      {accountPage && (
        // Same tab: the account page links back to the app, and the sign-in refreshes then.
        <a href={accountPage} onClick={markAccountVisit} className="block rounded-lg">
          <BarRow tile={<BarIcon icon={UserCog} />}>
            <RollingText text={dict.account.manage} />
          </BarRow>
        </a>
      )}
      <button type="button" onClick={onSignOut} className="block w-full rounded-lg text-left">
        <BarRow tile={<BarIcon icon={LogOut} />}>
          <RollingText text={dict.account.signOut} />
        </BarRow>
      </button>
    </PanelList>
  );
}
