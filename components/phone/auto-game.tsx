"use client";

import { useEffect, useState } from "react";
import { Check, Clock, Crown, Eye, EyeOff, Hand, Layers, Megaphone, Moon, SkipForward, Skull, Volume2, VolumeX } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { HoldProgressRing } from "@/components/hold-progress-ring";
import { useHoldToReveal } from "@/hooks/use-hold-to-reveal";
import { RoleName } from "@/components/game/role-chip";
import { Timeline } from "@/components/game/timeline";
import { Avatar, formatDuration, useRoomContext, type Send, useName } from "@/components/room-context";
import { Button } from "@/components/ui/button";
import { chooseVoice, hushVoice, setVoice, unlockVoice, useSpeaking, useVoiceLocked, useVoiceOn, useVoices, useVoiceSupport } from "@/hooks/use-narrator";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { PhoneTurn } from "@/lib/auto";
import { format } from "@/lib/i18n/config";
import type { PlayerView } from "@/lib/protocol";
import { unlockSound } from "@/lib/sound";
import { phoneTurnOf } from "./turn-screens";
import type { PhoneTurnKind, PhoneTurnScreen } from "./turn-parts";


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
      {/* Deciding whether to run for Mayor: OK when done (the card's OK sits under the card). */}
      {!view.turn && view.auto?.look?.show !== "card" && <LookButton view={view} send={send} />}
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
export function TurnPanel({ view, turn, send }: { view: PlayerView; turn: PhoneTurn; send: Send }) {
  const { dict } = useI18n();
  const { Screen, title, isSecret } = phoneTurnOf(turn.kind) as PhoneTurnScreen<PhoneTurnKind>;
  const body = <Screen view={view} turn={turn} send={send} />;
  const heading = title?.(dict, turn);
  return (
    <section className="card flex flex-col gap-4 p-4 ring-2 ring-moon/50">
      <p className="text-xs font-semibold tracking-[0.2em] text-moon uppercase">{dict.auto.yourTurn}</p>
      {heading && <h2 className="-mt-2 text-xl font-semibold">{heading}</h2>}
      {/* News for this player alone, read with others' eyes possibly open: only while held, and the same face-down panel for everyone. */}
      {isSecret ? <HoldToSee>{body}</HoldToSee> : body}
      {isSecret ? <LookButton view={view} send={send} /> : <TurnClock view={view} send={send} />}
    </section>
  );
}
/**
 * Face down until held, like the role card: whatever it hides (news, a result,
 * nothing at all) looks the same to anyone glancing at the phone.
 */
function HoldToSee({ children }: { children: React.ReactNode }) {
  const { dict } = useI18n();
  const { isHolding, isRevealed, handlers } = useHoldToReveal();
  return (
    <button
      type="button"
      aria-label={dict.auto.holdToSee}
      className="relative grid min-h-48 w-full touch-none place-items-center rounded-2xl select-none [-webkit-touch-callout:none]"
      {...handlers}
    >
      {isRevealed ? (
        <span className="flex w-full flex-col items-center p-4">{children}</span>
      ) : (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-line bg-[repeating-linear-gradient(45deg,var(--surface)_0_12px,var(--surface-2)_12px_24px)] p-4">
          <HoldProgressRing isHolding={isHolding} className="size-14">
            <Eye aria-hidden className="size-6 text-moon" />
          </HoldProgressRing>
          <span className="rounded-full bg-bg px-4 py-1.5 font-medium">{dict.auto.holdToSee}</span>
        </span>
      )}
    </button>
  );
}
/**
 * OK, with the time left inside it: done looking (at a card, a message, a
 * result…). Once everyone concerned is, the game moves on; at zero it moves on anyway.
 */
export function LookButton({ view, send }: { view: PlayerView; send: Send }) {
  const { dict } = useI18n();
  const { clockOffset } = useRoomContext();
  const look = view.auto?.look;
  const [now, setNow] = useState(() => Date.now());
  const ticking = !!look && !look.done;
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [ticking]);
  if (!look) return null;
  const t = dict.auto.look;
  if (look.done) {
    return (
      <p role="status" className="flex items-center justify-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-center text-muted-foreground">
        <Check aria-hidden className="size-4 shrink-0" />
        {view.game?.phase.kind === "night" && !view.game.prologue ? t.doneNight : t.doneDay}
      </p>
    );
  }
  const left = Math.max(0, look.endsAt - (now + clockOffset));
  return (
    <Button type="button" className="h-12 text-base" onClick={() => send({ type: "ack" })}>
      <Check aria-hidden className="size-5" />
      {look.show === "card" ? t.card : look.show === "candidacy" ? t.candidacy : t.ok}
      <span className="ml-1 rounded-full bg-primary-foreground/20 px-2 py-0.5 text-sm tabular-nums">{formatDuration(left)}</span>
    </Button>
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
