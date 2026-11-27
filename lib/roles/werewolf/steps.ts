import { getAlive, isWolf, log, sickTonight } from "../../engine/helpers";
import { EngineError, type GameState, type Step } from "../../engine/types";
import { nightCall } from "../../auto/beats";
import type { StepModules } from "../../steps/step-module";

export const werewolfSteps: StepModules<"wolves"> = {
  wolves: {
    resolve: (state, _, answer) => {
      const { targetId } = answer.expect("wolves");
      if (targetId === null) return;
      const target = getAlive(state, targetId);
      if (isWolf(target)) throw new EngineError("invalid-target", "Wolves can't eat a wolf");
      state.night.wolvesTargetId = target.id;
      log(state, { type: "wolves-target", targetId: target.id });
    },
    // The pack sleeps before the Wolf-Father answers: it never learns which wolf he is.
    sleeper: () => "wolves",
    actors: (step) => step.playerIds,
    caller: () => "wolves",
    turn: (step, { ids, wolfPicks }) => ({ kind: "wolves", targets: ids((p) => !isWolf(p)), wolves: step.playerIds, picks: wolfPicks }),
    // Caught by the rusty sword, he wakes with the pack out of habit: his phone sends him back to sleep.
    bystander: (_, { game, me }) => (sickTonight(game, me.id) ? { kind: "check", message: "sick" } : null),
    jointAnswer: (step, picks) => {
      const targetId = agreedVictim(step, picks);
      return targetId ? { type: "wolves", targetId } : null;
    },
    timeout: () => ({ type: "wolves", targetId: null }),
    beats: nightCall("wolves"),
  },
};

/** The pack's victim, once every wolf points at the same one. */
export function agreedVictim(step: Extract<Step, { kind: "wolves" }>, picks: Record<string, string>) {
  const chosen = step.playerIds.map((id) => picks[id]);
  return chosen.length > 0 && chosen.every((id) => id && id === chosen[0]) ? chosen[0] : null;
}

/** A wolf's pick for the pack, with or without a game master. */
export function setWolfPick(game: GameState, picks: Record<string, string>, playerId: string, targetId: string | null) {
  const step = game.step;
  if (step.kind !== "wolves" || !step.playerIds.includes(playerId)) return false;
  if (targetId === null) {
    delete picks[playerId];
    return true;
  }
  const target = game.players.find((p) => p.id === targetId);
  if (!target?.alive || isWolf(target)) return false;
  picks[playerId] = targetId;
  return true;
}
