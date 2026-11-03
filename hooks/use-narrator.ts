"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { DAWN, HOWL, RESTART_MS, leaveScene, loadSample, playStinger, restartSound, setScene } from "@/lib/sound";
import type { Cue } from "@/lib/auto";
import type { ClientMessage, Speaker } from "@/lib/protocol";

/**
 * The narrator, without a game master: one device reads the room's lines out
 * loud with the browser's own voice (Web Speech API), plays the soundtrack,
 * and tells the room when it's done so the game moves on. The voice is off
 * until turned on: meanwhile (or in a browser without one) the lines stay on
 * screen for someone to read, and "next" moves on.
 */
export function useNarrator(speaker: Speaker | null, send: (message: ClientMessage) => void) {
  const scene = speaker?.scene ?? null;
  const on = !!speaker;
  useEffect(() => {
    if (!on) return;
    void loadSample(HOWL);
    for (const url of Object.values(DAWN)) void loadSample(url);
    // Some browsers list their voices only after a first call.
    if (hasVoice()) window.speechSynthesis.getVoices();
  }, [on]);
  useEffect(() => {
    if (on) setScene(scene);
  }, [on, scene]);
  useEffect(() => (on ? leaveScene : undefined), [on]);
  // No longer the narrator: stop reading.
  useEffect(() => (on ? () => hushVoice() : undefined), [on]);

  const cue = speaker?.cue ?? null;
  const locale = speaker?.locale ?? "en";
  const sender = useRef(send);
  // Every view brings the cue as a new object: the reading follows its id, not
  // the object, or the next view would cancel a line about to be read.
  const current = useRef(cue);
  useEffect(() => {
    sender.current = send;
    current.current = cue;
  });
  const cueId = cue?.id ?? 0;
  const gameId = speaker?.game ?? "";
  useEffect(() => {
    const cue = current.current;
    if (!cue) return;
    // A new game numbers its lines from 1 again, and its voice starts from a tap again.
    if (gameId !== lastGame) {
      lastGame = gameId;
      lastRead = 0;
      unlocked = false;
      waiting = null;
    }
    if (cue.id <= lastRead) return;
    // The line counts as started only once it does: an effect run cut short
    // (React's double run in development, a page hidden meanwhile) leaves it for the next.
    let reading: ReturnType<typeof setTimeout> | undefined;
    const start = setTimeout(() => {
      lastRead = cue.id;
      if (cue.sound) playStinger(cue.sound);
      // Voice off: someone reads the lines out and taps "next" (NarratorCard); the room moves on anyway after a while.
      if (!hasVoice() || !voiceOn) return;
      // Not allowed to speak yet on this page (no tap since it loaded): the line
      // waits for one (unlockVoice), and the narrator card asks for it.
      if (!unlocked) {
        waiting = { cue, locale, send: sender.current };
        notify();
        return;
      }
      // The dawn sound plays first: the voice waits for it.
      const delay = cue.sound?.kind === "dawn" ? 2_500 : cue.sound?.kind === "win" ? 3_000 : 0;
      reading = setTimeout(() => readCue(cue, locale, sender.current), delay);
    }, 0);
    return () => {
      clearTimeout(start);
      clearTimeout(reading);
    };
  }, [cueId, locale, gameId]);
}

const hasVoice = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Whether this browser can read aloud. */
export function useVoiceSupport() {
  return useSyncExternalStore(
    () => () => {},
    hasVoice,
    () => true,
  );
}

// --- the voice: off until someone turns it on (that tap is what lets a phone speak) ---

const VOICE_KEY = "ww:voice";
let voiceOffAt = 0;
let voiceOn = readVoice();
/** The cue being read out loud, if any. */
let speaking: number | null = null;
/** The last cue this device started on (read out, or left to a person), and the game it was in. */
let lastRead = 0;
let lastGame = "";
/**
 * Whether this page may speak. Each game's voice starts from a tap ("Start
 * the voice"): a first line started any other way (a message from the room)
 * can stay silent, on phones and on some computers. Until then, lines wait.
 */
