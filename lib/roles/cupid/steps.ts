import { getAlive, log } from "../../engine/helpers";
import { EngineError } from "../../engine/types";
import { groupBeats, nightCall } from "../../auto/beats";
import { playOn, type StepModules } from "../../steps/step-module";

export const cupidSteps: StepModules<"cupid" | "lovers"> = {
  cupid: {
    resolve: (state, _, answer) => {
      const { lovers } = answer.expect("cupid");
      if (lovers === null) return;
      const [a, b] = lovers.map((id) => getAlive(state, id));
      if (a.id === b.id) throw new EngineError("invalid-target", "Pick two different players");
      state.lovers = [a.id, b.id];
      log(state, { type: "lovers", lovers: state.lovers });
    },
    actors: (step) => [step.playerId],
    turn: (_, { ids }) => ({ kind: "pick", step: "cupid", min: 2, max: 2, targets: ids(), skip: false }),
    timeout: () => ({ type: "cupid", lovers: null }),
    beats: nightCall("cupid"),
  },
  lovers: {
    resolve: playOn,
    beats: (_, { dict }) => groupBeats(dict, "lovers", true),
    group: (step) => ({ group: "lovers", ids: step.lovers }),
    check: (step, playerId) =>
      step.lovers.includes(playerId) ? { kind: "check", message: "lover", partnerId: step.lovers.find((id) => id !== playerId) } : null,
  },
};
