"use client";

import { useEffect, useSyncExternalStore } from "react";
import { friendsApi } from "@/lib/friends-client";

/** How many friend requests wait for the signed-in account's answer, shared by the bottom bar and the friends page. */
let known: { sub: string; count: number } | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Set by whoever has just read the requests (the friends page after each change), so the badge follows at once. */
export function setIncomingFriendRequests(sub: string, count: number) {
  if (known?.sub === sub && known.count === count) return;
  known = { sub, count };
  listeners.forEach((listener) => listener());
}

/** How many live friend requests (or accepts) arrived since the page loaded: the friends page reads its list again on each. */
let receivedLive = 0;

/** A friend just asked (or accepted), live: the count is read again, and the friends page follows. */
export function friendRequestReceived() {
  receivedLive += 1;
  listeners.forEach((listener) => listener());
  if (known) void loadIncomingFriendRequests(known.sub);
}

export function useFriendRequestsReceived(): number {
  return useSyncExternalStore(subscribe, () => receivedLive, () => 0);
}

async function loadIncomingFriendRequests(sub: string) {
  const list = await friendsApi.list();
  if (list) setIncomingFriendRequests(sub, list.incoming.length);
}

/** The requests waiting for account `sub`'s answer (0 until known), read again when the app comes back to the screen. */
export function useIncomingFriendRequests(sub: string | undefined): number {
  const value = useSyncExternalStore(subscribe, () => known, () => null);

  useEffect(() => {
    if (!sub) return;
    void loadIncomingFriendRequests(sub);
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadIncomingFriendRequests(sub);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [sub]);

  return value && value.sub === sub ? value.count : 0;
}
