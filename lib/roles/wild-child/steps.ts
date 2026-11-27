import { getPlayer, log } from "../../engine/helpers";
import { EngineError } from "../../engine/types";
import { nightCall } from "../../auto/beats";
import type { StepModules } from "../../steps/step-module";

export const wildChildSteps: StepModules<"wild-child"> = {
  "wild-child": {
    resolve: (state, step, answer) => {
      // Nobody: the Wild Child didn't choose, and never turns.
      const [model] = answer.picked(0, 1);
      if (!model) return;
      if (model.id === step.playerId) throw new EngineError("invalid-target", "Pick someone else");
      getPlayer(state, step.playerId).memo.model = model.id;
      log(state, { type: "model", playerId: step.playerId, modelId: model.id });
    },
    sleeper: () => "wild-child",
    actors: (step) => [step.playerId],
    turn: (_, { ids, me }) => ({ kind: "pick", step: "wild-child", min: 1, max: 1, targets: ids((p) => p.id !== me.id), skip: false }),
    beats: nightCall("wild-child"),
  },
};
