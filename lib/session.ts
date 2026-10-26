"use client";

import { useSyncExternalStore } from "react";

/** What /api/auth/session returns. `enabled` is false when accounts aren't configured. */
export type Session = {
  enabled: boolean;
  account: { name: string; picture: string | null } | null;
  idToken: string | null;
};

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
    .then((res) => (res.ok ? (res.json() as Promise<Session>) : { enabled: false, account: null, idToken: null }))
    .catch(() => ({ enabled: false, account: null, idToken: null }))
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

/** A fresh ID token to prove the account to the room server, or null when signed out. */
export async function freshIdToken() {
  return (await loadSession()).idToken;
}

export const signInUrl = (returnTo: string) => `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
export const signOutUrl = (returnTo: string) => `/api/auth/logout?returnTo=${encodeURIComponent(returnTo)}`;
