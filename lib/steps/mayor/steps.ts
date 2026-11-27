import { getAlive, log } from "../../engine/helpers";
import { format } from "../../i18n/config";
import { input, nameOf } from "../../auto/beats";
import { TIMING } from "../../auto/timing";
import type { Answer } from "../../engine/answer";
import type { GameState } from "../../engine/types";
import type { Call, StepModules, StepOf } from "../step-module";

/** Elected on the first day (when the game has a Mayor): double vote, breaks ties, names a successor. */
export const mayorElectionCall: Call = {
  id: "mayor-election",
  phase: "day",
  order: 10,
  build: (state) => (state.setup.settings.mayor && !state.mayorElected && state.phase.number > 0 ? { kind: "mayor-election" } : null),
};

function nameMayor(state: GameState, step: StepOf<"mayor-election" | "mayor-succession">, answer: Answer) {
  const target = getAlive(state, answer.expect("mayor").targetId);
  const previousId = step.kind === "mayor-succession" ? step.playerId : null;
  state.mayorId = target.id;
  state.mayorElected = true;
  log(state, { type: "mayor", playerId: target.id, previousId });
}

export const mayorSteps: StepModules<"mayor-election" | "mayor-succession"> = {
  "mayor-election": {
    resolve: nameMayor,
    beats: (_, { dict }) => [
      { say: [dict.auto.mayorStand], show: "candidacy", wait: { kind: "hold", ms: TIMING.candidacy } },
      { say: [dict.auto.mayorVote], wait: { kind: "ballot" } },
    ],
  },
  "mayor-succession": {
    resolve: nameMayor,
    actors: (step) => [step.playerId],
    caller: () => "mayor",
    turn: (_, { ids }) => ({ kind: "pick", step: "mayor-succession", min: 1, max: 1, targets: ids(), skip: false }),
    timeout: (step, game, random) => {
      const others = game.players.filter((p) => p.alive && p.id !== step.playerId);
      const pool = others.length ? others : game.players.filter((p) => p.alive);
      return { type: "mayor", targetId: pool[Math.floor(random() * pool.length)].id };
    },
    beats: (step, { dict, game }) => [input([format(dict.auto.succession, { name: nameOf(game, step.playerId) })])],
  },
};
