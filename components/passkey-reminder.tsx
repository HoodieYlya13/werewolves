"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { accountPageUrl, currentPath, markAccountVisit, useSession } from "@/lib/session";

const SHOWN_KEY = "ww:passkey-reminder";

/** Today on this device, e.g. "2026-11-02". */
const today = () => new Date().toLocaleDateString("sv");

/**
 * Once a day, an account without a passkey (the auth server says so in the ID
 * token) is offered to add one on its account page. Never inside a room: it
 * would get in the way of the game.
 */
export function PasskeyReminder() {
  const { dict, locale } = useI18n();
  const session = useSession();
  const pathname = usePathname();
  const inRoom = /\/(host|play)\//.test(pathname);
  const due = !!session?.account && session.noPasskey && !inRoom;

  useEffect(() => {
    if (!due || !session) return;
    try {
      if (localStorage.getItem(SHOWN_KEY) === today()) return;
      localStorage.setItem(SHOWN_KEY, today());
    } catch {
      // No storage: better no reminder than one on every page.
      return;
    }
    toast(dict.account.passkeyReminder, {
      id: "passkey-reminder",
      description: dict.account.passkeyReminderBody,
      duration: 15_000,
      action: {
        label: dict.account.addPasskey,
        onClick: () => {
          const href = accountPageUrl(session, locale, currentPath());
          if (!href) return;
          markAccountVisit();
          window.location.assign(href);
        },
      },
    });
  }, [due, session, dict, locale]);

  return null;
}
