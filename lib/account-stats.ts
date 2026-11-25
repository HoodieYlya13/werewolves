"use client";

import { useEffect, useState } from "react";
import { loadSession } from "@/lib/session";
import type { AccountStats } from "@/lib/stats";

export type AccountStatsResult = AccountStats | "failed";

/** The signed-in account's stats, through the session first so an expired sign-in is refreshed (one request at a time). */
export async function fetchAccountStats(): Promise<AccountStatsResult> {
  await loadSession();
  const response = await fetch("/api/auth/stats", { cache: "no-store" }).catch(() => null);
  return response?.ok ? ((await response.json()) as AccountStats) : "failed";
}

/** The stats of the account `sub` (null while loading, or signed out). */
export function useAccountStats(sub: string | undefined): AccountStats | null {
  const [loaded, setLoaded] = useState<{ sub: string; stats: AccountStats } | null>(null);

  useEffect(() => {
    if (!sub) return;
    let isCancelled = false;
    void fetchAccountStats().then((result) => {
      if (!isCancelled && result !== "failed") setLoaded({ sub, stats: result });
    });
    return () => {
      isCancelled = true;
    };
  }, [sub]);

  return loaded && loaded.sub === sub ? loaded.stats : null;
}
