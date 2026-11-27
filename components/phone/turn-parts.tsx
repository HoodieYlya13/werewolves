"use client";

import { Check } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { Send } from "@/components/room-context";
import { Button } from "@/components/ui/button";
import type { PhoneTurn } from "@/lib/auto";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import type { Action } from "@/lib/engine";
import type { PlayerView } from "@/lib/protocol";

export type PhoneTurnKind = PhoneTurn["kind"];
type TurnOf<K extends PhoneTurnKind> = Extract<PhoneTurn, { kind: K }>;

export type PhoneTurnProps<K extends PhoneTurnKind> = { view: PlayerView; turn: TurnOf<K>; send: Send };

/** How a phone shows one kind of turn. */
export type PhoneTurnScreen<K extends PhoneTurnKind> = {
  Screen: (props: PhoneTurnProps<K>) => React.ReactNode;
  /** The heading above the turn, if any. */
  title?: (dict: Dictionary, turn: TurnOf<K>) => string;
  /** News for this player alone: shown face down until held, then acknowledged. */
  isSecret?: boolean;
};

export type PhoneTurnScreens<K extends PhoneTurnKind> = { [Kind in K]: PhoneTurnScreen<Kind> };

/** Plays this phone's turn. */
export const play = (send: Send) => (action: Action) => send({ type: "play", action });

/** A choice only counts once confirmed: one stray tap never plays a turn. */
export function PlayButton({ ready, onClick, label }: { ready: boolean; onClick: () => void; label?: string }) {
  const { dict } = useI18n();
  return (
    <Button type="button" className="h-12 text-base" disabled={!ready} onClick={onClick}>
      <Check aria-hidden className="size-5" />
      {label ?? dict.game.confirm}
    </Button>
  );
}

/** A plain option that's picked, then confirmed. */
export function OptionButton({ on, onClick, children, className = "" }: { on: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-center font-semibold ${on ? "border-primary bg-primary/10" : "border-line bg-surface-2"} ${className}`}
    >
      {children}
    </button>
  );
}

/** Adds or removes `id`, keeping at most `max` picked (a single pick swaps). */
export function toggle(list: string[], id: string, max: number) {
  if (list.includes(id)) return list.filter((x) => x !== id);
  return max === 1 ? [id] : list.length < max ? [...list, id] : list;
}
