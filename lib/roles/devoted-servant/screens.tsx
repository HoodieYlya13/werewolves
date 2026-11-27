"use client";

import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import { Say, Do, ChoiceButtons, nameOf, type StepProps, type StepScreens } from "@/components/host/step-parts";

function ServantStep({ game, step, act }: StepProps<"servant">) {
  const { dict } = useI18n();
  const t = dict.game.steps.servant;
  return (
    <>
      <Say>{format(t.say, { name: nameOf(game, step.victimId) })}</Say>
      <Do>{format(t.do, { servant: nameOf(game, step.playerId) })}</Do>
      <ChoiceButtons
        options={[
          { label: t.take, onClick: () => act({ type: "choose", value: true }) },
          { label: t.no, onClick: () => act({ type: "choose", value: false }), ghost: true },
        ]}
      />
    </>
  );
}

export const devotedServantScreens: StepScreens<"servant"> = {
  servant: { Screen: ServantStep },
};
