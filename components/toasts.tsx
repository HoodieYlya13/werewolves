"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import type { ErrorCode, HostView } from "@/lib/protocol";

/** Shows the room's latest error as a toast when it's one of `codes` (a constant list). */
export function useErrorToast(error: ErrorCode | null, codes: readonly ErrorCode[]) {
  const { dict } = useI18n();
  useEffect(() => {
    if (error && codes.includes(error)) toast.error(dict.errors[error], { id: error });
  }, [error, codes, dict]);
}

/** Tells the game master when someone asks to come back or leaves mid-game. */
export function useHostToasts(view: HostView | null) {
  const { dict } = useI18n();
  const seen = useRef<{ requests: Set<string>; left: Set<string> } | null>(null);
  useEffect(() => {
    if (!view) return;
    const previous = seen.current;
    seen.current = {
      requests: new Set(view.requests.map((r) => r.id)),
      left: new Set(view.players.filter((p) => p.left).map((p) => p.id)),
    };
    // Nothing to announce about what was already there when the screen opened.
    if (!previous) return;
    for (const r of view.requests) {
      if (!previous.requests.has(r.id)) toast(format(dict.host.toastRejoin, { name: r.name }));
    }
    for (const p of view.players) {
      if (p.left && !previous.left.has(p.id)) toast(format(dict.host.toastLeft, { name: p.name }));
    }
  }, [view, dict]);
}
