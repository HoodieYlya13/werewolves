"use client";

import { useI18n } from "@/components/i18n-provider";
import { Say, Do, StartPhaseButton, type StepProps, type StepScreens } from "@/components/host/step-parts";
import { phaseEndLine } from "./steps";

/** The end of a night or day: a pause, a line of story, then the game master moves on. */
function PhaseEndStep({ game, step, act }: StepProps<"phase-end">) {
  const { dict } = useI18n();
  const t = dict.game.story;
  return (
    <>
      <Say>{phaseEndLine(dict, game, step)}</Say>
      <Do>{step.next.kind === "day" ? t.nightEndsDo : t.dayEndsDo}</Do>
      <StartPhaseButton act={act} next={step.next} />
    </>
  );
}

export const phaseEndScreens: StepScreens<"phase-end"> = {
  "phase-end": { Screen: PhaseEndStep },
};
