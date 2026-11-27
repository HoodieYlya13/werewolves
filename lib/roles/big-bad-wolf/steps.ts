import { isWolf, log } from "../../engine/helpers";
import { EngineError } from "../../engine/types";
import { nightCall } from "../../auto/beats";
import type { StepModules } from "../../steps/step-module";

export const bigBadWolfSteps: StepModules<"big-bad-wolf"> = {
  "big-bad-wolf": {
    resolve: (state, _, answer) => {
      const [target] = answer.picked(0, 1);
      if (!target) return;
      if (isWolf(target)) throw new EngineError("invalid-target", "Wolves can't eat a wolf");
      if (target.id === state.night.wolvesTargetId) throw new EngineError("invalid-target", "Already the wolves' victim");
      state.night.bigBadWolfTargetId = target.id;
      log(state, { type: "big-bad-wolf", targetId: target.id });
    },
    sleeper: () => "big-bad-wolf",
    actors: (step) => [step.playerId],
    turn: (step, { ids }) => ({ kind: "pick", step: "big-bad-wolf", min: 1, max: 1, targets: ids((p) => !isWolf(p) && p.id !== step.wolvesTargetId), skip: true }),
    beats: nightCall("big-bad-wolf"),
  },
};
