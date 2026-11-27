import { getAlive, getPlayer, log } from "../../engine/helpers";
import { infectedBeats, nightCall } from "../../auto/beats";
import { playOn, type StepModules } from "../../steps/step-module";

export const accursedWolfFatherSteps: StepModules<"infect" | "infected"> = {
  infect: {
    resolve: (state, step, answer) => {
      if (answer.choice() !== true) return;
      const father = getPlayer(state, step.playerId);
      father.uses.infect = (father.uses.infect ?? 1) - 1;
      getAlive(state, step.victimId).flags.infected = true;
      state.night.infected = true;
      log(state, { type: "infected", targetId: step.victimId });
    },
    sleeper: () => "accursed-wolf-father",
    actors: (step) => [step.playerId],
    caller: () => "accursed-wolf-father",
    turn: (step) => ({ kind: "choice", step: "infect", victimId: step.victimId }),
    timeout: () => ({ type: "choose", value: false }),
    beats: nightCall("accursed-wolf-father"),
  },
  /** Tonight's newly infected, told with a touch on the shoulder (a bluff when nobody was). */
  infected: {
    resolve: playOn,
    beats: (_, { dict }) => infectedBeats(dict),
    check: (step, playerId) => (step.playerIds.includes(playerId) ? { kind: "check", message: "infected" } : null),
    // Every phone lights up, the newly infected's says so: like the touch on the shoulder.
    masterShow: () => "check",
  },
};
