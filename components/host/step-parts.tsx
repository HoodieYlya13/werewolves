"use client";

import { createContext, useContext, useState } from "react";
import { Megaphone, Moon, Quote, Sun } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { PlayerGrid, toggle } from "@/components/host/player-grid";
import { Button } from "@/components/ui/button";
import { format } from "@/lib/i18n/config";
import type { Action, GameState, PhaseRef, Player, StepKind } from "@/lib/engine";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import type { StepOf } from "@/lib/steps";

export type Act = (action: Action) => void;

export type StepProps<K extends StepKind> = { game: GameState; step: StepOf<K>; act: Act };

/** The game master's screen for a step, and how a phone's answer to it reads. */
export type StepScreen<K extends StepKind> = {
  Screen: (props: StepProps<K>) => React.ReactNode;
  /** A phone's answer in words, for the game master to validate. Unset: the players picked, or yes or no. */
  describe?: (game: GameState, step: StepOf<K>, action: Action, dict: Dictionary) => string;
};

export type StepScreens<K extends StepKind> = { [P in K]: StepScreen<P> };

/** The step was started over (Undo) or came back by Undo: what it shows by itself, it shows on a tap instead. */
export const Restarted = createContext(false);

/** The narrator's words, set apart like a script: read them out as they are. */
/** Rewrites a line that calls a role, when the Actor plays it (see `actorCall`). */
export const Caller = createContext<(line: string) => string>((line) => line);

export function Say({ children }: { children: React.ReactNode }) {
  const { dict } = useI18n();
  const call = useContext(Caller);
  if (typeof children === "string") children = call(children);
  return (
    <figure className="relative overflow-hidden rounded-3xl bg-linear-to-br from-moon/15 via-surface-2/80 to-surface-2/80 px-6 pt-4 pb-5 ring-1 ring-moon/20 sm:px-7">
      {/* A big quotation mark behind the text, barely there. */}
      <Quote aria-hidden className="pointer-events-none absolute top-3 right-4 size-14 fill-current text-moon/10" strokeWidth={0} />
      <figcaption className="relative mb-2 flex items-center gap-1.5 text-[0.7rem] font-semibold tracking-[0.2em] text-moon uppercase">
        <Megaphone aria-hidden className="size-3.5" />
        {dict.game.say}
      </figcaption>
      <blockquote className="relative text-xl leading-relaxed text-pretty sm:text-2xl">{children}</blockquote>
    </figure>
  );
}

export function Do({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>;
}

/** The step's main way on: the whole width on phones, its own size from tablets up. */
export function NextButton({ onClick, label }: { onClick: () => void; label?: string }) {
  const { dict } = useI18n();
  return (
    <Button type="button" className="h-12 w-full px-8 text-base sm:w-auto sm:self-start" onClick={onClick}>
      {label ?? dict.game.continue}
    </Button>
  );
}

export function ContinueButton({ act, label }: { act: Act; label?: string }) {
  return <NextButton label={label} onClick={() => act({ type: "continue" })} />;
}

export function ConfirmButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const { dict } = useI18n();
  return (
    <Button type="button" className="h-12 px-5 text-base sm:px-8" disabled={disabled} onClick={onClick}>
      {dict.game.confirm}
    </Button>
  );
}

/** Starts the next night or day: the step that turns the screen dark or light. */
export function StartPhaseButton({ act, next }: { act: Act; next: PhaseRef }) {
  const { dict } = useI18n();
  const Icon = next.kind === "night" ? Moon : Sun;
  return (
    <Button type="button" className="h-12 w-full px-8 text-base sm:w-auto sm:self-start" onClick={() => act({ type: "continue" })}>
      <Icon aria-hidden className="size-5" />
      {format(dict.game.story.start[next.kind], { n: next.number })}
    </Button>
  );
}

export const living = (game: GameState) => game.players.filter((p) => p.alive);
export const nameOf = (game: GameState, id: string) => game.players.find((p) => p.id === id)?.name ?? "?";

/**
 * Pick living players, then confirm. Exactly `count` by default; `min` allows
 * fewer, and `skip` adds a button that confirms with nobody.
 */
export function PickPlayers({
  game,
  count,
  min = count,
  isDisabled,
  onConfirm,
  skip,
  extra,
  initial = [],
  players,
}: {
  game: GameState;
  count: number;
  min?: number;
  isDisabled?: (p: Player) => boolean;
  onConfirm: (ids: string[]) => void;
  skip?: string;
  extra?: React.ReactNode;
  /** Already selected when the step opens (back from an undo). */
  initial?: string[];
  /** Who can be picked: everyone alive by default. */
  players?: Player[];
}) {
  const [selected, setSelected] = useState<string[]>(initial);
  return (
    <>
      <PlayerGrid
        game={game}
        players={players ?? living(game)}
        selected={selected}
        onToggle={(id) => setSelected((s) => toggle(s, id, count))}
        isDisabled={isDisabled}
      />
      <div className="flex flex-wrap gap-2 [&>*]:grow sm:[&>*]:grow-0">
        <ConfirmButton
          disabled={selected.length < Math.max(min, 1) || selected.length > count}
          onClick={() => onConfirm(selected)}
        />
        {skip && (
          <Button type="button" variant="outline" className="h-12" onClick={() => onConfirm([])}>
            {skip}
          </Button>
        )}
        {extra}
      </div>
    </>
  );
}

/** For steps added after the base game, picks are sent as a generic "pick" action. */
export const pickOf = (targetIds: string[]): Action => ({ type: "pick", targetIds });
export const names = (game: GameState, ids: string[]) => ids.map((id) => nameOf(game, id)).join(", ");

export function ChoiceButtons({ options }: { options: { label: React.ReactNode; onClick: () => void; ghost?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-2 [&>*]:grow sm:[&>*]:grow-0">
      {options.map((o, i) => (
        <Button key={i} type="button" variant={o.ghost ? "outline" : "default"} className="h-auto min-h-12 px-6 text-base whitespace-normal" onClick={o.onClick}>
          {o.label}
        </Button>
      ))}
    </div>
  );
}
