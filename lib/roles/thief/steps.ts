import { getPlayer, log } from "../../engine/helpers";
import { roles } from "../../engine/roles";
import { EngineError } from "../../engine/types";
import { nightCall } from "../../auto/beats";
import type { StepModules } from "../../steps/step-module";

export const thiefSteps: StepModules<"thief"> = {
  thief: {
    resolve: (state, step, answer) => {
      const { pick } = answer.expect("thief");
      if (pick === null) {
        if (step.mustTakeWolf) throw new EngineError("invalid-action", "The Thief must take a Werewolf");
        return;
      }
      const card = state.extraCards[pick];
      if (card === undefined) throw new EngineError("invalid-action", "No such card");
      const thief = getPlayer(state, step.playerId);
      state.extraCards[pick] = thief.role;
      log(state, { type: "thief-swap", playerId: thief.id, from: thief.role, to: card });
      thief.role = card;
      thief.uses = { ...roles[card].uses };
    },
    sleeper: () => "thief",
    actors: (step) => [step.playerId],
    turn: (step) => ({ kind: "cards", step: "thief", cards: step.cards, canKeep: !step.mustTakeWolf }),
    timeout: (step) => ({ type: "thief", pick: step.mustTakeWolf ? 0 : null }),
    beats: nightCall("thief"),
  },
};