let unlocked = false;
/** The line waiting for that tap. */
let waiting: { cue: Cue; locale: string; send: (message: ClientMessage) => void } | null = null;
const voiceListeners = new Set<() => void>();
const notify = () => voiceListeners.forEach((l) => l());

function readVoice() {
  try {
    return localStorage.getItem(VOICE_KEY) === "on";
  } catch {
    return false;
  }
}

function subscribeVoice(listener: () => void) {
  voiceListeners.add(listener);
  return () => voiceListeners.delete(listener);
}

/** Whether the narrator's voice is on (off by default). */
export const useVoiceOn = () => useSyncExternalStore(subscribeVoice, () => voiceOn, () => false);
/** The cue being read out loud right now (for "skip"). */
export const useSpeaking = () => useSyncExternalStore(subscribeVoice, () => speaking, () => null);
/** The voice is on but this page can't speak until tapped ("Start the voice"). */
export const useVoiceLocked = () => useSyncExternalStore(subscribeVoice, () => voiceOn && !unlocked && hasVoice(), () => false);

/**
 * From a tap: lets this page speak, and reads the line that was waiting for
 * it (or a silent word, which is what unlocks speech on a phone).
 */
export function unlockVoice() {
  if (unlocked || !hasVoice()) return;
  unlocked = true;
  const line = waiting;
  waiting = null;
  if (voiceOn && line && line.cue.id === lastRead) readCue(line.cue, line.locale, line.send);
  else speakSilently();
  notify();
}

function speakSilently() {
  // A silent word, not a blank: some browsers never finish a blank and stay stuck "speaking".
  const word = new SpeechSynthesisUtterance(".");
  word.volume = 0;
  window.speechSynthesis.speak(word);
}

/**
 * Turns the voice on or off. Call it from the tap itself: phones (iPhone
 * above all) only let a page speak when the first line starts in a tap, so
 * turning it on reads the current lines straight away.
 */
export function setVoice(on: boolean, current?: { cue: Cue; locale: string; send: (message: ClientMessage) => void }) {
  // Off and on again within a second: the sound is stuck, the music starts over too (the voice always does).
  if (on && !voiceOn && Date.now() - voiceOffAt < RESTART_MS) restartSound();
  if (!on) voiceOffAt = Date.now();
  voiceOn = on;
  try {
    if (on) localStorage.setItem(VOICE_KEY, "on");
    else localStorage.removeItem(VOICE_KEY);
  } catch {}
  if (!on) hushVoice();
  else if (hasVoice()) {
    window.speechSynthesis.cancel();
    unlocked = true;
    waiting = null;
    if (current?.cue.lines.length) readCue(current.cue, current.locale, current.send);
    else speakSilently();
  }
  notify();
}

/** Reads a cue out loud, then tells the room it's done. */
function readCue(cue: Cue, locale: string, send: (message: ClientMessage) => void) {
  speaking = cue.id;
  notify();
  void speak(cue.lines, locale).then(() => {
    if (speaking === cue.id) speaking = null;
    notify();
    send({ type: "cue-done", id: cue.id });
  });
}

/** Joke voices (macOS's "Whisper", "Bubbles", "Zarvox"…, named in the system's language): never the narrator. */
const JOKE =
  /whisper|murmure|albert|bad news|mauvaises nouvelles|bahh|bells|cloches|boing|bubbles|bulles|cellos|violoncelles|deranged|good news|bonnes nouvelles|hysterical|jester|bouffon|organ|orgue|superstar|trino[iï]d|wobble|zarvox|junior|ralph|fred|kathy|bruce|agnes|vicki|victoria|princess/i;
/** The robotic Eloquence voices (Eddy, Flo…): only when nothing better speaks the language. */
const ROBOTIC = /eddy|flo\b|grandma|grandpa|reed|rocko|sandy|shelley/i;
/** Natural voices, best first. */
const PREFERRED = /siri|premium|enhanced|natural|neural|google|samantha|daniel|serena|karen|moira|arthur|martha|thomas|amélie|amelie|audrey|aurélie|marie/i;

