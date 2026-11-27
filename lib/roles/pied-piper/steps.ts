import { groupBeats, nightCall } from "../../auto/beats";
import { log } from "../../engine/helpers";
import { EngineError } from "../../engine/types";
import { playOn, type StepModules } from "../../steps/step-module";

export const piedPiperSteps: StepModules<"piper" | "charmed"> = {
  piper: {
    resolve: (state, step, answer) => {
      // Nobody: the Piper didn't choose in time (no game master).
      const targets = answer.expect("pick").targetIds.length === 0 ? [] : answer.picked(step.min, step.count);
      if (targets.some((t) => t.id === step.playerId || t.flags.charmed)) {
        throw new EngineError("invalid-target", "Pick players who aren't charmed yet");
      }
      targets.forEach((t) => (t.flags.charmed = true));
      log(state, { type: "charmed", targetIds: targets.map((t) => t.id) });
    },
    sleeper: () => "pied-piper",
    actors: (step) => [step.playerId],
    caller: () => "pied-piper",
    turn: (step, { ids, me }) => ({ kind: "pick", step: "piper", min: step.min, max: step.count, targets: ids((p) => p.id !== me.id && !p.flags.charmed), skip: false }),
    beats: nightCall("pied-piper"),
  },
  charmed: {
    resolve: playOn,
    beats: (_, { dict }) => groupBeats(dict, "charmed", true),
    group: (step) => ({ group: "charmed", ids: step.playerIds }),
    check: (step, playerId) => (step.newIds.includes(playerId) ? { kind: "check", message: "charmed" } : null),
  },
};
