import { nameOf } from "../../auto/beats";
import { format } from "../../i18n/config";
import { playOn, type StepModules } from "../../steps/step-module";

/** Voted out, the Idiot shows their card and stays, without a vote from now on. */
export const villageIdiotSteps: StepModules<"idiot"> = {
  idiot: {
    resolve: playOn,
    beats: (step, { dict, game }) => [{ say: [format(dict.game.steps.idiot.say, { name: nameOf(game, step.playerId) })], wait: { kind: "hold", ms: 2_000 } }],
  },
};
