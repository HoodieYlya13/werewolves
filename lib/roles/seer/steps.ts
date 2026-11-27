import { getAlive, log } from "../../engine/helpers";
import { EngineError } from "../../engine/types";
import { actorCall, nightCall } from "../../auto/beats";
import { TIMING } from "../../auto/timing";
import { playOn, type StepModules } from "../../steps/step-module";

export const seerSteps: StepModules<"seer" | "seer-result"> = {
  seer: {
    resolve: (state, step, answer) => {
      const { targetId } = answer.expect("seer");
      if (targetId === null) return;
      const target = getAlive(state, targetId);
      if (target.id === step.playerId) throw new EngineError("invalid-target", "The Seer can't look at their own card");
      state.pending.unshift({ kind: "seer-result", playerId: step.playerId, targetId: target.id, role: target.role });
      log(state, { type: "seer", playerId: step.playerId, targetId: target.id, role: target.role });
    },
    // Skipped: no result screen follows to put the Seer back to sleep.
    sleeper: (_, next) => (next.kind === "seer-result" ? null : "seer"),
    actors: (step) => [step.playerId],
    turn: (_, { ids, me }) => ({ kind: "pick", step: "seer", min: 1, max: 1, targets: ids((p) => p.id !== me.id), skip: false }),
    timeout: () => ({ type: "seer", targetId: null }),
    beats: nightCall("seer"),
  },
  "seer-result": {
    resolve: playOn,
    beats: (_, { dict, game }) => [
      { say: [], show: "result", wait: { kind: "hold", ms: TIMING.look } },
      { say: [actorCall(dict, game, dict.game.steps["seer-result"].say)], wait: { kind: "hold", ms: TIMING.sleep } },
    ],
    result: (step) => ({ playerId: step.playerId, turn: { kind: "seer-result", targetId: step.targetId, role: step.role } }),
  },
};
