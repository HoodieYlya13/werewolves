import { playOn, type StepModules } from "../../steps/step-module";

export const bearTamerSteps: StepModules<"bear"> = {
  bear: {
    resolve: playOn,
    beats: (step, { dict }) => [{ say: [step.growls ? dict.game.steps.bear.growls : dict.game.steps.bear.quiet], wait: { kind: "hold", ms: 2_000 } }],
  },
};
