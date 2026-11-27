"use client";

import { Smartphone } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useRoomContext } from "@/components/room-context";
import { Caller, NextButton, Restarted, Say, nameOf, names } from "@/components/host/step-parts";
import { Button } from "@/components/ui/button";
import { format } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { actorCall, actorTurn } from "@/lib/auto";
import { nightFalls, type Action, type GameState } from "@/lib/engine";
import { screenOf } from "@/lib/steps/screens";

/**
 * Lines that close the last turn or open the night, read on their own before
 * the step, one Continue each, so every turn starts by itself. Only on this
 * screen: the game doesn't wait for them.
 */
export function leadLines(game: GameState, dict: Dictionary): string[] {
  const sleeper = game.backToSleep;
  return [
    sleeper && (sleeper === "wolves" ? dict.game.wolvesSleep : format(dict.game.sleep, { role: dict.roles[sleeper].name })),
    // Every night opens with the whole village closing their eyes.
    nightFalls(game) && dict.game.nightFalls,
  ].filter((line): line is string => !!line);
}

/**
 * What the game master reads and taps for the current step. The parent keys it
 * by action count, so any local selection resets on each new step, and keeps
 * how many lead lines were read (the soundtrack waits for them). `onTouched`:
 * the step itself was tapped, so Undo first starts it over. `restarted`: see
 * `Restarted`.
 */
export function StepPanel({
  game,
  act,
  read,
  onRead,
  onTouched,
  restarted,
}: {
  game: GameState;
  act: (action: Action) => void;
  read: number;
  onRead: (read: number) => void;
  onTouched: () => void;
  restarted: boolean;
}) {
  const { dict } = useI18n();
  const lead = leadLines(game, dict);

  if (read < lead.length) {
    return (
      <>
        <Say>{lead[read]}</Say>
        <NextButton
          onClick={() => {
            onRead(read + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </>
    );
  }
  return (
    <div
      className="contents"
      onClickCapture={(e) => {
        if ((e.target as HTMLElement).closest("button, input, label, select, a")) onTouched();
      }}
    >
      <Restarted.Provider value={restarted}>
        <Caller.Provider value={(line) => actorCall(dict, game, line)}>
          <StepContent game={game} act={act} />
        </Caller.Provider>
      </Restarted.Provider>
    </div>
  );
}

function StepContent({ game, act }: { game: GameState; act: (action: Action) => void }) {
  const { dict } = useI18n();
  const borrowed = actorTurn(game);
  return (
    <>
      {borrowed && (
        <p className="rounded-xl bg-surface-2 px-4 py-2 text-sm">
          {format(dict.game.steps.actor.borrowed, { name: nameOf(game, (game.step as { playerId: string }).playerId), role: dict.roles[borrowed].name })}
        </p>
      )}
      <PhonePlays game={game} act={act} />
      <StepBody game={game} act={act} />
    </>
  );
}

/**
 * What players chose on their phones for this step, if they did (never
 * asked for): the game master validates it, or plays the step as usual.
 */
function PhonePlays({ game, act }: { game: GameState; act: (action: Action) => void }) {
  const { dict } = useI18n();
  const { phonePlays } = useRoomContext();
  const step = game.step;
  // The Witch's answers come one question at a time, on her own step.
  if (!phonePlays || step.kind === "witch") return null;
  const rows: { key: string; label: string; action: Action }[] = [];
  if (step.kind === "wolves") {
    const votes = new Map<string, number>();
    for (const id of step.playerIds) {
      const target = phonePlays.wolfPicks[id];
      if (target) votes.set(target, (votes.get(target) ?? 0) + 1);
    }
    for (const [target, count] of [...votes].sort((a, b) => b[1] - a[1])) {
      rows.push({ key: target, label: format(dict.lead.wolvesVotes, { name: nameOf(game, target), count }), action: { type: "wolves", targetId: target } });
    }
  } else {
    for (const [id, action] of Object.entries(phonePlays.actions)) {
      rows.push({ key: id, label: `${nameOf(game, id)} · ${describe(game, action, dict)}`, action });
    }
  }
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-moon/40 bg-moon/10 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-moon">
        <Smartphone aria-hidden className="size-4" />
        {dict.lead.fromPhones}
      </p>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.key} className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 flex-1 font-medium">{row.label}</span>
            <Button type="button" className="h-10 px-4" onClick={() => act(row.action)}>
              {dict.lead.validate}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A phone's choice in words, for the game master: the step's own wording, or the players picked, or yes or no. */
function describe(game: GameState, action: Action, dict: Dictionary): string {
  const step = game.step;
  const own = screenOf(step).describe;
  if (own) return own(game, step, action, dict);
  switch (action.type) {
    case "seer":
    case "hunter":
      return action.targetId ? nameOf(game, action.targetId) : "—";
    case "mayor":
      return nameOf(game, action.targetId);
    case "cupid":
      return action.lovers ? names(game, action.lovers) : "—";
    case "pick":
      return action.targetIds.length ? names(game, action.targetIds) : "—";
    case "choose":
      return action.value ? dict.auto.yes : dict.auto.no;
    default:
      return "";
  }
}

function StepBody({ game, act }: { game: GameState; act: (action: Action) => void }) {
  const step = game.step;
  const { Screen } = screenOf(step);
  return <Screen game={game} step={step} act={act} />;
}
