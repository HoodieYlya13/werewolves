"use client";

import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import { Say, Do, ContinueButton, nameOf, type StepProps, type StepScreens } from "@/components/host/step-parts";

function BearStep({ game, step, act }: StepProps<"bear">) {
  const { dict } = useI18n();
  const t = dict.game.steps.bear;
  return (
    <>
      <Say>{step.growls ? t.growls : t.quiet}</Say>
      {/* The tamer stays secret: only they know whose neighbours the bear means. */}
      {step.playerId && <Do>{format(t.secret, { name: nameOf(game, step.playerId) })}</Do>}
      <ContinueButton act={act} />
    </>
  );
}

export const bearTamerScreens: StepScreens<"bear"> = {
  bear: { Screen: BearStep },
};
