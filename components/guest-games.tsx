"use client";

import { useEffect, useRef } from "react";
import { LogIn } from "lucide-react";
import { toast } from "sonner";
import { AuthButton } from "@/components/account-button";
import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import { forgetGuestGames, guestGames, useGuestGameCount } from "@/lib/guest-games";
import { useSession } from "@/lib/session";

/**
 * Once signed in, the games this device played as a guest go to the account's
 * stats: the server checks each code against the seat it saved.
 */
export function ClaimGuestGames() {
  const { dict } = useI18n();
  const session = useSession();
  const count = useGuestGameCount();
  const sub = session?.account?.sub;
  const stats = !!session?.stats;
  const claiming = useRef(false);

  useEffect(() => {
    if (!sub || !stats || !count || claiming.current) return;
    claiming.current = true;
    const codes = guestGames().map((g) => g.code);
    void fetch("/api/auth/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codes }),
      cache: "no-store",
    })
      .then(async (res) => {
        // Signed out meanwhile, or stats turned off: keep them for later.
        if (!res.ok) return;
        const { claimed } = (await res.json()) as { claimed: number };
        forgetGuestGames(codes);
        if (claimed > 0) {
          const t = dict.account;
          toast.success(claimed === 1 ? t.guestGameClaimed : format(t.guestGamesClaimed, { count: claimed }));
        }
      })
      .catch(() => {})
      .finally(() => (claiming.current = false));
  }, [sub, stats, count, dict]);

  return null;
}

/** Signed out with games waiting on this device: a line offering to keep them. */
export function GuestGamesNudge() {
  const { dict } = useI18n();
  const session = useSession();
  const count = useGuestGameCount();
  if (!session?.stats || session.account || !count) return null;
  const t = dict.account;
  return (
    <AuthButton
      to="in"
      variant="link"
      className="mx-auto h-auto p-0 text-sm font-normal whitespace-normal text-muted-foreground underline"
    >
      <LogIn aria-hidden className="size-4 shrink-0" />
      {count === 1 ? t.guestGame : format(t.guestGames, { count })}
    </AuthButton>
  );
}
