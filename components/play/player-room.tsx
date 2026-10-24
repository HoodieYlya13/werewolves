"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Crown, Moon, Skull, Sun } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { RoleName } from "@/components/host/role-chip";
import { RoleCard } from "@/components/play/role-card";
import { ThemedI18n } from "@/components/themed-i18n";
import { ConnectionBanner, FatalError } from "@/components/room-status";
import { useRoom } from "@/hooks/use-room";
import { format } from "@/lib/i18n/config";
import { MAX_NAME_LENGTH, type PlayerView } from "@/lib/protocol";

export function PlayerRoom() {
  const { code } = useParams<{ code: string }>();
  return <PlayerScreen key={code} code={code} />;
}

function PlayerScreen({ code }: { code: string }) {
  const { dict } = useI18n();
  const { view, error, status, send } = useRoom<PlayerView>(code, "player");
  const [name, setName] = useState("");

  if (error === "room-not-found") return <FatalError code={error} />;

  const me = view?.me;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-10">
      <ConnectionBanner status={status} />
      <p className="text-center font-mono text-sm tracking-[0.3em] text-muted">{code}</p>

      {error === "removed" && (
        <p role="alert" className="text-center text-accent">
          {dict.errors.removed}
        </p>
      )}

      {view && !me && (
        <form
          className="card flex flex-col gap-3 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) send({ type: "join", name });
          }}
        >
          <label htmlFor="name" className="font-medium">
            {dict.play.yourName}
          </label>
          <input
            id="name"
            className="input text-lg"
            autoComplete="nickname"
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="btn" disabled={!name.trim()}>
            {dict.play.join}
          </button>
          {(error === "name-taken" || error === "invalid-name" || error === "room-locked") && (
            <p role="alert" className="text-sm text-accent">
              {dict.errors[error]}
            </p>
          )}
        </form>
      )}

      {me && !view?.info && (
        <section className="card flex flex-col items-center gap-2 p-6 text-center">
          <p className="text-xl font-semibold">{format(dict.play.joinedAs, { name: me.name })}</p>
          <p className="text-muted">{dict.play.waiting}</p>
        </section>
      )}

      {me && view?.info && view.game && (
        <ThemedI18n theme={view.game.theme}>
          <InGame view={view} />
        </ThemedI18n>
      )}

      {view && !view.game && view.players.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted">{dict.play.roomPlayers}</h2>
          <ul className="flex flex-wrap gap-2">
            {view.players.map((p) => (
              <li
                key={p.id}
                className={`rounded-full px-3 py-1 text-sm ${p.id === me?.id ? "bg-accent text-accent-fg" : "bg-surface-2"}`}
              >
                {p.name}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

/** The phone during a game: public status, the player's own card, the table. */
function InGame({ view }: { view: PlayerView }) {
  const { dict } = useI18n();
  const info = view.info!;
  const game = view.game!;
  const me = view.me!;
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? "?";
  const dead = new Map(game.dead.map((d) => [d.playerId, d.role]));
  const isNight = game.phase.kind === "night";
  const t = dict.play;

  return (
    <>
      {game.winner ? (
        <section className="card flex flex-col items-center gap-2 p-6 text-center">
          <p className="font-display text-2xl font-bold">
            {game.winner.team ? dict.game.steps["game-over"].wins[game.winner.team] : dict.game.steps["game-over"].draw}
          </p>
          <p className={`text-lg font-semibold ${game.winner.playerIds.includes(me.id) ? "text-ok" : "text-accent"}`}>
            {game.winner.playerIds.includes(me.id) ? t.youWin : t.youLose}
          </p>
        </section>
      ) : (
        <p className="flex items-center justify-center gap-2 text-muted">
          {isNight ? <Moon aria-hidden className="size-4" /> : <Sun aria-hidden className="size-4" />}
          {format(isNight ? dict.game.night : dict.game.day, { n: game.phase.number })}
        </p>
      )}

      {!info.alive && !game.winner && (
        <p role="status" className="rounded-xl bg-surface-2 px-4 py-3 text-center">
          {t.card.dead}
        </p>
      )}

      <RoleCard info={info} loverName={info.loverId ? nameOf(info.loverId) : null} alwaysShown={!!game.winner} />

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">{t.roomPlayers}</h2>
        <ul className="flex flex-col gap-1">
          {view.players.map((p) => {
            const isDead = dead.has(p.id);
            const role = game.roles?.[p.id] ?? dead.get(p.id) ?? null;
            return (
              <li
                key={p.id}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${p.id === me.id ? "bg-surface-2" : ""} ${isDead ? "opacity-50" : ""}`}
              >
                <span className={`min-w-0 flex-1 truncate ${isDead ? "line-through" : ""}`}>{p.name}</span>
                {game.sheriffId === p.id && <Crown aria-label={dict.game.sheriff} className="size-4 text-moon" />}
                {isDead && <Skull aria-label={dict.game.dead} className="size-4" />}
                {role && <RoleName role={role} className="text-sm" />}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
