"use client";

import { useState } from "react";
import { BadgeCheck, Check, Crown, CircleUserRound, Skull, Sun, Vote } from "lucide-react";
import { AuthButton } from "@/components/account-button";
import { useI18n } from "@/components/i18n-provider";
import { RoleName } from "@/components/game/role-chip";
import { RoleCard } from "@/components/game/role-card";
import { AddFriendButton, ProfileDialog, type ProfileTarget } from "@/components/friends/room-friends";
import { Avatar } from "@/components/room-context";
import { TimerDisplay } from "@/components/vote-timer";
import { useGameTheme } from "@/hooks/use-game-theme";
import { AutoDay, AutoNight, DeckCard, LookButton, MayorRace, NarratorCard, Spectator, TurnPanel } from "@/components/phone/auto-game";
import { Skeleton } from "@/components/skeletons";
import { format } from "@/lib/i18n/config";
import { useSession } from "@/lib/session";
import { type ClientMessage, type PlayerView } from "@/lib/protocol";
import { Button } from "@/components/ui/button";
import { PauseBanner } from "@/components/game/lead";

/** The phone during a game: public status, the player's own card, the table. */
export function InGame({
  view,
  live,
  act,
  send,
  lead,
}: {
  /** Set when this seat can ask the others to be friends (signed in): offered once the game is over. */
  send: ((msg: ClientMessage) => void) | null;
  view: PlayerView;
  /** The view is the server's current one: until then, nothing on it can be trusted to be this game's. */
  live: boolean;
  /** Votes, turns played on the phone, running for Mayor. */
  act: (msg: ClientMessage) => void;
  /** The leading device's tools, shown at the top (without a game master). */
  lead?: React.ReactNode;
}) {
  const onVote = (targetId: string | null) => act({ type: "cast-vote", targetId });
  const { dict } = useI18n();
  const [profile, setProfile] = useState<ProfileTarget | null>(null);
  const info = view.info!;
  const game = view.game!;
  const me = view.me!;
  const session = useSession();
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? "?";
  const dead = new Map(game.dead.map((d) => [d.playerId, d.role]));
  const isNight = game.phase.kind === "night" && !game.prologue;
  useGameTheme(isNight);
  const t = dict.play;

  // A card from a finished game would lie: show none until the room confirms this one.
  if (!live) {
    return (
      <section role="status" className="flex flex-col items-center gap-4 py-2 text-center">
        <Skeleton className="aspect-[5/7] w-full max-w-[18rem] rounded-3xl" />
        <p className="text-muted-foreground">{t.checkingCard}</p>
      </section>
    );
  }

  const leading = (
    <>
      <PauseBanner view={view} />
      {lead}
      <NarratorCard view={view} send={act} />
    </>
  );

  if (isNight && !game.winner) {
    // Dead without a game master: the whole game to watch.
    if (view.spectate) {
      return (
        <>
          {leading}
          <Spectator view={view} />
        </>
      );
    }
    if (view.auto) {
      return (
        <>
          {leading}
          <AutoNight view={view} send={act} />
        </>
      );
    }
    // Eyes closed, phones on the table: the game master reads whose seat it is from across the room.
    // When it's their turn, players may also play it here instead of pointing (never required).
    return (
      <>
        <section aria-label={t.nightName} className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
          {/* The initials are sized from the text around them. */}
          <div className="text-4xl">
            <Avatar playerId={me.id} name={me.name} className="size-24" />
          </div>
          <p className="font-display text-5xl font-bold break-words text-balance">{me.name}</p>
        </section>
        {view.turn && <TurnPanel view={view} turn={view.turn} send={act} />}
      </>
    );
  }

  return (
    <>
      {leading}
      {game.winner ? (
        <section className="card flex flex-col items-center gap-2 p-6 text-center">
          <p className="font-display text-2xl font-bold">
            {game.winner.team ? dict.game.steps["game-over"].wins[game.winner.team] : dict.game.steps["game-over"].draw}
          </p>
          <p className={`text-lg font-semibold ${game.winner.playerIds.includes(me.id) ? "text-ok" : "text-primary"}`}>
            {game.winner.playerIds.includes(me.id) ? t.youWin : t.youLose}
          </p>
          {/* A guest who signs in now still has this game counted: the seat
              becomes the account's, and the room saves the result again. */}
          {session?.stats && !session.account && !me.account && (
            <AuthButton
              to="in"
              variant="link"
              className="mt-1 h-auto p-0 text-sm font-normal whitespace-normal text-muted-foreground underline"
            >
              <CircleUserRound aria-hidden className="size-4 shrink-0" />
              {game.winner.playerIds.includes(me.id) ? dict.account.keepWin : dict.account.keepGame}
            </AuthButton>
          )}
        </section>
      ) : (
        <p className="flex items-center justify-center gap-2 text-muted-foreground">
          <Sun aria-hidden className="size-4" />
          {game.prologue ? dict.game.story.prologue.title : format(dict.game.day, { n: game.phase.number })}
        </p>
      )}

      {!game.winner && <TimerDisplay />}

      {!game.winner && (view.auto ? <AutoDay view={view} send={act} /> : view.turn && <TurnPanel view={view} turn={view.turn} send={act} />)}

      {view.ballot && !game.winner && <PhoneBallotCard view={view} onVote={onVote} />}

      {!game.winner && <MayorRace view={view} send={act} />}

      {!info.alive && !game.winner && (
        <p role="status" className="rounded-xl bg-surface-2 px-4 py-3 text-center">
          {t.card.dead}
        </p>
      )}

      <RoleCard
        info={info}
        loverName={info.loverId ? nameOf(info.loverId) : null}
        alwaysShown={!!game.winner}
        // Everyone knows it already: a villager on both sides, or turned face up at death.
        faceUp={info.role === "villager-villager" || !!dead.get(me.id)}
      />
      {view.auto?.look?.show === "card" && <LookButton view={view} send={act} />}

      <DeckCard view={view} />
      {view.spectate && !game.winner && <Spectator view={view} />}

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">{t.roomPlayers}</h2>
        <ul className="flex flex-col gap-1">
          {view.players.map((p) => {
            const isDead = dead.has(p.id);
            const role = game.roles?.[p.id] ?? dead.get(p.id) ?? game.known?.[p.id] ?? null;
            const group = game.groups?.[p.id];
            return (
              <li
                key={p.id}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${p.id === me.id ? "bg-surface-2" : ""} ${isDead ? "opacity-50" : ""}`}
              >
                {p.account ? (
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setProfile({ playerId: p.id, name: p.name })}>
                    <Avatar playerId={p.id} name={p.name} className="size-7" />
                    <span className={`min-w-0 truncate ${isDead ? "line-through" : ""}`}>{p.name}</span>
                    <BadgeCheck aria-label={dict.host.accountPlayer} className="size-3.5 shrink-0 text-ok" />
                  </button>
                ) : (
                  <>
                    <Avatar playerId={p.id} name={p.name} className="size-7" />
                    <span className={`min-w-0 flex-1 truncate ${isDead ? "line-through" : ""}`}>{p.name}</span>
                  </>
                )}
                {game.mayorId === p.id && <Crown aria-label={dict.game.mayor} className="size-4 text-moon" />}
                {isDead && <Skull aria-label={dict.game.dead} className="size-4" />}
                {group && (
                  <span aria-label={dict.setup.groups} className="rounded-full bg-surface-2 px-2 text-xs font-semibold text-muted-foreground">
                    {group === "a" ? dict.setup.groupA : dict.setup.groupB}
                  </span>
                )}
                {role && <RoleName role={role} className="text-sm" />}
                {game.winner && send && p.account && p.id !== me.id && (
                  <AddFriendButton name={p.name} playerId={p.id} send={send} className="-my-1 size-7" />
                )}
              </li>
            );
          })}
        </ul>
        <ProfileDialog target={profile} onClose={() => setProfile(null)} send={act} />
      </section>
    </>
  );
}
/** The day's vote or the Mayor's election on a phone, while the game master has it open. */
export function PhoneBallotCard({ view, onVote }: { view: PlayerView; onVote: (targetId: string | null) => void }) {
  const { dict } = useI18n();
  const t = dict.ballot;
  const ballot = view.ballot!;
  const me = view.me!;
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? "?";
  // A vote counts once confirmed. undefined: nothing picked; null: "no one".
  const [draft, setDraft] = useState<string | null | undefined>(undefined);
  const current = ballot.voted ? ballot.targetId : undefined;
  const picked = draft === undefined ? current : draft;

  if (!ballot.canVote) {
    return (
      <p role="status" className="rounded-xl bg-surface-2 px-4 py-3 text-center">
        {t.phoneCannotVote}
      </p>
    );
  }

  const election = ballot.kind === "mayor";
  // Candidates may vote for themselves; nobody votes against themself.
  const choices: { id: string | null; label: string }[] = election
    ? ballot.candidateIds.map((id) => ({ id, label: nameOf(id) }))
    : [
        ...ballot.candidateIds.filter((id) => id !== me.id).map((id) => ({ id, label: nameOf(id) })),
        { id: null, label: t.noOne },
      ];

  return (
    <section className="card flex flex-col gap-3 p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Vote aria-hidden className="size-5" />
        {election ? t.mayorTitle : t.phoneTitle}
      </h2>
      <p className="text-sm text-muted-foreground">
        {ballot.voted
          ? format(election ? t.mayorVoted : t.phoneVoted, { name: ballot.targetId ? nameOf(ballot.targetId) : t.noOne })
          : election
            ? t.mayorHint
            : t.phoneHint}
      </p>
      <ul className="flex flex-col gap-2">
        {choices.map((choice) => {
          const selected = picked === choice.id;
          return (
            <li key={choice.id ?? "nobody"}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => setDraft(choice.id)}
                className={`flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left text-lg font-semibold ${
                  selected ? "border-primary bg-primary/10" : "border-line bg-surface-2"
                }`}
              >
                {choice.id ? (
                  <Avatar playerId={choice.id} name={choice.label} className="size-9" />
                ) : (
                  <span aria-hidden className="grid size-9 place-items-center rounded-full bg-surface text-muted-foreground">
                    –
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate">{choice.label}</span>
                {selected && <Check aria-hidden className="size-5 text-primary" />}
              </button>
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        className="h-12 text-base"
        disabled={picked === undefined || picked === current}
        onClick={() => {
          onVote(picked!);
          setDraft(undefined);
        }}
      >
        <Check aria-hidden className="size-5" />
        {dict.game.confirm}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {format(t.progress, { answered: ballot.answered, voters: ballot.voters })}
      </p>
    </section>
  );
}
