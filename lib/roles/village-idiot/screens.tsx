"use client";

import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import { Say, ContinueButton, nameOf, type StepProps, type StepScreens } from "@/components/host/step-parts";

function IdiotStep({ game, step, act }: StepProps<"idiot">) {
  const { dict } = useI18n();
  return (
    <>
      <Say>{format(dict.game.steps.idiot.say, { name: nameOf(game, step.playerId) })}</Say>
      <ContinueButton act={act} />
    </>
  );
}

export const villageIdiotScreens: StepScreens<"idiot"> = {
  idiot: { Screen: IdiotStep },
};
