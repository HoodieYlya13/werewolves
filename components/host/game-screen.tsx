"use client";

import { useState } from "react";
import { BadgeCheck, Crown, Eye, EyeOff, Heart, Moon, Music, PawPrint, Pencil, Skull, Sun, Undo2, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { CloseRoomButton } from "@/components/host/close-room-button";
import { PlayerEditor } from "@/components/host/player-editor";
import { RejoinRequests } from "@/components/host/rejoin-requests";
import { RoleName, teamColor } from "@/components/host/role-chip";
import { Avatar, useRoomContext } from "@/components/room-context";
import { StepPanel } from "@/components/host/step-panel";
import { format } from "@/lib/i18n/config";
import { isWolf, remainingTeams, roles, teamOf, type GameEvent, type GameState } from "@/lib/engine";
import type { ClientMessage, ErrorCode, HostView } from "@/lib/protocol";

const HIDE_ROLES_KEY = "ww:hide-roles";

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
  const [hideRoles, setHideRoles] = useState(() => {
    try {
      return localStorage.getItem(HIDE_ROLES_KEY) === "1";
    } catch {
      return false;
    }
  });

  function toggleRoles() {
    setHideRoles(!hideRoles);
    try {
      localStorage.setItem(HIDE_ROLES_KEY, hideRoles ? "0" : "1");
    } catch {}
  }

  function endGame() {
    if (over || window.confirm(dict.game.endGameConfirm)) send({ type: "end-game" });
  }

  return (
    <main
      data-hide-roles={hideRoles || undefined}
      className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
    >
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
              <p className="text-sm text-muted">
                {isNight ? dict.game.nightHint : game.phase.number === 0 ? dict.game.dayZeroHint : dict.game.dayHint}
              </p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-ghost h-10 px-4"
              aria-pressed={hideRoles}
              onClick={toggleRoles}
            >
              {hideRoles ? <Eye aria-hidden className="size-4" /> : <EyeOff aria-hidden className="size-4" />}
              {hideRoles ? dict.game.showRoles : dict.game.hideRoles}
            </button>
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
            <CloseRoomButton className="h-10 px-4" />
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-accent/10 px-4 py-2 text-sm text-accent">
            {dict.errors[error]}
          </p>
        )}

        <RejoinRequests />

        <section className="flex flex-col gap-5">
          <StepPanel
            key={view.actionCount}
            game={game}
            act={(action) => send({ type: "game-action", action })}
          />
        </section>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto lg:pb-1">
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
      {game.villagePowersLost && <p className="mb-2 text-sm text-accent">{dict.game.powersLost}</p>}
      <ul className="secret-role flex flex-wrap gap-2">
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
  const [editing, setEditing] = useState<string | null>(null);
  const { players: roomPlayers } = useRoomContext();
  const leftIds = new Set(roomPlayers.filter((p) => p.left).map((p) => p.id));
  const accountIds = new Set(roomPlayers.filter((p) => p.account).map((p) => p.id));
  return (
    <section className="card p-4">
      <h2 className="mb-2 text-sm font-medium tracking-wide text-muted uppercase">{dict.game.players}</h2>
      <ol className="flex flex-col gap-1">
        {game.players.map((p, i) => (
          <li key={p.id} className={`flex items-center gap-2 text-sm ${p.alive ? "" : "opacity-45"}`}>
            <span className="w-5 text-right font-mono text-xs text-muted">{i + 1}</span>
            <button
              type="button"
              className="group flex min-w-0 flex-1 items-center gap-2 text-left"
              title={accountIds.has(p.id) ? dict.host.accountPlayer : format(dict.host.editPlayer, { name: p.name })}
              // Account players' names and photos are theirs to change.
              disabled={accountIds.has(p.id)}
              onClick={() => setEditing(p.id)}
            >
              <Avatar playerId={p.id} name={p.name} className="size-6" />
              <span className={`min-w-0 truncate font-medium ${p.alive ? "" : "line-through"}`}>{p.name}</span>
              {accountIds.has(p.id) ? (
                <BadgeCheck aria-label={dict.host.accountPlayer} className="size-3 shrink-0 text-ok" />
              ) : (
                <Pencil aria-hidden className="size-3 shrink-0 text-muted opacity-0 group-hover:opacity-100" />
              )}
            </button>
            {leftIds.has(p.id) && <span className="text-xs text-accent">{dict.host.left}</span>}
            {game.lovers?.includes(p.id) && (
              <Heart aria-label={dict.game.lover} className="secret-role size-3.5 fill-pink-500 text-pink-500" />
            )}
            {game.sheriffId === p.id && <Crown aria-label={dict.game.sheriff} className="size-3.5 text-moon" />}
            {p.flags.charmed && (
              <Music aria-label={dict.game.charmed} className="secret-role size-3.5 text-emerald-500" />
            )}
            {isWolf(p) && roles[p.role].team !== "wolves" && p.role !== "white-werewolf" && (
              <PawPrint aria-hidden className="secret-role size-3.5 text-accent" />
            )}
            {!p.alive && <Skull aria-label={dict.game.dead} className="size-3.5" />}
            <RoleName role={p.role} className="text-xs" secret />
          </li>
        ))}
      </ol>
      {editing && <PlayerEditor playerId={editing} onClose={() => setEditing(null)} />}
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
      <ol className="secret-role mt-3 flex flex-col gap-1.5 text-sm">
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
    case "actor":
      return format(t.actor, { role: dict.roles[event.role].name });
    case "wolf-hound":
      return format(t["wolf-hound"], {
        name: name(event.playerId),
        side: dict.game.steps["wolf-hound"][event.side],
      });
    case "model":
      return format(t.model, { name: name(event.playerId), model: name(event.modelId) });
    case "turned-wolf":
      return format(t["turned-wolf"], { name: name(event.playerId) });
    case "protected":
    case "infected":
    case "big-bad-wolf":
    case "white-werewolf":
    case "raven":
      return format(t[event.type], { target: name(event.targetId) });
    case "fox":
      return format(t.fox, { target: name(event.centerId), result: event.hasWolf ? t.foxYes : t.foxNo });
    case "charmed":
      return format(t.charmed, { names: event.targetIds.map(name).join(", ") });
    case "elder-survived":
      return format(t["elder-survived"], { name: name(event.playerId) });
    case "powers-lost":
      return t["powers-lost"];
    case "idiot-revealed":
      return format(t["idiot-revealed"], { name: name(event.playerId) });
    case "servant":
      return format(t.servant, { name: name(event.playerId), role: dict.roles[event.role].name });
    case "scapegoat":
      return event.voterIds.length > 0
        ? format(t.scapegoat, { names: event.voterIds.map(name).join(", ") })
        : t.scapegoatNobody;
    case "second-vote":
      return t["second-vote"];
  }
}
