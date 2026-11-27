import { log } from "../../engine/helpers";
import { nightCall } from "../../auto/beats";
import type { StepModules } from "../../steps/step-module";

export const ravenSteps: StepModules<"raven"> = {
  raven: {
    resolve: (state, _, answer) => {
      const [target] = answer.picked(0, 1);
      if (!target) return;
      state.ravenTargetId = target.id;
      log(state, { type: "raven", targetId: target.id });
    },
    sleeper: () => "raven",
    actors: (step) => [step.playerId],
    turn: (_, { ids }) => ({ kind: "pick", step: "raven", min: 1, max: 1, targets: ids(), skip: true }),
    beats: nightCall("raven"),
  },
};
