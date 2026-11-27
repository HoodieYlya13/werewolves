import { getAlive } from "../../engine/helpers";
import { kill } from "../../engine/deaths";
import { input, nameOf } from "../../auto/beats";
import { format } from "../../i18n/config";
import type { StepModules } from "../../steps/step-module";

export const hunterSteps: StepModules<"hunter"> = {
  hunter: {
    resolve: (state, _, answer) => {
      const { targetId } = answer.expect("hunter");
      if (targetId === null) return;
      kill(state, [{ playerId: getAlive(state, targetId).id, cause: "hunter" }], "hunter");
    },
    actors: (step) => [step.playerId],
    turn: (_, { ids }) => ({ kind: "pick", step: "hunter", min: 1, max: 1, targets: ids(), skip: false }),
    timeout: () => ({ type: "hunter", targetId: null }),
    beats: (step, { dict, game }) => [input([format(dict.auto.hunter, { name: nameOf(game, step.playerId) })])],
  },
};
