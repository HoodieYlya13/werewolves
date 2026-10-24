"use client";

import { Crown, Heart, Moon, Skull, Sun, Undo2, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { RoleName, teamColor } from "@/components/host/role-chip";
import { StepPanel } from "@/components/host/step-panel";
import { format } from "@/lib/i18n/config";
import { remainingTeams, teamOf, type GameEvent, type GameState } from "@/lib/engine";
import type { ClientMessage, ErrorCode, HostView } from "@/lib/protocol";

export function GameScreen({
  view,
  game,
  error,
  send,
}: {
  view: HostView;
  game: GameState;
  error: ErrorCode | null;
  send: (message: ClientMessage) => void;
}) {
  const { dict } = useI18n();
  const isNight = game.phase.kind === "night";
  const over = game.step.kind === "game-over";

  function endGame() {
    if (over || window.confirm(dict.game.endGameConfirm)) send({ type: "end-game" });
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            {isNight ? (
              <Moon aria-hidden className="size-7 text-moon" />
            ) : (
              <Sun aria-hidden className="size-7 text-moon" />
            )}
            <div>
              <h1 className="font-display text-2xl leading-tight font-bold">
                {format(isNight ? dict.game.night : dict.game.day, { n: game.phase.number })}
              </h1>
              <p className="text-sm text-muted">{isNight ? dict.game.nightHint : dict.game.dayHint}</p>
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              className="btn btn-ghost h-10 px-4"
              disabled={view.actionCount === 0}
              onClick={() => send({ type: "undo" })}
            >
              <Undo2 aria-hidden className="size-4" />
              {dict.game.undo}
            </button>
            <button type="button" className="btn btn-ghost h-10 px-4" onClick={endGame}>
              <X aria-hidden className="size-4" />
              {over ? dict.game.steps["game-over"].newGame : dict.game.endGame}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-accent/10 px-4 py-2 text-sm text-accent">
            {dict.errors[error]}
          </p>
        )}

        <section className="flex flex-col gap-5">
          <StepPanel
            key={view.actionCount}
            game={game}
            act={(action) => send({ type: "game-action", action })}
          />
        </section>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <Remaining game={game} />
        <PlayersPanel game={game} />
        <Timeline game={game} />
      </aside>
    </main>
  );
}

function Remaining({ game }: { game: GameState }) {
  const { dict } = useI18n();
  const living = game.players.filter((p) => p.alive);
  return (
    <section className="card p-4">
      <h2 className="mb-2 text-sm font-medium tracking-wide text-muted uppercase">{dict.game.remaining}</h2>
      <ul className="flex flex-wrap gap-2">
        {remainingTeams(game).map((team) => (
          <li key={team} className={`rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold ${teamColor[team]}`}>
            {dict.teams[team]} · {living.filter((p) => teamOf(game, p) === team).length}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlayersPanel({ game }: { game: GameState }) {
  const { dict } = useI18n();
  return (
    <section className="card p-4">
      <h2 className="mb-2 text-sm font-medium tracking-wide text-muted uppercase">{dict.game.players}</h2>
      <ol className="flex flex-col gap-1">
        {game.players.map((p, i) => (
          <li key={p.id} className={`flex items-center gap-2 text-sm ${p.alive ? "" : "opacity-45"}`}>
            <span className="w-5 text-right font-mono text-xs text-muted">{i + 1}</span>
            <span className={`min-w-0 flex-1 truncate font-medium ${p.alive ? "" : "line-through"}`}>{p.name}</span>
            {game.lovers?.includes(p.id) && (
              <Heart aria-label={dict.game.lover} className="size-3.5 fill-pink-500 text-pink-500" />
            )}
            {game.sheriffId === p.id && <Crown aria-label={dict.game.sheriff} className="size-3.5 text-moon" />}
            {!p.alive && <Skull aria-label={dict.game.dead} className="size-3.5" />}
            <RoleName role={p.role} className="text-xs" />
          </li>
        ))}
      </ol>
    </section>
  );
}

function Timeline({ game }: { game: GameState }) {
  const { dict } = useI18n();
  if (game.events.length === 0) return null;
  return (
    <details className="card p-4">
      <summary className="cursor-pointer text-sm font-medium tracking-wide text-muted uppercase">
        {dict.game.timeline}
      </summary>
      <ol className="mt-3 flex flex-col gap-1.5 text-sm">
        {[...game.events].reverse().map((e, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-8 shrink-0 font-mono text-xs text-muted">
              {e.phase.kind === "night" ? dict.game.nightShort : dict.game.dayShort}
              {e.phase.number}
            </span>
            <span>
              <EventText game={game} event={e} />
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}

function EventText({ game, event }: { game: GameState; event: GameEvent }) {
  const { dict } = useI18n();
  const t = dict.game.events;
  const name = (id: string) => game.players.find((p) => p.id === id)?.name ?? "?";
  switch (event.type) {
    case "thief-swap":
      return format(t["thief-swap"], { name: name(event.playerId), role: dict.roles[event.to].name });
    case "lovers":
      return format(t.lovers, { a: name(event.lovers[0]), b: name(event.lovers[1]) });
    case "seer":
      return format(t.seer, { target: name(event.targetId), role: dict.roles[event.role].name });
    case "wolves-target":
    case "witch-heal":
    case "witch-poison":
      return format(t[event.type], { target: name(event.targetId) });
    case "death":
      return format(t.death, { name: name(event.playerId), cause: dict.game.causes[event.cause] });
    case "sheriff":
      return format(t.sheriff, { name: name(event.playerId) });
    case "vote":
      return event.targetId ? format(t.vote, { target: name(event.targetId) }) : t.voteNobody;
  }
}
