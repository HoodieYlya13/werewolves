"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import type { ErrorCode, HostView } from "@/lib/protocol";

/** Shows the room's latest error as a toast when it's one of `codes` (a constant list). */
export function useErrorToast(error: ErrorCode | null, codes: readonly ErrorCode[]) {
  const { dict } = useI18n();
  // Reads the current dictionary without re-showing the toast when it changes.
  const show = useEffectEvent((error: ErrorCode) => {
    if (codes.includes(error)) toast.error(dict.errors[error], { id: error });
  });
  useEffect(() => {
    if (error) show(error);
  }, [error]);
}

/** Tells the game master when someone leaves mid-game. Requests to come in have their own card. */
export function useHostToasts(view: HostView | null) {
  const { dict } = useI18n();
  const seen = useRef<Set<string> | null>(null);
  const say = useEffectEvent((name: string) => toast(format(dict.host.toastLeft, { name })));
  useEffect(() => {
    if (!view) return;
    const previous = seen.current;
    seen.current = new Set(view.players.filter((p) => p.left).map((p) => p.id));
    // Nothing to announce about what was already there when the screen opened.
    if (!previous) return;
    for (const p of view.players) {
      if (p.left && !previous.has(p.id)) say(p.name);
    }
  }, [view]);
}
