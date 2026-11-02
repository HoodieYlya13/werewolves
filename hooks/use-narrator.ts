"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { DAWN, HOWL, isMuted, leaveScene, loadSample, playStinger, setScene, subscribeSound } from "@/lib/sound";
import type { ClientMessage, Speaker } from "@/lib/protocol";

/**
 * The narrator, without a game master: one device reads the room's lines out
 * loud with the browser's own voice (Web Speech API), plays the soundtrack,
 * and tells the room when it's done so the game moves on. Muted, or in a
 * browser without a voice, the lines stay on screen for someone to read.
 */
export function useNarrator(speaker: Speaker | null, send: (message: ClientMessage) => void) {
  const scene = speaker?.scene ?? null;
  const on = !!speaker;
  useEffect(() => {
    if (!on) return;
    void loadSample(HOWL);
    for (const url of Object.values(DAWN)) void loadSample(url);
  }, [on]);
  useEffect(() => {
    if (on) setScene(scene);
  }, [on, scene]);
  useEffect(() => (on ? leaveScene : undefined), [on]);

  const cue = speaker?.cue ?? null;
  const locale = speaker?.locale ?? "en";
  // Cues already read here: a new view of the same cue doesn't read it twice.
  const read = useRef(0);
  const sender = useRef(send);
  useEffect(() => {
    sender.current = send;
  });
  useEffect(() => {
    if (!cue || cue.id <= read.current) return;
    read.current = cue.id;
    if (cue.sound) playStinger(cue.sound);
    // The dawn sound plays first: the voice waits for it.
    const delay = cue.sound?.kind === "dawn" ? 2_500 : cue.sound?.kind === "win" ? 3_000 : 0;
    const timer = setTimeout(() => void speak(cue.lines, locale).then(() => sender.current({ type: "cue-done", id: cue.id })), delay);
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

let primed = false;

/**
 * Phones only let a page speak after a tap: the first one anywhere (or the
 * "turn on the voice" button) unlocks it with a silent line.
 */
export function primeVoice() {
  if (primed || !hasVoice()) return;
  primed = true;
  const silent = new SpeechSynthesisUtterance(" ");
  silent.volume = 0;
  window.speechSynthesis.speak(silent);
}
if (typeof window !== "undefined") addEventListener("pointerdown", primeVoice, { once: true });

export const isVoicePrimed = () => primed;

/** Reads lines one after the other; resolves when done (or after a while, if the voice never says). */
function speak(lines: string[], locale: string): Promise<void> {
  const words = lines.join(" ").split(/\s+/).filter(Boolean).length;
  const estimate = 800 + words * 380;
  if (!lines.length) return Promise.resolve();
  if (!hasVoice() || isMuted()) return new Promise((resolve) => setTimeout(resolve, estimate));
  const synth = window.speechSynthesis;
  const lang = locale === "fr" ? "fr-FR" : "en-GB";
  const voice = synth.getVoices().find((v) => v.lang.replace("_", "-").toLowerCase().startsWith(locale));
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
      utterance.lang = lang;
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

/** Stops reading at once (muted, or this device stopped being the narrator). */
export function hushVoice() {
  if (hasVoice()) window.speechSynthesis.cancel();
}

export function useMutedVoice() {
  return useSyncExternalStore(subscribeSound, isMuted, () => false);
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
