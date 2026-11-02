"use client";

import { useEffect, useState } from "react";
import { Check, Clock, Crown, Eye, FlaskConical, Hand, HeartCrack, Layers, Megaphone, Moon, Pause, Play, Skull, Volume2, VolumeX } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/components/i18n-provider";
import { RoleName } from "@/components/host/role-chip";
import { Timeline } from "@/components/host/game-screen";
import { Avatar, formatDuration, useRoomContext } from "@/components/room-context";
import { Button } from "@/components/ui/button";
import { primeVoice, useMutedVoice, useVoiceSupport, hushVoice } from "@/hooks/use-narrator";
import { pickAction, type PhoneTurn } from "@/lib/auto";
import { format } from "@/lib/i18n/config";
import { setMuted } from "@/lib/sound";
import type { ClientMessage, PlayerView } from "@/lib/protocol";

type Send = (message: ClientMessage) => void;

const useName = () => {
  const { players } = useRoomContext();
  return (id: string) => players.find((p) => p.id === id)?.name ?? "?";
};

/** Eyes closed: nothing on the screen, unless it's this player's turn. */
export function AutoNight({ view, send }: { view: PlayerView; send: Send }) {
  const { dict } = useI18n();
  if (view.turn) return <TurnPanel view={view} turn={view.turn} send={send} />;
  return (
    <section aria-label={dict.auto.sleeping} className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
      <Moon aria-hidden className="size-10 text-muted-foreground/60" />
      <p className="font-display text-3xl font-bold text-muted-foreground">{dict.auto.sleeping}</p>
      <p className="max-w-xs text-sm text-muted-foreground/80">{dict.auto.sleepingHint}</p>
    </section>
  );
}

/** By day: a turn of this player's, someone else's secret choice, the debate. */
export function AutoDay({ view, send }: { view: PlayerView; send: Send }) {
  const { dict } = useI18n();
  const t = dict.auto;
  const debate = view.auto?.debate;
  return (
    <>
      {view.turn && <TurnPanel view={view} turn={view.turn} send={send} />}
      {view.auto?.waiting && (
        <p role="status" className="flex items-center justify-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-muted-foreground">
          <Clock aria-hidden className="size-4" />
          {t.waiting}
        </p>
      )}
      {debate && view.info?.alive && (
        <section className="card flex flex-col gap-3 p-4">
          <Button
            type="button"
            variant={debate.me ? "outline" : "default"}
            className="h-12 text-base"
            onClick={() => send({ type: "ready", value: !debate.me })}
          >
            <Hand aria-hidden className="size-5" />
            {debate.me ? t.notReady : t.ready}
          </Button>
          <p className="text-center text-sm text-muted-foreground">{format(t.readyCount, { ready: debate.ready, living: debate.living })}</p>
        </section>
      )}
    </>
  );
}

/** Running for Mayor, with or without a game master: until one is elected. */
export function MayorRace({ view, send }: { view: PlayerView; send: Send }) {
  const { dict } = useI18n();
  const name = useName();
  const t = dict.auto;
  const me = view.me?.id;
  const standing = !!me && view.candidates.includes(me);
  if (!view.canStand && view.candidates.length === 0) return null;
  return (
    <section className={`card flex flex-col gap-3 p-4 ${view.auto?.candidacy ? "ring-2 ring-moon/60" : ""}`}>
      <p className="flex items-center gap-2 font-semibold">
        <Crown aria-hidden className="size-5 text-moon" />
        {view.candidates.length ? format(t.mayorCandidates, { names: view.candidates.map(name).join(", ") }) : t.mayorNoCandidates}
      </p>
      {view.canStand && (
        <Button type="button" variant={standing ? "outline" : "default"} onClick={() => send({ type: "stand", value: !standing })}>
          {standing ? t.mayorWithdraw : t.mayorButton}
        </Button>
      )}
    </section>
  );
}

