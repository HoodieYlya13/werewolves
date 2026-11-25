"use client";

import { useState } from "react";
import Link from "next/link";
import { ChartColumn, Fingerprint, LogOut, UserCog, Users } from "lucide-react";
import { IconRow } from "@/components/bottom-bar/bar-row";
import { PanelList } from "@/components/bottom-bar/panel-list";
import { useI18n } from "@/components/i18n-provider";
import { accountPageUrl, currentPath, markAccountVisit, passkeyPageUrl, type Session } from "@/lib/session";

/** The signed-in account's menu: adding a passkey (until it has one), stats, friends, the account page and signing out. */
export function AccountPanel({
  session,
  incomingFriendRequests,
  onSignOut,
}: {
  session: Session;
  incomingFriendRequests: number;
  onSignOut: () => void;
}) {
  const { dict, locale } = useI18n();
  // The page the auth server links back to: the one the panel was opened on.
  const [returnPath] = useState(currentPath);
  const accountPage = accountPageUrl(session, locale, returnPath);
  const passkeyPage = session.noPasskey ? passkeyPageUrl(session, locale, returnPath) : null;

  return (
    <PanelList>
      {passkeyPage && (
        // Same tab, like the account page: back here, the sign-in refreshes and the count goes.
        <a href={passkeyPage} onClick={markAccountVisit} className="block rounded-lg">
          <IconRow icon={Fingerprint} label={dict.account.addPasskey} badge={1} />
        </a>
      )}
      {session.stats && (
        <Link href={`/${locale}/stats`} className="block rounded-lg">
          <IconRow icon={ChartColumn} label={dict.account.stats} />
        </Link>
      )}
      {session.stats && (
        <Link href={`/${locale}/friends`} className="block rounded-lg">
          <IconRow icon={Users} label={dict.friends.menu} badge={incomingFriendRequests} />
        </Link>
      )}
      {accountPage && (
        // Same tab: the account page links back to the app, and the sign-in refreshes then.
        <a href={accountPage} onClick={markAccountVisit} className="block rounded-lg">
          <IconRow icon={UserCog} label={dict.account.manage} />
        </a>
      )}
      <button type="button" onClick={onSignOut} className="block w-full rounded-lg text-left">
        <IconRow icon={LogOut} label={dict.account.signOut} />
      </button>
    </PanelList>
  );
}