/** The voices that can read `locale` (jokes left out), as the browser lists them. */
function voicesFor(locale: string) {
  return window.speechSynthesis.getVoices().filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith(locale) && !JOKE.test(v.name));
}

/**
 * The voice chosen on this device for the language, else the best one that
 * speaks it: natural before robotic, on the device before over the network
 * (some browsers' network voices stop after a few seconds), the default last.
 * Without one the browser falls back to the system voice, which may be another
 * language's (a French voice reading English with its accent).
 */
function pickVoice(locale: string) {
  const voices = voicesFor(locale).filter((v) => !silentVoices.has(v.voiceURI));
  const chosen = readChoice(locale);
  // By its id; a name, as picked before ids were kept, still works.
  const mine = chosen && (voices.find((v) => v.voiceURI === chosen) ?? voices.find((v) => v.name === chosen));
  if (mine) return mine;
  const score = (v: SpeechSynthesisVoice) => (ROBOTIC.test(v.name) ? 0 : 4) + (PREFERRED.test(v.name) ? 2 : 0) + (v.localService ? 1 : 0) + (v.default ? 0.5 : 0);
  return [...voices].sort((a, b) => score(b) - score(a))[0];
}

// --- the voice chosen on this device, per language (empty: automatic) ---

const choiceKey = (locale: string) => `ww:voice-name:${locale}`;

function readChoice(locale: string) {
  try {
    return localStorage.getItem(choiceKey(locale));
  } catch {
    return null;
  }
}

/** Picks the narrator's voice for a language on this device, by its id (null: back to automatic). */
export function chooseVoice(locale: string, id: string | null) {
  try {
    if (id) localStorage.setItem(choiceKey(locale), id);
    else localStorage.removeItem(choiceKey(locale));
  } catch {}
  voiceList = null;
  notify();
}

/** A voice as the menu shows it: `id` is its voiceURI (names repeat: a phone lists a voice once per quality or region). */
type VoiceOption = { id: string; label: string; silent: boolean };
type VoiceList = { locale: string; voices: VoiceOption[]; current: VoiceOption | null; chosen: string | null };

function labelled(voices: SpeechSynthesisVoice[]): VoiceOption[] {
  const seen = new Set<string>();
  return voices.flatMap((v) => {
    if (seen.has(v.voiceURI)) return [];
    seen.add(v.voiceURI);
    const twins = voices.filter((o) => o.name === v.name).length > 1;
    const quality = /premium/i.test(v.voiceURI) ? "premium" : /enhanced/i.test(v.voiceURI) ? "enhanced" : null;
    return [{ id: v.voiceURI, label: twins ? `${v.name} (${quality ?? v.lang})` : v.name, silent: silentVoices.has(v.voiceURI) }];
  });
}
let voiceList: VoiceList | null = null;

function subscribeVoices(listener: () => void) {
  const changed = () => {
    voiceList = null;
    listener();
  };
  voiceListeners.add(listener);
  window.speechSynthesis?.addEventListener("voiceschanged", changed);
  return () => {
    voiceListeners.delete(listener);
    window.speechSynthesis?.removeEventListener("voiceschanged", changed);
  };
}

/** The voices this device has for `locale`, the one the narrator uses, and the one picked by hand (if any). */
export function useVoices(locale: string): VoiceList | null {
  return useSyncExternalStore(
    subscribeVoices,
    () => {
      if (!hasVoice()) return null;
      if (voiceList?.locale === locale) return voiceList;
      const voices = labelled(voicesFor(locale));
      const current = pickVoice(locale);
      const chosen = readChoice(locale);
      voiceList = {
        locale,
        voices,
        current: voices.find((v) => v.id === current?.voiceURI) ?? null,
        chosen: voices.find((v) => v.id === chosen || v.label === chosen)?.id ?? null,
      };
      return voiceList;
    },
    () => null,
  );
}

