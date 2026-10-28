"use client";

import { useSyncExternalStore } from "react";

/** What /api/auth/session returns. `enabled` is false when accounts aren't configured. */
export type Session = {
  enabled: boolean;
  account: { sub: string; name: string; picture: string | null } | null;
  /** This device's sign-in (see `newSessionId`). */
  sessionId: string | null;
  /** The auth server, where the account is managed. */
  issuer: string | null;
  /** Whether finished games are saved, for the stats page. */
  stats: boolean;
};

const signedOut: Session = { enabled: false, account: null, sessionId: null, issuer: null, stats: false };
let session: Session | null = null;
let pending: Promise<Session> | null = null;
const listeners = new Set<() => void>();

/**
 * Asks the server who is signed in, refreshing the ID token if it's old.
 * Calls made at the same time share one request, so the rotating refresh
 * token is never used twice.
 */
export function loadSession(): Promise<Session> {
  pending ??= fetch("/api/auth/session", { cache: "no-store" })
    .then((res) => (res.ok ? (res.json() as Promise<Session>) : signedOut))
    .catch(() => signedOut)
    .then((value) => {
      session = value;
      listeners.forEach((listener) => listener());
      return value;
    })
    .finally(() => (pending = null));
  return pending;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!session) void loadSession();
  return () => listeners.delete(listener);
}

/** The signed-in account, or null while loading. */
export function useSession() {
  return useSyncExternalStore(
    subscribe,
    () => session,
    () => null,
  );
}

/**
 * A one-minute ticket proving the account to one room (`{ room }`) or to the
 * account server, or null when signed out. The ID token never reaches the page.
 */
export async function getTicket(to: { room: string } | "account"): Promise<string | null> {
  // Through the session first: it refreshes the ID token if needed, one request
  // at a time, so the ticket route never spends the rotating refresh token too.
  if (!(await loadSession()).account) return null;
  const res = await fetch("/api/auth/ticket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(to === "account" ? { account: true } : to),
    cache: "no-store",
  }).catch(() => null);
  if (res?.status === 401) void loadSession(); // Signed out meanwhile: the page catches up.
  return res?.ok ? ((await res.json()) as { ticket: string }).ticket : null;
}

/** Signs out on this device only (the account signed in elsewhere): no trip to the auth server. */
export async function forgetSession() {
  await fetch("/api/auth/forget", { method: "POST" }).catch(() => {});
  return loadSession();
}

/**
 * Set by a screen where signing out has consequences: a player whose seat
 * belongs to the account leaves the room first, after confirming.
 */
export type SignOutGuard = { inGame: boolean; leave: () => Promise<void> };
let signOutGuard: SignOutGuard | null = null;
export function setSignOutGuard(guard: SignOutGuard | null) {
  signOutGuard = guard;
}
export const getSignOutGuard = () => signOutGuard;

export const signInUrl = (returnTo: string) => `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
export const signOutUrl = (returnTo: string) => `/api/auth/logout?returnTo=${encodeURIComponent(returnTo)}`;
