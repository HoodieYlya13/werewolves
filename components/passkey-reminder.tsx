"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Fingerprint, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { currentPath, markAccountVisit, passkeyPageUrl, useSession, type Session } from "@/lib/session";

/** `{sub}:{day}`: the account, and the last day it was reminded (or signed in). */
const SHOWN_KEY = "ww:passkey-reminder";

/** Today on this device, e.g. "2026-11-02". */
const today = () => new Date().toLocaleDateString("sv");

/** Signed out: the next sign-in starts over, with a day off. */
export function forgetPasskeyReminder() {
  try {
    localStorage.removeItem(SHOWN_KEY);
  } catch {}
}

/**
 * Whether to remind now, and remembers the day. The day of a sign-in doesn't
 * count: the auth server has just offered a passkey itself. The reminders
 * start the next day, for sign-ins kept for weeks.
 */
function reminderDue(sub: string): boolean {
  try {
    const saved = localStorage.getItem(SHOWN_KEY);
    const day = today();
    if (saved === `${sub}:${day}`) return false;
    localStorage.setItem(SHOWN_KEY, `${sub}:${day}`);
    return !!saved && saved.startsWith(`${sub}:`);
  } catch {
    // No storage: better no reminder than one on every page.
    return false;
  }
}

/**
 * Once a day, an account without a passkey (the auth server says so in the ID
 * token) is offered to add one on the auth server, which brings it back
 * here. Never inside a room: it would get in the way of the game.
 */
export function PasskeyReminder() {
  const session = useSession();
  const pathname = usePathname();
  const inRoom = /\/(host|play)\//.test(pathname);
  const sub = session?.account?.sub;
  const signedOut = !!session?.enabled && !session.account;
  const due = !!sub && !!session?.noPasskey && !inRoom;

  useEffect(() => {
    if (signedOut) forgetPasskeyReminder();
  }, [signedOut]);

  useEffect(() => {
    if (!due || !session || !sub || !reminderDue(sub)) return;
    toast.custom((id) => <ReminderCard session={session} close={() => toast.dismiss(id)} />, {
      id: "passkey-reminder",
      duration: 20_000,
    });
  }, [due, session, sub]);

  return null;
}

function ReminderCard({ session, close }: { session: Session; close: () => void }) {
  const { dict, locale } = useI18n();
  function addPasskey() {
    const href = passkeyPageUrl(session, locale, currentPath());
    if (!href) return;
    markAccountVisit();
    window.location.assign(href);
  }
  return (
    <div className="relative flex w-[min(24rem,calc(100vw-2rem))] gap-3 rounded-2xl border border-line bg-surface p-4 pr-10 text-fg shadow-xl">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-moon/15 text-moon">
        <Fingerprint aria-hidden className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold">{dict.account.passkeyReminder}</p>
        <p className="text-sm text-muted-foreground">{dict.account.passkeyReminderBody}</p>
        <div className="mt-2 flex gap-2">
          <Button type="button" size="sm" onClick={addPasskey}>
            {dict.account.addPasskey}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={close}>
            {dict.account.later}
          </Button>
        </div>
      </div>
      <button
        type="button"
        aria-label={dict.account.later}
        onClick={close}
        className="absolute top-2 right-2 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-fg"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
