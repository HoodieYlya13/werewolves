import { getPlayer, log } from "../../engine/helpers";
import { roles } from "../../engine/roles";
import { input, nameOf } from "../../auto/beats";
import { format } from "../../i18n/config";
import type { StepModules } from "../../steps/step-module";

export const devotedServantSteps: StepModules<"servant"> = {
  servant: {
    resolve: (state, step, answer) => {
      // Left alone, the card is announced (the deaths step, next), then its own triggers.
      if (answer.choice() !== true) {
        state.pending.splice(state.pending[0]?.kind === "deaths" ? 1 : 0, 0, ...step.roleTriggers);
        return;
      }
      // She takes the card unseen, with its powers as new (a Fox who missed, used potions…):
      // the dead player's own death power is hers now, and her own card is the one shown.
      const servant = getPlayer(state, step.playerId);
      const victim = getPlayer(state, step.victimId);
      const role = victim.role;
      servant.role = role;
      servant.uses = { ...roles[role].uses };
      victim.memo.card = "devoted-servant";
      log(state, { type: "servant", playerId: servant.id, role });
    },
    actors: (step) => [step.playerId],
    caller: () => "devoted-servant",
    turn: (step) => ({ kind: "choice", step: "servant", victimId: step.victimId }),
    timeout: () => ({ type: "choose", value: false }),
    beats: (step, { dict, game }) => [input([format(dict.auto.servant, { name: nameOf(game, step.victimId) })], true)],
  },
};
