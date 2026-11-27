import { getPlayer, log } from "../../engine/helpers";
import { roles } from "../../engine/roles";
import { EngineError } from "../../engine/types";
import { nightCall } from "../../auto/beats";
import type { StepModules } from "../../steps/step-module";

export const actorSteps: StepModules<"actor"> = {
  actor: {
    resolve: (state, step, answer) => {
      const pick = answer.choice();
      if (pick === null) return;
      const role = typeof pick === "number" ? state.actorCards[pick] : undefined;
      if (!role) throw new EngineError("invalid-action", "No such card");
      const actor = getPlayer(state, step.playerId);
      state.actorCards.splice(pick as number, 1);
      state.night.actorRole = role;
      actor.uses = { ...actor.uses, ...roles[role].uses };
      log(state, { type: "actor", playerId: actor.id, role });
    },
    sleeper: () => "actor",
    actors: (step) => [step.playerId],
    turn: (step) => ({ kind: "cards", step: "actor", cards: step.cards, canKeep: true }),
    timeout: () => ({ type: "choose", value: null }),
    beats: nightCall("actor"),
  },
};
