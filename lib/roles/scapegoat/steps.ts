import { alive, log } from "../../engine/helpers";
import { input, nameOf } from "../../auto/beats";
import { format } from "../../i18n/config";
import type { StepModules } from "../../steps/step-module";

export const scapegoatSteps: StepModules<"scapegoat"> = {
  scapegoat: {
    resolve: (state, _, answer) => {
      const voters = answer.picked(0, alive(state).length);
      state.votersOnly = { day: state.phase.number + 1, ids: voters.map((p) => p.id) };
      log(state, { type: "scapegoat", voterIds: state.votersOnly.ids });
    },
    actors: (step) => [step.playerId],
    turn: (_, { ids }) => ({ kind: "pick", step: "scapegoat", min: 1, max: ids().length, targets: ids(), skip: false }),
    // Nobody chosen: everyone may vote.
    timeout: (_, game) => ({ type: "pick", targetIds: game.players.filter((p) => p.alive).map((p) => p.id) }),
    beats: (step, { dict, game }) => [input([format(dict.auto.scapegoat, { name: nameOf(game, step.playerId) })])],
  },
};
