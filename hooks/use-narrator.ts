"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { DAWN, HOWL, leaveScene, loadSample, playStinger, setScene } from "@/lib/sound";
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
  useEffect(() => {
    sender.current = send;
  });
  useEffect(() => {
    if (!cue || cue.id <= lastRead) return;
    lastRead = cue.id;
    if (cue.sound) playStinger(cue.sound);
    // Voice off: someone reads the lines out and taps "next" (NarratorCard); the room moves on anyway after a while.
    if (!hasVoice() || !voiceOn) return;
    // The dawn sound plays first: the voice waits for it.
    const delay = cue.sound?.kind === "dawn" ? 2_500 : cue.sound?.kind === "win" ? 3_000 : 0;
    const timer = setTimeout(() => readCue(cue, locale, sender.current), delay);
    return () => clearTimeout(timer);
  }, [cue, locale]);
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
let voiceOn = readVoice();
/** The cue being read out loud, if any. */
let speaking: number | null = null;
/** The last cue this device started on (read out, or left to a person). */
let lastRead = 0;
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

/**
 * Turns the voice on or off. Call it from the tap itself: phones (iPhone
 * above all) only let a page speak when the first line starts in a tap, so
 * turning it on reads the current lines straight away.
 */
export function setVoice(on: boolean, current?: { cue: Cue; locale: string; send: (message: ClientMessage) => void }) {
  voiceOn = on;
  try {
    if (on) localStorage.setItem(VOICE_KEY, "on");
    else localStorage.removeItem(VOICE_KEY);
  } catch {}
  if (!on) hushVoice();
  else if (hasVoice()) {
    window.speechSynthesis.cancel();
    if (current?.cue.lines.length) readCue(current.cue, current.locale, current.send);
    else window.speechSynthesis.speak(new SpeechSynthesisUtterance(" "));
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

/**
 * The best voice that speaks the language, from natural down to robotic.
 * Without one the browser falls back to the system voice, which may be
 * another language's (a French voice reading English with its accent).
 */
function pickVoice(locale: string) {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith(locale) && !JOKE.test(v.name));
  const human = voices.filter((v) => !ROBOTIC.test(v.name));
  return (
    human.find((v) => PREFERRED.test(v.name)) ??
    human.find((v) => v.default) ??
    human.find((v) => v.localService) ??
    human[0] ??
    voices[0]
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
  // Straight away when the voices are known: a phone only lets a tap's own call start speaking.
  if (synth.getVoices().length) return speakWith(synth, lines, lang, pickVoice(locale), estimate);
  return voicesReady().then(() => speakWith(synth, lines, lang, pickVoice(locale), estimate));
}

function speakWith(synth: SpeechSynthesis, lines: string[], lang: string, voice: SpeechSynthesisVoice | undefined, estimate: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    // Some browsers drop the end event: the game must not wait forever.
    setTimeout(finish, estimate * 2 + 5_000);
    lines.forEach((line, i) => {
      const utterance = new SpeechSynthesisUtterance(line);
      utterance.lang = voice?.lang ?? lang;
      if (voice) utterance.voice = voice;
      utterance.rate = 0.95;
      if (i === lines.length - 1) {
        utterance.onend = finish;
        utterance.onerror = finish;
      }
      synth.speak(utterance);
    });
  });
}

/** Stops reading at once (voice off, skipped, or this device stopped being the narrator). */
export function hushVoice() {
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
