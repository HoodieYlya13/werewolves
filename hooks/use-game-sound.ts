"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { GameState } from "@/lib/engine";
import { DAWN, HOWL, isMuted, leaveScene, loadSample, playStinger, setMuted, setScene, subscribeSound } from "@/lib/sound";
import { isWerewolves, sceneFor } from "@/lib/soundtrack";

/** The last stinger played, so a remount or a re-render doesn't ring it twice. */
let lastStinger = "";

/**
 * Plays the game's soundtrack on the game master's device. `lead`: a line the
 * game master reads before the step. While the last turn's "go back to sleep"
 * is on, its music keeps playing; while the night falls, it's the night's.
 */
export function useGameSound(game: GameState, actionCount: number, lead: "sleep" | "night" | null = null) {
  const scene = lead === "night" ? "night" : sceneFor(game);
  const held = lead === "sleep";
  const howl = isWerewolves(game);
  const theme = game.setup.settings.theme ?? "werewolves";
  // Fetched ahead, so the wolves' first howl and the first dawn don't wait for them.
  useEffect(() => {
    if (howl) void loadSample(HOWL);
    void loadSample(DAWN[theme] ?? DAWN.werewolves);
  }, [howl, theme]);
  useEffect(() => {
    if (!held) setScene(scene);
  }, [scene, held]);
  useEffect(() => leaveScene, []);

  const step = game.step;
  const deaths = step.kind === "deaths" ? step.deaths.length : 0;
  // Each day starts on its deaths screen, even when nobody died: that's dawn.
  const dawn = step.kind === "deaths" && step.context === "dawn";
  const winner = step.kind === "game-over" ? (step.winner.team ?? "other") : null;
  useEffect(() => {
    const key = `${game.setup.players.map((p) => p.id).join()}:${actionCount}`;
    if (lead || key === lastStinger || (deaths === 0 && !winner && !dawn)) return;
    lastStinger = key;
    if (winner) playStinger({ kind: "win", team: winner === "village" || winner === "wolves" ? winner : "other", howl });
    else if (dawn) playStinger({ kind: "dawn", theme, count: deaths });
    else playStinger({ kind: "deaths", count: deaths });
  }, [game.setup.players, actionCount, deaths, dawn, winner, howl, theme, lead]);
}

export function useSoundMuted() {
  return useSyncExternalStore(subscribeSound, isMuted, () => false);
}

export { setMuted };
