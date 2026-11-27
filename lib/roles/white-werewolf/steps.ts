import { isWolf, log } from "../../engine/helpers";
import { EngineError } from "../../engine/types";
import { nightCall } from "../../auto/beats";
import type { StepModules } from "../../steps/step-module";

export const whiteWerewolfSteps: StepModules<"white-werewolf"> = {
  "white-werewolf": {
    resolve: (state, step, answer) => {
      const [target] = answer.picked(0, 1);
      if (!target) return;
      if (!isWolf(target) || target.id === step.playerId) {
        throw new EngineError("invalid-target", "The White Werewolf can only kill another wolf");
      }
      state.night.whiteWerewolfTargetId = target.id;
      log(state, { type: "white-werewolf", targetId: target.id });
    },
    sleeper: () => "white-werewolf",
    actors: (step) => [step.playerId],
    turn: (_, { ids, me }) => ({ kind: "pick", step: "white-werewolf", min: 1, max: 1, targets: ids((p) => isWolf(p) && p.id !== me.id), skip: true }),
    beats: nightCall("white-werewolf"),
  },
};
