"use client";

import { useEffect, useState } from "react";
import { Check, Clock, Crown, Eye, EyeOff, FlaskConical, Hand, HeartCrack, Layers, Megaphone, Moon, Pause, Play, SkipForward, Skull, ThumbsDown, ThumbsUp, Volume2, VolumeX } from "lucide-react";
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
import { chooseVoice, hushVoice, setVoice, unlockVoice, useSpeaking, useVoiceLocked, useVoiceOn, useVoices, useVoiceSupport } from "@/hooks/use-narrator";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { pickAction, type PhoneTurn } from "@/lib/auto";
import { format } from "@/lib/i18n/config";
import type { ClientMessage, PlayerView } from "@/lib/protocol";
import { unlockSound } from "@/lib/sound";

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
  // Hidden until asked: a phone left face up on the table mustn't spoil the game for the neighbours.
  const [shown, setShown] = useState(false);
  const game = view.spectate;
  if (!game) return null;
  return (
    <section className="flex flex-col gap-3">
      <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm">
        <Eye aria-hidden className="size-4 shrink-0 text-moon" />
        {former ? dict.lead.spectating : dict.auto.spectator}
      </p>
      <Button type="button" variant="outline" className="h-10 self-start" aria-pressed={shown} onClick={() => setShown(!shown)}>
        {shown ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
        {shown ? dict.game.hideRoles : dict.game.showRoles}
      </Button>
      <ul className="card flex flex-col gap-1 p-3">
        {game.players.map((p) => (
          <li key={p.id} className={`flex items-center gap-2 text-sm ${p.alive ? "" : "opacity-50"}`}>
            <Avatar playerId={p.id} name={p.name} className="size-6" />
            <span className={`min-w-0 flex-1 truncate ${p.alive ? "" : "line-through"}`}>{p.name}</span>
            {!p.alive && <Skull aria-label={dict.game.dead} className="size-3.5" />}
            {shown && <RoleName role={p.role} className="text-xs" />}
          </li>
        ))}
      </ul>
      <Timeline game={game} rolesHidden={!shown} />
    </section>
  );
}

