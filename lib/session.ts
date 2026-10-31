"use client";

import { useSyncExternalStore } from "react";

/** What /api/auth/session returns. `enabled` is false when accounts aren't configured. */
export type Session = {
  enabled: boolean;
  account: { sub: string; name: string; picture: string | null; username: string | null } | null;
  /** This device's sign-in (see `newSessionId`). */
  sessionId: string | null;
  /** The auth server, where the account is managed. */
  issuer: string | null;
  /** This app's OIDC client id, so the account page can link back here. */
  clientId: string | null;
  /** Whether finished games are saved, for the stats page. */
  stats: boolean;
};

const signedOut: Session = { enabled: false, account: null, sessionId: null, issuer: null, clientId: null, stats: false };
let session: Session | null = null;
let pending: Promise<Session> | null = null;
const listeners = new Set<() => void>();

/**
 * Asks the server who is signed in, refreshing the ID token if it's old (or
 * now, with `fresh`). Calls made at the same time share one request, so the
 * rotating refresh token is never used twice.
 */
export function loadSession(fresh = false): Promise<Session> {
  // A fresh read waits for one already on its way rather than racing it.
  if (fresh && pending) return pending.then(() => loadSession(true));
  pending ??= fetch(fresh ? "/api/auth/session?fresh=1" : "/api/auth/session", { cache: "no-store" })
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
  if (!session) void loadSession(takeAccountVisit());
  return () => listeners.delete(listener);
}

// --- coming back from the account page ---

const ACCOUNT_VISIT_KEY = "ww:account-visit";

/**
 * Called on the way to the account page. Back here (by its link or the Back
 * button), the sign-in is refreshed once, so a new name or photo shows at
 * once instead of when the ID token next expires.
 */
export function markAccountVisit() {
  try {
    sessionStorage.setItem(ACCOUNT_VISIT_KEY, "1");
  } catch {}
}

function takeAccountVisit() {
  try {
    const visited = sessionStorage.getItem(ACCOUNT_VISIT_KEY) === "1";
    sessionStorage.removeItem(ACCOUNT_VISIT_KEY);
    return visited;
  } catch {
    return false;
  }
}

// The Back button can restore this page from memory, without reloading it.
if (typeof window !== "undefined") {
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && takeAccountVisit()) void loadSession(true);
  });
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

/**
 * The account page on the auth server, in the page's language. `client_id`
 * lets it show a link back to this app, and `return_path` (a path on this
 * site, never a full URL) the page to come back to.
 */
export function accountPageUrl(session: Session, locale: string, returnPath?: string): string | null {
  if (!session.issuer || !session.clientId) return null;
  const url = new URL(`/${locale === "fr" ? "fr" : "en"}/account`, session.issuer);
  url.searchParams.set("client_id", session.clientId);
  if (returnPath?.startsWith("/") && !returnPath.startsWith("//")) url.searchParams.set("return_path", returnPath);
  return url.toString();
}

/** This page as a path on the site, with its query string and hash. */
export const currentPath = () => window.location.pathname + window.location.search + window.location.hash;

export const signInUrl = (returnTo: string) => `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
export const signOutUrl = (returnTo: string) => `/api/auth/logout?returnTo=${encodeURIComponent(returnTo)}`;
