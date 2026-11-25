"use client";

import type { FriendsList, Invite, Person, RequestResult } from "./friends";
import { sendToAccount } from "./account-socket";
import { loadSession } from "./session";

/**
 * The friends routes, from the page. Each call goes through the session first,
 * which refreshes the sign-in if needed (one request at a time).
 */
async function call<T>(path: string, init?: RequestInit): Promise<T | null> {
  await loadSession();
  const res = await fetch(path, { cache: "no-store", ...init }).catch(() => null);
  return res?.ok ? ((await res.json()) as T) : null;
}

const post = <T>(path: string, body: unknown, method = "POST") =>
  call<T>(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/** Their open screens hear about a request just sent, or theirs just accepted. */
function tellFriend(to: string | undefined, accepted: boolean) {
  if (to) sendToAccount({ type: "friend-requested", to, accepted });
}

async function request(to: { sub: string } | { code: string }) {
  const answer = await post<{ result: RequestResult; to?: string; list: FriendsList }>("/api/auth/friends", { action: "request", ...to });
  if (answer?.result === "sent" || answer?.result === "accepted") tellFriend(answer.to, answer.result === "accepted");
  return answer;
}

async function answer(sub: string, accept: boolean) {
  const result = await post<{ list: FriendsList }>("/api/auth/friends", { action: "answer", sub, accept });
  if (result && accept) tellFriend(sub, true);
  return result;
}

export const friendsApi = {
  list: () => call<FriendsList>("/api/auth/friends"),
  request,
  answer,
  remove: (sub: string) => post<{ list: FriendsList }>("/api/auth/friends", { action: "remove", sub }),
  search: (query: string) => call<{ people: Person[] }>(`/api/auth/friends/search?q=${encodeURIComponent(query)}`),
  invites: () => call<{ invites: Invite[] }>("/api/auth/invites"),
};

// --- push notifications ---

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export type PushSupport = "ok" | "install" | "unsupported";

/** Whether this device can get notifications: iPhones and iPads only from the installed app. */
export function pushSupport(): PushSupport {
  if (!PUBLIC_KEY || !("serviceWorker" in navigator)) return "unsupported";
  if ("PushManager" in window && "Notification" in window) return "ok";
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return ios ? "install" : "unsupported";
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** This device's subscription, if notifications are on. */
export async function currentPush() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Asks for permission, subscribes, and tells the site. "denied": the browser said no. */
export async function enablePush(): Promise<"on" | "denied" | "failed"> {
  try {
    if ((await Notification.requestPermission()) !== "granted") return "denied";
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const key = Uint8Array.from(atob(PUBLIC_KEY!.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const subscription = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
    return (await post("/api/auth/push", { endpoint: subscription.endpoint })) ? "on" : "failed";
  } catch {
    return "failed";
  }
}

export async function disablePush() {
  const subscription = await currentPush();
  if (!subscription) return;
  await post("/api/auth/push", { endpoint: subscription.endpoint }, "DELETE");
  await subscription.unsubscribe().catch(() => {});
}
