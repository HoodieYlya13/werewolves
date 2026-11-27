import { getPlayer, log } from "../../engine/helpers";
import { EngineError } from "../../engine/types";
import { nightCall } from "../../auto/beats";
import type { StepModules } from "../../steps/step-module";

export const defenderSteps: StepModules<"defender"> = {
  defender: {
    resolve: (state, step, answer) => {
      const defender = getPlayer(state, step.playerId);
      const [target] = answer.picked(0, 1);
      if (target && target.id === step.lastProtectedId) {
        throw new EngineError("invalid-target", "Can't protect the same player two nights in a row");
      }
      state.night.protectedId = target?.id ?? null;
      if (target) {
        defender.memo["last-protected"] = target.id;
        log(state, { type: "protected", targetId: target.id });
      } else {
        delete defender.memo["last-protected"];
      }
    },
    sleeper: () => "defender",
    actors: (step) => [step.playerId],
    turn: (step, { ids }) => ({
      kind: "pick",
      step: "defender",
      min: 1,
      max: 1,
      targets: ids((p) => p.id !== step.lastProtectedId),
      skip: true,
      lastId: step.lastProtectedId,
    }),
    beats: nightCall("defender"),
  },
};
