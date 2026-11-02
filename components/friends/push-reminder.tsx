"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { currentPush, enablePush, pushSupport } from "@/lib/friends-client";
import { useSession } from "@/lib/session";

/** `{ sub, next }`: the account, and when to ask again (a time, or "never"). */
const KEY = "ww:push-prompt";
const WEEK = 7 * 24 * 60 * 60 * 1000;

type Saved = { sub: string; next: number | "never" };

function saved(): Saved | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null") as Saved | null;
  } catch {
    return null;
  }
}

function save(value: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {}
}

/** Signed out: the next sign-in may be asked again, without waiting a week. */
export function forgetPushPrompt() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/**
 * At most once a week, a signed-in account whose device could get friends'
 * invites as notifications (but doesn't) is asked to turn them on. Never in a
 * room, never once blocked, and never again if they say so.
 */
export function PushReminder() {
  const session = useSession();
  const pathname = usePathname();
  const inRoom = /\/(host|play)\//.test(pathname);
  const sub = session?.account?.sub;
  const ready = !!sub && !!session?.stats && !inRoom;

  useEffect(() => {
    if (!ready || !sub) return;
    const last = saved();
    if (last?.sub === sub && (last.next === "never" || Date.now() < last.next)) return;
    let cancelled = false;
    // After the page settles (and after the passkey reminder, when there's one).
    const timer = setTimeout(() => {
      void (async () => {
        if (pushSupport() !== "ok" || Notification.permission === "denied" || (await currentPush()) || cancelled) return;
        save({ sub, next: Date.now() + WEEK });
        toast.custom((id) => <PromptCard sub={sub} close={() => toast.dismiss(id)} />, { id: "push-reminder", duration: Infinity });
      })();
    }, 4000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [ready, sub]);

  return null;
}

function PromptCard({ sub, close }: { sub: string; close: () => void }) {
  const { dict } = useI18n();
  const t = dict.friends;
  const [never, setNever] = useState(false);
  const [busy, setBusy] = useState(false);

  /** Closing (any way) with the box ticked: never asked again on this device. */
  function done() {
    if (never) save({ sub, next: "never" });
    close();
  }

  async function enable() {
    setBusy(true);
    const result = await enablePush();
    close();
    if (result === "on") toast.success(t.notificationsEnabled);
    else {
      if (never) save({ sub, next: "never" });
      toast(result === "denied" ? t.notificationsDenied : t.notificationsFailed);
    }
  }

  return (
    <div className="relative flex w-[min(24rem,calc(100vw-2rem))] gap-3 rounded-2xl border border-line bg-surface p-4 pr-10 text-fg shadow-xl">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-moon/15 text-moon">
        <Bell aria-hidden className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold">{t.pushPromptTitle}</p>
        <p className="text-sm text-muted-foreground">{t.notificationsHint}</p>
        <div className="mt-2 flex gap-2">
          <Button type="button" size="sm" disabled={busy} onClick={() => void enable()}>
            {t.notificationsOn}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={done}>
            {dict.account.later}
          </Button>
        </div>
        <label className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="size-4 accent-primary" checked={never} onChange={(e) => setNever(e.target.checked)} />
          {t.pushPromptNever}
        </label>
      </div>
      <button
        type="button"
        aria-label={dict.account.later}
        onClick={done}
        className="absolute top-2 right-2 grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-fg"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