/** On the narrator device: what it's reading, its voice (off until turned on), and the narration's language. */
export function NarratorCard({ view, send }: { view: PlayerView; send: Send }) {
  const { dict } = useI18n();
  const voiceOn = useVoiceOn();
  const speaking = useSpeaking();
  const voice = useVoiceSupport();
  const cue = view.speaker?.cue;
  const [doneId, setDoneId] = useState(0);
  const voices = useVoices(view.speaker?.locale ?? "en");
  const locked = useVoiceLocked();
  if (!view.speaker) return null;
  const locale = view.speaker.locale;
  const game = view.game;
  // Long lines by day (the story, the deaths, the votes) can be cut short.
  const daytime = !!game && (game.phase.kind === "day" || game.prologue || !!game.winner);
  const reading = !!cue && cue.lines.length > 0;
  const next = () => {
    if (!cue) return;
    setDoneId(cue.id);
    hushVoice();
    send({ type: "cue-done", id: cue.id });
  };
  return (
    <section className="card flex flex-col gap-2 p-4">
      <div className="flex items-start gap-3">
        <Megaphone aria-hidden className="mt-0.5 size-5 shrink-0 text-moon" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{dict.auto.narrator}</p>
          <p className="text-sm text-muted-foreground">{voice ? (voiceOn ? dict.auto.narratorHint : dict.auto.voiceOffHint) : dict.auto.noVoice}</p>
        </div>
        {voice && (
          <button
            type="button"
            aria-pressed={voiceOn}
            aria-label={voiceOn ? dict.auto.voiceMute : dict.auto.voiceOn}
            title={voiceOn ? dict.auto.voiceMute : dict.auto.voiceOn}
            className={`grid size-10 shrink-0 place-items-center rounded-lg hover:bg-surface-2 hover:text-fg ${voiceOn ? "text-moon" : "text-muted-foreground"}`}
            // Turned on from the tap itself: that's what lets a phone speak.
            onClick={() => setVoice(!voiceOn, cue && cue.id !== doneId ? { cue, locale, send } : undefined)}
          >
            {voiceOn ? <Volume2 aria-hidden className="size-5" /> : <VolumeX aria-hidden className="size-5" />}
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="segmented text-xs" aria-label={dict.auto.language}>
          {(["en", "fr"] as const).map((l) => (
            <button key={l} type="button" aria-current={locale === l} onClick={() => send({ type: "set-locale", locale: l })}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        {/* The browser's own pick can be a poor one (another language's accent): this device's voice, by hand. */}
        {voiceOn && voices && voices.voices.length > 1 && (
          <NativeSelect
            aria-label={dict.auto.voiceChoice}
            className="h-9 max-w-56 py-0 text-sm"
            value={voices.chosen ?? ""}
            onChange={(e) => chooseVoice(locale, e.target.value || null)}
          >
            <NativeSelectOption value="">{format(dict.auto.voiceAuto, { name: voices.current?.label ?? "?" })}</NativeSelectOption>
            {voices.voices.map((v) => (
              <NativeSelectOption key={v.id} value={v.id}>
                {v.silent ? format(dict.auto.voiceSilent, { name: v.label }) : v.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </div>
      {/* The voice is on, but this page may only speak once tapped (reloaded, or the game started elsewhere). */}
      {locked && (
        <Button
          type="button"
          className="h-12 text-base"
          onClick={() => {
            unlockSound();
            unlockVoice();
          }}
        >
          <Volume2 aria-hidden className="size-5" />
          {dict.auto.startVoice}
        </Button>
      )}
      {reading && (
        <blockquote className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-pretty">
          {cue.lines.map((line, i) => (
            <span key={i} className="block not-first:mt-1">
              {line}
            </span>
          ))}
        </blockquote>
      )}
      {/* Read out by a person: the game waits for them. Read by the voice: by day, it can be skipped. */}
      {reading && cue.id !== doneId && (!voiceOn || !voice) && (
        <Button type="button" className="h-11" onClick={next}>
          {dict.auto.readNext}
        </Button>
      )}
      {reading && voiceOn && speaking === cue.id && daytime && (
        <Button type="button" variant="outline" className="h-10" onClick={next}>
          <SkipForward aria-hidden className="size-4" />
          {dict.auto.skip}
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
      {format(view.pause.reason === "manual" ? dict.lead.paused : dict.lead.leaderGone, { name: view.pause.leader, next: view.pause.next })}
    </p>
  );
}

/** On the new leader's screen: the one whose device went silent, until they're settled. */
export function LostLeaderCard({ name, send }: { name: string; send: Send }) {
  const { dict } = useI18n();
  return (
    <section className="card flex flex-col gap-3 p-4 ring-2 ring-moon/50">
      <p className="font-semibold">{format(dict.lead.lostLeader, { name })}</p>
      <p className="text-sm text-muted-foreground">{dict.lead.lostLeaderHint}</p>
      <Button type="button" variant="outline" className="h-11 self-start" onClick={() => send({ type: "succession", dead: true })}>
        <HeartCrack aria-hidden className="size-4" />
        {format(dict.lead.lostLeaderDead, { name })}
      </Button>
    </section>
  );
}

/** With a game master: their screen is gone and nobody dead can take over. */
export function MasterGoneCard({ onLeave }: { onLeave: () => void }) {
  const { dict } = useI18n();
  return (
    <section role="alert" className="card flex flex-col gap-3 p-4 ring-2 ring-primary/50">
      <p className="font-semibold">{dict.lead.masterGone}</p>
      <Button type="button" variant="outline" className="h-11 self-start" onClick={onLeave}>
        {dict.lead.leaveGame}
      </Button>
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
      body = <CardsTurn turn={turn} onConfirm={(pick) => act(turn.step === "thief" ? { type: "thief", pick } : { type: "choose", value: pick })} />;
      break;
    case "choice":
      body = <ChoiceTurn turn={turn} onConfirm={(value) => act({ type: "choose", value })} />;
      break;
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
                <span className="max-w-24 text-center font-medium wrap-anywhere">{name(id)}</span>
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

/** The time left before the turn is skipped; after the last call, "one more minute" once. */
function TurnClock({ view, send }: { view: PlayerView; send: Send }) {
  const { dict } = useI18n();
  const { clockOffset } = useRoomContext();
  const clock = view.auto?.clock;
  const [now, setNow] = useState(() => Date.now());
  const ticking = !!clock;
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [ticking]);
  if (!clock) return null;
  const left = Math.max(0, clock.endsAt - (now + clockOffset));
  return (
    <div className={`flex flex-col gap-2 rounded-xl px-3 py-2 ${clock.lastCall ? "bg-primary/10" : "bg-surface-2"}`}>
      <p className={`flex items-start gap-2 text-sm ${clock.lastCall ? "text-primary" : "text-muted-foreground"}`}>
        <Clock aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          {clock.lastCall && `${dict.auto.lastCallHint} `}
          {format(dict.auto.skipIn, { time: formatDuration(left) })}
        </span>
      </p>
      {clock.canExtend && (
        <Button type="button" variant="outline" className="h-10" onClick={() => send({ type: "more-time" })}>
          <Clock aria-hidden className="size-4" />
          {dict.auto.moreTime}
        </Button>
      )}
    </div>
  );
}

/** A choice only counts once confirmed: one stray tap never plays a turn. */
function PlayButton({ ready, onClick, label }: { ready: boolean; onClick: () => void; label?: string }) {
  const { dict } = useI18n();
  return (
    <Button type="button" className="h-12 text-base" disabled={!ready} onClick={onClick}>
      <Check aria-hidden className="size-5" />
      {label ?? dict.game.confirm}
    </Button>
  );
}

/** A plain option that's picked, then confirmed. */
function OptionButton({ on, onClick, children, className = "" }: { on: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
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

function CardsTurn({ turn, onConfirm }: { turn: Extract<PhoneTurn, { kind: "cards" }>; onConfirm: (pick: number | null) => void }) {
  const { dict } = useI18n();
  const t = dict.auto;
  // undefined: nothing picked yet; null: keeping one's card (or no power).
  const [pick, setPick] = useState<number | null | undefined>(undefined);
  return (
    <>
      <p className="text-muted-foreground">{turn.step === "thief" ? t.thiefHint : t.actorHint}</p>
      <div className={`grid gap-3 ${turn.cards.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {turn.cards.map((role, i) => (
          <OptionButton key={i} on={pick === i} onClick={() => setPick(i)} className="aspect-[3/4] p-3 text-lg">
            <RoleName role={role} />
          </OptionButton>
        ))}
      </div>
      {turn.canKeep && (
        <OptionButton on={pick === null} onClick={() => setPick(null)}>
          {turn.step === "thief" ? t.keep : t.noPower}
        </OptionButton>
      )}
      <PlayButton ready={pick !== undefined} onClick={() => onConfirm(pick ?? null)} />
    </>
  );
}

function ChoiceTurn({ turn, onConfirm }: { turn: Extract<PhoneTurn, { kind: "choice" }>; onConfirm: (value: string | boolean) => void }) {
  const { dict } = useI18n();
  const name = useName();
  const t = dict.auto;
  const steps = dict.game.steps;
  const [value, setValue] = useState<string | boolean | null>(null);
  const [question, options]: [string, { label: string; value: string | boolean }[]] =
    turn.step === "wolf-hound"
      ? [steps["wolf-hound"].say, [{ label: steps["wolf-hound"].village, value: "village" }, { label: steps["wolf-hound"].wolves, value: "wolves" }]]
      : [
          turn.step === "infect" ? format(t.infect, { name: name(turn.victimId!) }) : turn.step === "servant" ? format(t.servantChoice, { name: name(turn.victimId!) }) : t.judge,
          [
            { label: t.yes, value: true },
            { label: t.no, value: false },
          ],
        ];
  return (
    <>
      <p className="text-xl font-semibold">{question}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => (
          <OptionButton key={String(o.value)} on={value === o.value} onClick={() => setValue(o.value)} className="min-h-14 text-base">
            {o.label}
          </OptionButton>
        ))}
      </div>
      <PlayButton ready={value !== null} onClick={() => onConfirm(value!)} />
    </>
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
              <span className="min-w-0 flex-1 wrap-anywhere">{name(id)}</span>
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
  const [nobody, setNobody] = useState(false);
  const skipLabel = (dict.game.steps as Record<string, { skip?: string }>)[turn.step]?.skip;
  const valid = selected.length >= turn.min && selected.length <= turn.max;
  return (
    <>
      {turn.lastId && <p className="text-sm text-muted-foreground">{format(dict.auto.lastProtected, { name: name(turn.lastId) })}</p>}
      <PickList
        targets={turn.targets}
        selected={selected}
        onToggle={(id) => {
          setNobody(false);
          setSelected((s) => toggle(s, id, turn.max));
        }}
      />
      {turn.skip && (
        <OptionButton
          on={nobody}
          onClick={() => {
            setNobody(!nobody);
            setSelected([]);
          }}
        >
          {skipLabel ?? dict.auto.no}
        </OptionButton>
      )}
      <PlayButton ready={nobody || valid} onClick={() => onConfirm(nobody ? [] : selected)} />
    </>
  );
}

function WolvesTurn({ turn, me, send }: { turn: Extract<PhoneTurn, { kind: "wolves" }>; me: string; send: Send }) {
  const { dict } = useI18n();
  const name = useName();
  const mine = turn.picks[me] ?? null;
  // The pick only reaches the pack once confirmed.
  const [draft, setDraft] = useState<string | null>(mine);
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
                aria-pressed={draft === id}
                onClick={() => setDraft(draft === id ? null : id)}
                className={`flex min-h-14 w-full flex-col items-start gap-1 rounded-xl border-2 px-2 py-2 text-left font-semibold ${draft === id ? "border-primary bg-primary/10" : mine === id ? "border-dashed border-primary/60" : "border-line bg-surface-2"}`}
              >
                <span className="flex w-full items-center gap-2">
                  <Avatar playerId={id} name={name(id)} className="size-8" />
                  <span className="min-w-0 flex-1 wrap-anywhere">{name(id)}</span>
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
      <PlayButton ready={draft !== mine} onClick={() => send({ type: "wolf-pick", targetId: draft })} label={draft === null && mine ? dict.auto.withdrawPick : undefined} />
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
  // One question at a time, as the narrator asks them: the healing potion, then the poison.
  const [stage, setStage] = useState<"heal" | "poison" | "target">("heal");
  const [heal, setHeal] = useState(false);
  const [poison, setPoison] = useState<string[]>([]);
  const victim = turn.victimId ? name(turn.victimId) : null;
  const answer = (yes: string, onYes: () => void, onNo: () => void) => (
    <div className="grid grid-cols-2 gap-2">
      <Button type="button" className="h-auto min-h-12 text-base whitespace-normal" onClick={onYes}>
        <ThumbsUp aria-hidden className="size-5" />
        {yes}
      </Button>
      <Button type="button" variant="outline" className="h-auto min-h-12 text-base" onClick={onNo}>
        <ThumbsDown aria-hidden className="size-5" />
        {dict.auto.no}
      </Button>
    </div>
  );

  if (stage === "heal") {
    const toPoison = (healed: boolean) => {
      setHeal(healed);
      setStage("poison");
    };
    return (
      <>
        <p className="text-2xl font-semibold wrap-anywhere">{victim ? format(t.victim, { name: victim }) : t.noVictim}</p>
        {victim && turn.canHeal ? (
          <>
            <p className="flex items-center gap-2 font-medium">
              <FlaskConical aria-hidden className="size-5 text-ok" />
              {t.askHeal}
            </p>
            {answer(format(t.heal, { name: victim }), () => toPoison(true), () => toPoison(false))}
          </>
        ) : (
          <>
            {!turn.canHeal && <p className="text-muted-foreground">{t.cantHeal}</p>}
            <PlayButton ready label={dict.game.continue} onClick={() => toPoison(false)} />
          </>
        )}
      </>
    );
  }
  if (stage === "poison") {
    return (
      <>
        {heal && victim && <p className="font-medium text-ok wrap-anywhere">{format(t.heal, { name: victim })}</p>}
        {turn.canPoison ? (
          <>
            <p className="flex items-center gap-2 font-medium">
              <Skull aria-hidden className="size-5 text-primary" />
              {t.askPoison}
            </p>
            {answer(dict.auto.yes, () => setStage("target"), () => onConfirm(heal, null))}
          </>
        ) : (
          <>
            <p className="text-muted-foreground">{t.cantPoison}</p>
            <PlayButton ready onClick={() => onConfirm(heal, null)} />
          </>
        )}
        <Button type="button" variant="ghost" className="h-10" onClick={() => setStage("heal")}>
          {dict.ballot.back}
        </Button>
      </>
    );
  }
  return (
    <>
      <p className="flex items-center gap-2 font-medium">
        <Skull aria-hidden className="size-5 text-primary" />
        {t.poison}
      </p>
      <PickList targets={turn.targets} selected={poison} onToggle={(id) => setPoison((s) => toggle(s, id, 1))} />
      <PlayButton ready={poison.length > 0} onClick={() => onConfirm(heal, poison[0])} />
      <Button type="button" variant="ghost" className="h-10" onClick={() => setStage("poison")}>
        {dict.ballot.back}
      </Button>
    </>
  );
}
