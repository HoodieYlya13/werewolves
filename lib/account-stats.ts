"use client";

import { loadSession } from "@/lib/session";
import type { AccountStats } from "@/lib/stats";

export type AccountStatsResult = AccountStats | "failed";

/** The signed-in account's stats, through the session first so an expired sign-in is refreshed (one request at a time). */
export async function fetchAccountStats(): Promise<AccountStatsResult> {
  await loadSession();
  const response = await fetch("/api/auth/stats", { cache: "no-store" }).catch(() => null);
  return response?.ok ? ((await response.json()) as AccountStats) : "failed";
}
