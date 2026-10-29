"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { GameState } from "@/lib/engine";
import { isMuted, leaveScene, playStinger, setMuted, setScene, subscribeSound } from "@/lib/sound";
import { sceneFor } from "@/lib/soundtrack";

/** The last stinger played, so a remount or a re-render doesn't ring it twice. */
let lastStinger = "";

/** Plays the game's soundtrack on the game master's device. */
export function useGameSound(game: GameState, actionCount: number) {
  const scene = sceneFor(game);
  useEffect(() => setScene(scene), [scene]);
  useEffect(() => leaveScene, []);

  const step = game.step;
  const deaths = step.kind === "deaths" ? step.deaths.length : 0;
  const winner = step.kind === "game-over" ? (step.winner.team ?? "other") : null;
  useEffect(() => {
    const key = `${game.setup.players.map((p) => p.id).join()}:${actionCount}`;
    if (key === lastStinger || (deaths === 0 && !winner)) return;
    lastStinger = key;
    if (winner) playStinger({ kind: "win", team: winner === "village" || winner === "wolves" ? winner : "other" });
    else playStinger({ kind: "deaths", count: deaths });
  }, [game.setup.players, actionCount, deaths, winner]);
}

export function useSoundMuted() {
  return useSyncExternalStore(subscribeSound, isMuted, () => false);
}

export { setMuted };
