import type { GameState } from "./engine";
import type { Scene } from "./sound";

/**
 * The music for each night turn, by step kind or by the turn a bluff stands
 * in for: a turn nobody can play sounds exactly like a real one.
 */
const nightScenes: Record<string, Scene> = {
  wolves: "wolves",
  infect: "wolves",
  "accursed-wolf-father": "wolves",
  "big-bad-wolf": "wolves",
  "white-werewolf": "wolves",
  witch: "witch",
  seer: "seer",
  "seer-result": "seer",
  fox: "seer",
  "fox-result": "seer",
  cupid: "love",
  lovers: "love",
  piper: "piper",
  "pied-piper": "piper",
  charmed: "piper",
};

export function sceneFor(game: GameState): Scene | null {
  const step = game.step;
  if (step.kind === "prologue") return "prologue";
  if (step.kind === "game-over") return null;
  if (game.phase.kind === "day") return step.kind === "vote" ? "vote" : "day";
  const scene = nightScenes[step.kind === "bluff" ? step.turn : step.kind] ?? "night";
  // Werewolves howl; the other themes' killers (mafia, vampires, impostors) don't.
  return scene === "wolves" && isWerewolves(game) ? "howl" : scene;
}

export const isWerewolves = (game: GameState) => (game.setup.settings.theme ?? "werewolves") === "werewolves";