/** The cards in play: listed for everyone, or only the deck's kind when nobody may know. */
export function DeckCard({ view }: { view: PlayerView }) {
  const { dict } = useI18n();
  const config = view.auto?.config;
  if (!config) return null;
  if (!view.deck) {
    return (
      <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Layers aria-hidden className="size-4" />
        {format(dict.auto.hiddenDeck, { style: dict.auto.styles[config.style] })}
      </p>
    );
  }
  const counts = new Map<string, number>();
  for (const role of view.deck) counts.set(role, (counts.get(role) ?? 0) + 1);
  return (
    <details className="card p-4">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-muted-foreground">
        <Layers aria-hidden className="size-4" />
        {dict.auto.deck}
      </summary>
      <ul className="mt-3 flex flex-wrap gap-2">
        {[...counts].map(([role, n]) => (
          <li key={role} className="rounded-full bg-surface-2 px-3 py-1 text-sm">
            <RoleName role={role as Parameters<typeof RoleName>[0]["role"]} />
            {n > 1 && <span className="text-muted-foreground"> ×{n}</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Dead without a game master, or a game master who handed it over: everyone's role and everything that happened. */
export function Spectator({ view, former = false }: { view: PlayerView; former?: boolean }) {
  const { dict } = useI18n();
  const game = view.spectate;
  if (!game) return null;
  return (
    <section className="flex flex-col gap-3">
      <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm">
        <Eye aria-hidden className="size-4 shrink-0 text-moon" />
        {former ? dict.lead.spectating : dict.auto.spectator}
      </p>
      <ul className="card flex flex-col gap-1 p-3">
        {game.players.map((p) => (
          <li key={p.id} className={`flex items-center gap-2 text-sm ${p.alive ? "" : "opacity-50"}`}>
            <Avatar playerId={p.id} name={p.name} className="size-6" />
            <span className={`min-w-0 flex-1 truncate ${p.alive ? "" : "line-through"}`}>{p.name}</span>
            {!p.alive && <Skull aria-label={dict.game.dead} className="size-3.5" />}
            <RoleName role={p.role} className="text-xs" />
          </li>
        ))}
      </ul>
      <Timeline game={game} rolesHidden={false} />
    </section>
  );
}

/** On the narrator device: what it's reading, and its voice on or off. */
export function NarratorCard({ view, send }: { view: PlayerView; send: Send }) {
  const { dict } = useI18n();
  const muted = useMutedVoice();
  const voice = useVoiceSupport();
  const cue = view.speaker?.cue;
  const [doneId, setDoneId] = useState(0);
  if (!view.speaker) return null;
  return (
    <section className="card flex flex-col gap-2 p-4">
      <div className="flex items-start gap-3">
        <Megaphone aria-hidden className="mt-0.5 size-5 shrink-0 text-moon" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{dict.auto.narrator}</p>
          <p className="text-sm text-muted-foreground">{voice ? dict.auto.narratorHint : dict.auto.noVoice}</p>
        </div>
        <button
          type="button"
          aria-label={muted ? dict.auto.voiceOn : dict.game.mute}
          title={muted ? dict.auto.voiceOn : dict.game.mute}
          className="grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-fg"
          onClick={() => {
            primeVoice();
            if (!muted) hushVoice();
            setMuted(!muted);
          }}
        >
          {muted ? <VolumeX aria-hidden className="size-5" /> : <Volume2 aria-hidden className="size-5" />}
        </button>
      </div>
      {cue && cue.lines.length > 0 && (
        <blockquote className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-pretty">
          {cue.lines.map((line, i) => (
            <span key={i} className="block not-first:mt-1">
              {line}
            </span>
          ))}
        </blockquote>
      )}
      {/* Read out by a person: the game waits for them. */}
      {cue && cue.lines.length > 0 && (muted || !voice) && cue.id !== doneId && (
        <Button
          type="button"
          className="h-11"
          onClick={() => {
            setDoneId(cue.id);
            send({ type: "cue-done", id: cue.id });
          }}
        >
          {dict.auto.readNext}
        </Button>
      )}
    </section>
  );
}

// --- leading ---

/** The game is paused: by the leader, or because the leader's phone is gone. */
export function PauseBanner({ view }: { view: PlayerView }) {
  const { dict } = useI18n();
  if (!view.pause) return null;
  return (
    <p role="status" className="flex items-center gap-2 rounded-xl border border-moon/40 bg-moon/10 px-4 py-3">
      <Pause aria-hidden className="size-5 shrink-0 text-moon" />
      {format(view.pause.reason === "manual" ? dict.lead.paused : dict.lead.leaderGone, { name: view.pause.leader })}
    </p>
  );
}

/** The leader's phone is gone and this one is next: will they be back, or does this phone lead? */
export function SuccessionCard({ view, send }: { view: PlayerView; send: Send }) {
  const { dict } = useI18n();
  if (!view.succession || !view.pause) return null;
  return (
    <section className="card flex flex-col gap-3 p-4 ring-2 ring-moon/50">
      <p className="font-semibold">{format(dict.lead.succession, { name: view.pause.leader })}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" className="h-12" onClick={() => send({ type: "succession", dead: false })}>
          {dict.lead.comingBack}
        </Button>
        <Button type="button" className="h-12" onClick={() => send({ type: "succession", dead: true })}>
          <HeartCrack aria-hidden className="size-4" />
          {dict.lead.suddenDeathLead}
        </Button>
      </div>
    </section>
  );
}

/** Picks who takes the room over: players whose phone is connected (and, if given, who `eligible` allows). */
export function GiveLeadDialog({
  open,
  onClose,
  hint,
  eligible = () => true,
  send,
  exclude,
}: {
  open: boolean;
  onClose: () => void;
  hint: string;
  eligible?: (id: string) => boolean;
  send: Send;
  exclude?: string | null;
}) {
  const { dict } = useI18n();
  const { players } = useRoomContext();
  const candidates = players.filter((p) => p.connected && !p.manual && !p.left && p.id !== exclude && eligible(p.id));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={dict.host.close}>
        <DialogHeader>
          <DialogTitle>{dict.lead.title}</DialogTitle>
          <DialogDescription>{hint}</DialogDescription>
        </DialogHeader>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{dict.lead.nobody}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {candidates.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl border-2 border-line bg-surface-2 px-3 py-2 text-left font-semibold hover:border-primary"
                  onClick={() => {
                    send({ type: "give-lead", playerId: p.id });
                    onClose();
                  }}
                >
                  <Avatar playerId={p.id} name={p.name} className="size-8" />
                  <span className="min-w-0 flex-1 truncate">{format(dict.lead.give, { name: p.name })}</span>
                  <Crown aria-hidden className="size-4 text-moon" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** A living player declared out for good: picked, then confirmed. */
export function SuddenDeathDialog({ open, onClose, living, send }: { open: boolean; onClose: () => void; living: string[]; send: Send }) {
  const { dict } = useI18n();
  const name = useName();
  const [target, setTarget] = useState<string | null>(null);
  return (
    <>
      <Dialog open={open && !target} onOpenChange={(o) => !o && onClose()}>
        <DialogContent closeLabel={dict.host.close}>
          <DialogHeader>
            <DialogTitle>{dict.lead.suddenDeath}</DialogTitle>
            <DialogDescription>{dict.lead.suddenDeathHint}</DialogDescription>
          </DialogHeader>
          <PickList targets={living} selected={[]} onToggle={setTarget} />
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{format(dict.lead.suddenDeathConfirm, { name: target ? name(target) : "" })}</AlertDialogTitle>
            <AlertDialogDescription>{dict.lead.suddenDeathHint}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{dict.host.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (target) send({ type: "sudden-death", playerId: target });
                setTarget(null);
                onClose();
              }}
            >
              {dict.lead.suddenDeath}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** The leading phone's tools, without a game master: pause by day, sudden death, then `children` (the quit menu) on the right. */
export function LeaderBar({ view, paused, send, children }: { view: PlayerView; paused: boolean; send: Send; children?: React.ReactNode }) {
  const { dict } = useI18n();
  const [dying, setDying] = useState(false);
  const game = view.game;
  if (!game) return null;
  const over = !!game.winner;
  const night = game.phase.kind === "night" && !game.prologue;
  const dead = new Set(game.dead.map((d) => d.playerId));
  const living = view.players.filter((p) => !dead.has(p.id)).map((p) => p.id);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {over ? null : paused ? (
        <Button type="button" className="h-10" onClick={() => send({ type: "pause", value: false })}>
          <Play aria-hidden className="size-4" />
          {dict.lead.resume}
        </Button>
      ) : (
        !night &&
        !view.pause && (
          <Button type="button" variant="outline" className="h-10" onClick={() => send({ type: "pause", value: true })}>
            <Pause aria-hidden className="size-4" />
            {dict.lead.pause}
          </Button>
        )
      )}
      {!over && (
        <Button type="button" variant="outline" className="h-10" onClick={() => setDying(true)}>
          <HeartCrack aria-hidden className="size-4" />
          {dict.lead.suddenDeath}
        </Button>
      )}
      <div className="ml-auto flex items-center gap-2">{children}</div>
      <SuddenDeathDialog open={dying} onClose={() => setDying(false)} living={living} send={send} />
    </div>
  );
}

// --- turns ---

export function TurnPanel({ view, turn, send }: { view: PlayerView; turn: PhoneTurn; send: Send }) {
  const { dict } = useI18n();
  const name = useName();
  const t = dict.auto;
  const act = (action: Extract<ClientMessage, { type: "play" }>["action"]) => send({ type: "play", action });

  let body: React.ReactNode;
  switch (turn.kind) {
    case "pick":
      body = <PickTurn turn={turn} onConfirm={(ids) => act(pickAction(turn, ids))} />;
      break;
    case "wolves":
      body = <WolvesTurn turn={turn} me={view.me!.id} send={send} />;
      break;
    case "witch":
      body = <WitchTurn turn={turn} onConfirm={(heal, poisonId) => act({ type: "witch", heal, poisonId })} />;
      break;
    case "cards":
      body = (
        <>
          <p className="text-muted-foreground">{turn.step === "thief" ? t.thiefHint : t.actorHint}</p>
          <div className={`grid gap-3 ${turn.cards.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {turn.cards.map((role, i) => (
              <button
                key={i}
                type="button"
                onClick={() => act(turn.step === "thief" ? { type: "thief", pick: i } : { type: "choose", value: i })}
                className="card flex aspect-[3/4] items-center justify-center p-3 text-center text-lg font-semibold hover:border-fg/40"
              >
                <RoleName role={role} />
              </button>
            ))}
          </div>
          {turn.canKeep && (
            <Button
              type="button"
              variant="outline"
              className="h-12"
              onClick={() => act(turn.step === "thief" ? { type: "thief", pick: null } : { type: "choose", value: null })}
            >
              {turn.step === "thief" ? t.keep : t.noPower}
            </Button>
          )}
        </>
      );
      break;
    case "choice": {
      const steps = dict.game.steps;
      const [question, options]: [string, { label: string; value: string | boolean }[]] =
        turn.step === "wolf-hound"
          ? [steps["wolf-hound"].say, [{ label: steps["wolf-hound"].village, value: "village" }, { label: steps["wolf-hound"].wolves, value: "wolves" }]]
          : [
              turn.step === "infect"
                ? format(t.infect, { name: name(turn.victimId!) })
                : turn.step === "servant"
                  ? format(t.servantChoice, { name: name(turn.victimId!) })
                  : t.judge,
              [
                { label: t.yes, value: true },
                { label: t.no, value: false },
              ],
            ];
      body = (
        <>
          <p className="text-xl font-semibold">{question}</p>
          <div className="grid grid-cols-2 gap-2">
            {options.map((o) => (
              <Button key={String(o.value)} type="button" className="h-14 text-base" variant={o.value === false || o.value === "village" ? "outline" : "default"} onClick={() => act({ type: "choose", value: o.value })}>
                {o.label}
              </Button>
            ))}
          </div>
        </>
      );
      break;
    }
    case "seer-result":
      body = (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <p className="text-2xl">{format(dict.game.steps["seer-result"].reveal, { target: name(turn.targetId) })}</p>
          <RoleName role={turn.role} className="font-display text-5xl font-bold" />
        </div>
      );
      break;
    case "fox-result": {
      const f = dict.game.steps["fox-result"];
      body = (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <p className={`font-display text-3xl font-bold ${turn.hasWolf ? "text-primary" : "text-ok"}`}>{turn.hasWolf ? f.yes : f.no}</p>
          <p className="text-xl">{turn.playerIds.map(name).join(", ")}</p>
        </div>
      );
      break;
    }
    case "check":
      body = (
        <p className="py-6 text-center text-2xl font-semibold text-balance">
          {turn.message === "lover" ? format(t.check.lover, { name: name(turn.partnerId!) }) : t.check[turn.message]}
        </p>
      );
      break;
    case "group":
      body = (
        <div className="flex flex-col items-center gap-4 py-4">
          <p className="text-xl font-semibold">{t.group[turn.group]}</p>
          <ul className="flex flex-wrap justify-center gap-3">
            {turn.ids.map((id) => (
              <li key={id} className="flex flex-col items-center gap-1">
                <Avatar playerId={id} name={name(id)} className="size-16 text-xl" />
                <span className="font-medium">{name(id)}</span>
              </li>
            ))}
          </ul>
        </div>
      );
      break;
  }
  const title = turn.kind === "pick" ? t.turn[turn.step] : turn.kind === "wolves" ? dict.auto.wolvesName : turn.kind === "witch" ? dict.roles.witch.name : null;
  return (
    <section className="card flex flex-col gap-4 p-4 ring-2 ring-moon/50">
      <p className="text-xs font-semibold tracking-[0.2em] text-moon uppercase">{t.yourTurn}</p>
      {title && <h2 className="-mt-2 text-xl font-semibold">{title}</h2>}
      {body}
      <TurnClock view={view} send={send} />
    </section>
  );
}

/** After the last call: the time left, and "one more minute" once. */
function TurnClock({ view, send }: { view: PlayerView; send: Send }) {
  const { dict } = useI18n();
  const { clockOffset } = useRoomContext();
  const clock = view.auto?.clock;
  const [now, setNow] = useState(() => Date.now());
  const lastCall = !!clock?.lastCall;
  useEffect(() => {
    if (!lastCall) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [lastCall]);
  if (!clock?.lastCall) return null;
  const left = Math.max(0, clock.endsAt - (now + clockOffset));
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-primary/10 px-3 py-2">
      <p className="min-w-0 flex-1 text-sm text-primary">
        {dict.auto.lastCallHint} {format(dict.auto.timeLeft, { time: formatDuration(left) })}
      </p>
      {clock.canExtend && (
        <Button type="button" variant="outline" className="h-9" onClick={() => send({ type: "more-time" })}>
          <Clock aria-hidden className="size-4" />
          {dict.auto.moreTime}
        </Button>
      )}
    </div>
  );
}

/** Big buttons with faces, for picking players on a phone. */
function PickList({ targets, selected, onToggle }: { targets: string[]; selected: string[]; onToggle: (id: string) => void }) {
  const name = useName();
  return (
    <ul className="grid grid-cols-2 gap-2">
      {targets.map((id) => {
        const on = selected.includes(id);
        return (
          <li key={id}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(id)}
              className={`flex min-h-14 w-full items-center gap-2 rounded-xl border-2 px-2 py-2 text-left font-semibold ${on ? "border-primary bg-primary/10" : "border-line bg-surface-2"}`}
            >
              <Avatar playerId={id} name={name(id)} className="size-8" />
              <span className="min-w-0 flex-1 truncate">{name(id)}</span>
              {on && <Check aria-hidden className="size-4 shrink-0 text-primary" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function toggle(list: string[], id: string, max: number) {
  if (list.includes(id)) return list.filter((x) => x !== id);
  return max === 1 ? [id] : list.length < max ? [...list, id] : list;
}

function PickTurn({ turn, onConfirm }: { turn: Extract<PhoneTurn, { kind: "pick" }>; onConfirm: (ids: string[]) => void }) {
  const { dict } = useI18n();
  const name = useName();
  const [selected, setSelected] = useState<string[]>([]);
  const skipLabel = (dict.game.steps as Record<string, { skip?: string }>)[turn.step]?.skip;
  return (
    <>
      {turn.lastId && <p className="text-sm text-muted-foreground">{format(dict.auto.lastProtected, { name: name(turn.lastId) })}</p>}
      <PickList targets={turn.targets} selected={selected} onToggle={(id) => setSelected((s) => toggle(s, id, turn.max))} />
      <div className="flex flex-wrap gap-2 [&>*]:grow">
        <Button type="button" className="h-12 text-base" disabled={selected.length < turn.min || selected.length > turn.max} onClick={() => onConfirm(selected)}>
          {dict.game.confirm}
        </Button>
        {turn.skip && (
          <Button type="button" variant="outline" className="h-12" onClick={() => onConfirm([])}>
            {skipLabel ?? dict.auto.no}
          </Button>
        )}
      </div>
    </>
  );
}

function WolvesTurn({ turn, me, send }: { turn: Extract<PhoneTurn, { kind: "wolves" }>; me: string; send: Send }) {
  const { dict } = useI18n();
  const name = useName();
  const mine = turn.picks[me] ?? null;
  return (
    <>
      <p className="text-sm text-muted-foreground">{dict.auto.wolvesHint}</p>
      <ul className="grid grid-cols-2 gap-2">
        {turn.targets.map((id) => {
          const pickers = turn.wolves.filter((w) => turn.picks[w] === id);
          return (
            <li key={id}>
              <button
                type="button"
                aria-pressed={mine === id}
                onClick={() => send({ type: "wolf-pick", targetId: mine === id ? null : id })}
                className={`flex min-h-14 w-full flex-col items-start gap-1 rounded-xl border-2 px-2 py-2 text-left font-semibold ${mine === id ? "border-primary bg-primary/10" : "border-line bg-surface-2"}`}
              >
                <span className="flex w-full items-center gap-2">
                  <Avatar playerId={id} name={name(id)} className="size-8" />
                  <span className="min-w-0 flex-1 truncate">{name(id)}</span>
                </span>
                {pickers.length > 0 && (
                  <span className="flex -space-x-1">
                    {pickers.map((w) => (
                      <Avatar key={w} playerId={w} name={name(w)} className="size-5 ring-2 ring-surface" />
                    ))}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {turn.wolves.length > 1 && (
        <div className="text-sm">
          <p className="mb-1 font-medium">{dict.auto.wolvesPicks}</p>
          <ul className="flex flex-col gap-0.5 text-muted-foreground">
            {turn.wolves.map((w) => (
              <li key={w}>
                {name(w)} → {turn.picks[w] ? name(turn.picks[w]) : dict.auto.noPick}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function WitchTurn({ turn, onConfirm }: { turn: Extract<PhoneTurn, { kind: "witch" }>; onConfirm: (heal: boolean, poisonId: string | null) => void }) {
  const { dict } = useI18n();
  const name = useName();
  const t = dict.game.steps.witch;
  const [heal, setHeal] = useState(false);
  const [poison, setPoison] = useState<string[]>([]);
  const victim = turn.victimId ? name(turn.victimId) : null;
  return (
    <>
      <p className="text-2xl font-semibold">{victim ? format(t.victim, { name: victim }) : t.noVictim}</p>
      {turn.canHeal && victim && (
        <label className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 ${heal ? "border-ok" : "border-line"}`}>
          <input type="checkbox" className="size-5 accent-[var(--ok)]" checked={heal} onChange={(e) => setHeal(e.target.checked)} />
          <FlaskConical aria-hidden className="size-5 text-ok" />
          {format(t.heal, { name: victim })}
        </label>
      )}
      {!turn.canHeal && <p className="text-sm text-muted-foreground line-through">{t.healUsed}</p>}
      {turn.canPoison ? (
        <>
          <p className="flex items-center gap-2 font-medium">
            <Skull aria-hidden className="size-5 text-primary" />
            {t.poison}
          </p>
          <PickList targets={turn.targets} selected={poison} onToggle={(id) => setPoison((s) => toggle(s, id, 1))} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground line-through">{t.poisonUsed}</p>
      )}
      <Button type="button" className="h-12 text-base" onClick={() => onConfirm(heal, poison[0] ?? null)}>
        {heal || poison.length ? dict.game.confirm : t.nothing}
      </Button>
    </>
  );
}
