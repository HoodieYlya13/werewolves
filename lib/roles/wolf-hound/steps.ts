import { getPlayer, log } from "../../engine/helpers";
import { EngineError } from "../../engine/types";
import { nightCall } from "../../auto/beats";
import type { StepModules } from "../../steps/step-module";

export const wolfHoundSteps: StepModules<"wolf-hound"> = {
  "wolf-hound": {
    resolve: (state, step, answer) => {
      const side = answer.choice();
      if (side !== "village" && side !== "wolves") throw new EngineError("invalid-action", "Choose a side");
      if (side === "wolves") getPlayer(state, step.playerId).flags["turned-wolf"] = true;
      log(state, { type: "wolf-hound", playerId: step.playerId, side });
    },
    sleeper: () => "wolf-hound",
    actors: (step) => [step.playerId],
    turn: () => ({ kind: "choice", step: "wolf-hound" }),
    timeout: () => ({ type: "choose", value: "village" }),
    beats: nightCall("wolf-hound"),
  },
};
