"use client";

import { useSyncExternalStore } from "react";

/**
 * Games played on this device without an account, kept until the player signs
 * in and claims them (ClaimGuestGames). Only the room's claim code is kept:
 * the result stays on the server, so editing this can't add a win.
 */
type GuestGame = { gameId: string; code: string; at: number };

const KEY = "ww:guest-games";
const CHANGED = "ww:guest-games";
/** As long as the server keeps an unclaimed seat (GUEST_SEAT_DAYS). */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** As many as the claim route takes at once. */
export const MAX_GUEST_GAMES = 50;

function read(): GuestGame[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "[]") as GuestGame[];
    return Array.isArray(saved) ? saved.filter((g) => typeof g?.code === "string" && Date.now() - g.at < MAX_AGE_MS) : [];
  } catch {
    return [];
  }
}

function write(games: GuestGame[]) {
  try {
    if (games.length) localStorage.setItem(KEY, JSON.stringify(games.slice(-MAX_GUEST_GAMES)));
    else localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event(CHANGED));
}

export const guestGames = () => read();

/** The room sent this seat's claim code: kept once per game. */
export function rememberGuestGame(claim: { gameId: string; code: string }) {
  const games = read();
  if (games.some((g) => g.gameId === claim.gameId && g.code === claim.code)) return;
  write([...games.filter((g) => g.gameId !== claim.gameId), { ...claim, at: Date.now() }]);
}

/** Sent to the server, claimed or not: a code that didn't work never will. */
export function forgetGuestGames(codes: string[]) {
  write(read().filter((g) => !codes.includes(g.code)));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** How many games are waiting on this device (0 on the server). */
export function useGuestGameCount() {
  return useSyncExternalStore(subscribe, () => read().length, () => 0);
}
