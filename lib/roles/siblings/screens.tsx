"use client";

import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import { Say, Do, ContinueButton, names, type StepProps, type StepScreens } from "@/components/host/step-parts";

function SiblingsStep({ game, step, act }: StepProps<"siblings">) {
  const { dict } = useI18n();
  const t = dict.game.steps.siblings;
  return (
    <>
      <Say>{t[step.role]}</Say>
      <Do>{format(t.do, { names: names(game, step.playerIds) })}</Do>
      <ContinueButton act={act} />
    </>
  );
}

export const siblingsScreens: StepScreens<"siblings"> = {
  siblings: { Screen: SiblingsStep },
};
