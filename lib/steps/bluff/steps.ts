import { format } from "../../i18n/config";
import type { Dictionary } from "../../i18n/dictionaries/en";
import type { GameState } from "../../engine/types";
import { callerName, groupBeats, hash, infectedBeats, wakeLine, type Beat, type Caller } from "../../auto/beats";
import { TIMING } from "../../auto/timing";
import { playOn, type StepModules, type StepOf } from "../step-module";

/** Group calls that end with everyone going back to sleep by themselves. */
const SELF_CLOSING = ["lovers", "charmed", "two-sisters", "three-brothers"];

const bluffCaller = (step: StepOf<"bluff">): Caller => (step.turn === "wolves" ? "wolves" : step.role);

/** The pack is always spoken to as many, however many are left. */
export function reminderLine(dict: Dictionary, caller: Caller, kind: "reminder" | "lastCall") {
  const pack = caller === "wolves";
  return kind === "reminder" ? (pack ? dict.auto.reminderPack : dict.auto.reminder) : pack ? dict.auto.lastCallPack : dict.auto.lastCall;
}

/** A lone turn's call, word for word: some drag on like a slow player's turn, reminders included. */
function loneTurnBeats(dict: Dictionary, game: GameState, step: StepOf<"bluff">, seed: string): Beat[] {
  const h = hash(seed);
  const reminders = h % 10 < 2 ? 2 : h % 10 < 5 ? 1 : 0;
  const tail = 3_000 + (h % 22_000);
  const role = callerName(dict, bluffCaller(step));
  const beats: Beat[] = [{ say: [wakeLine(dict, game, step.turn)], wait: { kind: "hold", ms: reminders ? TIMING.reminder : 9_000 + tail } }];
  if (reminders) beats.push({ say: [format(reminderLine(dict, bluffCaller(step), "reminder"), { role })], wait: { kind: "hold", ms: reminders > 1 ? TIMING.lastCall - TIMING.reminder : tail } });
  if (reminders > 1) beats.push({ say: [format(reminderLine(dict, bluffCaller(step), "lastCall"), { role })], wait: { kind: "hold", ms: tail } });
  return beats;
}

/**
 * A night turn nobody can play (dead, out of power, card left over). The
 * narrator still calls it unless the village knows it's gone, so nobody can tell.
 */
export const bluffSteps: StepModules<"bluff"> = {
  bluff: {
    resolve: playOn,
    sleeper: (step) => {
      if (step.turn === "wolves") return "wolves";
      return SELF_CLOSING.includes(step.turn) ? null : step.role;
    },
    caller: bluffCaller,
    // Exactly like the real turn, with nobody playing it.
    beats: (step, { dict, game, seed }) => {
      if (step.turn === "lovers" || step.turn === "charmed") return groupBeats(dict, step.turn, true, seed);
      if (step.turn === "infected") return infectedBeats(dict);
      if (step.turn === "two-sisters" || step.turn === "three-brothers") return groupBeats(dict, step.turn, false, seed);
      return loneTurnBeats(dict, game, step, seed);
    },
    masterShow: (step) => (step.turn === "infected" ? "check" : undefined),
  },
};
