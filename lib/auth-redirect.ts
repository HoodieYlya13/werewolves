"use client";

import { useSyncExternalStore } from "react";
import { markAccountVisit } from "@/lib/session";

/** Where the page is on its way to, on the auth server: signing in, signing out, or the account's own pages. */
export type AuthDestination = "in" | "out" | "account";

let redirecting: AuthDestination | null = null;
const listeners = new Set<() => void>();

export const currentRedirect = () => redirecting;

export function setRedirecting(destination: AuthDestination | null) {
  redirecting = destination;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Back from the auth server with the Back button: the page comes from memory, still spinning.
if (typeof window !== "undefined") {
  window.addEventListener("pageshow", (event) => event.persisted && setRedirecting(null));
}

/** Where the page is on its way to, or null while it stays. */
export function useAuthRedirect(): AuthDestination | null {
  return useSyncExternalStore(subscribe, () => redirecting, () => null);
}

const opensElsewhere = (event?: React.MouseEvent) => !!event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);

/** On the way to the account or passkey page in this tab: spinners until it opens, and a fresh sign-in once back. */
export function leaveForAccountPage(event?: React.MouseEvent) {
  if (opensElsewhere(event)) return;
  markAccountVisit();
  setRedirecting("account");
}