/** The voice list, which some browsers fill in a moment after the page asks. */
function voicesReady(): Promise<void> {
  const synth = window.speechSynthesis;
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener("voiceschanged", done);
      resolve();
    };
    synth.addEventListener("voiceschanged", done);
    setTimeout(done, 1_000);
  });
}

/** Reads lines one after the other; resolves when done (or after a while, if the voice never says). */
function speak(lines: string[], locale: string): Promise<void> {
  const words = lines.join(" ").split(/\s+/).filter(Boolean).length;
  const estimate = 800 + words * 380;
  if (!lines.length || !hasVoice()) return Promise.resolve();
  const synth = window.speechSynthesis;
  const lang = locale === "fr" ? "fr-FR" : "en-GB";
  // A first line can be dropped while the browser wakes a voice up (on a Mac, one
  // in another language than the page's): the same voice tries once more. A voice
  // silent twice isn't really on the device: the next best one tries, then the browser's own pick.
  const attempt = (voice: SpeechSynthesisVoice | undefined, again = true): Promise<void> =>
    speakWith(synth, lines, lang, voice, estimate).then((outcome) => {
      if (outcome !== "silent") return;
      if (again) return attempt(voice, false);
      if (!voice) return;
      silentVoices.add(voice.voiceURI);
      voiceList = null;
      notify();
      return attempt(pickVoice(locale));
    });
  // Straight away when the voices are known: a phone only lets a tap's own call start speaking.
  if (synth.getVoices().length) return attempt(pickVoice(locale));
  return voicesReady().then(() => attempt(pickVoice(locale)));
}

/** Voices that never started speaking on this page (listed by the browser, not installed): skipped from then on. */
const silentVoices = new Set<string>();
/** Bumped by every new reading and by hushing: a reading cut short isn't a silent voice. */
let generation = 0;
/** How long a voice may take to start before it counts as silent. */
const START_MS = 3_500;
const UNAVAILABLE = ["voice-unavailable", "language-unavailable", "synthesis-unavailable", "synthesis-failed"];

function speakWith(
  synth: SpeechSynthesis,
  lines: string[],
  lang: string,
  voice: SpeechSynthesisVoice | undefined,
  estimate: number,
): Promise<"done" | "silent"> {
  // One cue at a time: whatever is still queued (or stuck) goes first.
  synth.cancel();
  const reading = ++generation;
  return new Promise((resolve) => {
    let started = false;
    let done = false;
    const finish = (outcome: "done" | "silent") => {
      if (done) return;
      done = true;
      clearTimeout(watchdog);
      resolve(outcome);
    };
    const silent = () => {
      synth.cancel();
      finish("silent");
    };
    // Nothing heard: the voice isn't really there (or the line was cut short, which isn't its fault).
    const watchdog = setTimeout(() => !started && reading === generation && silent(), START_MS);
    // Some browsers drop the end event: the game must not wait forever.
    setTimeout(() => finish("done"), estimate * 2 + 5_000);
    lines.forEach((line, i) => {
      const utterance = new SpeechSynthesisUtterance(line);
      utterance.lang = voice?.lang ?? lang;
      if (voice) utterance.voice = voice;
      utterance.rate = 0.95;
      utterance.onstart = () => {
        started = true;
      };
      utterance.onerror = (e) => {
        if (!started && reading === generation && UNAVAILABLE.includes(e.error)) silent();
        else if (i === lines.length - 1) finish("done");
      };
      if (i === lines.length - 1) utterance.onend = () => finish("done");
      synth.speak(utterance);
    });
  });
}

/** Stops reading at once (voice off, skipped, or this device stopped being the narrator). */
export function hushVoice() {
  generation++;
  if (hasVoice()) window.speechSynthesis.cancel();
  speaking = null;
  notify();
}

/** Keeps the screen on during a game without a game master: a locked phone misses its turn. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const take = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock.request("screen").then(
        (l) => (cancelled ? void l.release() : (lock = l)),
        () => {},
      );
    };
    take();
    // The lock goes when the page is hidden: taken again on return.
    document.addEventListener("visibilitychange", take);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", take);
      void lock?.release();
    };
  }, [active]);
}
