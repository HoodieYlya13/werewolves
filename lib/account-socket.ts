"use client";

import type { AccountClientMessage } from "@/lib/protocol";

type Send = (message: AccountClientMessage) => void;

/** The signed-in account's socket (see SessionGuard), for pages that tell the account server something. */
let send: Send | null = null;

export function setAccountSocketSender(sender: Send | null) {
  send = sender;
}

/** Sent if the account's socket is open; dropped otherwise (it only tells friends' open screens). */
export function sendToAccount(message: AccountClientMessage) {
  send?.(message);
}
