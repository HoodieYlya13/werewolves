import { getPlayer, log } from "../../engine/helpers";
import { voteStep } from "../../steps/vote/steps";
import { input } from "../../auto/beats";
import type { StepModules } from "../../steps/step-module";

export const stutteringJudgeSteps: StepModules<"judge"> = {
  judge: {
    resolve: (state, step, answer) => {
      if (answer.choice() !== true) return;
      getPlayer(state, step.playerId).uses["second-vote"] = 0;
      state.pending.unshift(voteStep(state, true));
      log(state, { type: "second-vote" });
    },
    actors: (step) => [step.playerId],
    caller: () => "stuttering-judge",
    turn: () => ({ kind: "choice", step: "judge" }),
    timeout: () => ({ type: "choose", value: false }),
    // The Judge's call stays secret: a short silence either way.
    beats: () => [input([], true)],
  },
};
