"use client";

import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import { Do, ChoiceButtons, nameOf, type StepProps, type StepScreens } from "@/components/host/step-parts";

function JudgeStep({ game, step, act }: StepProps<"judge">) {
  const { dict } = useI18n();
  const t = dict.game.steps.judge;
  return (
    <>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <ChoiceButtons
        options={[
          { label: t.yes, onClick: () => act({ type: "choose", value: true }) },
          { label: t.no, onClick: () => act({ type: "choose", value: false }), ghost: true },
        ]}
      />
    </>
  );
}

export const stutteringJudgeScreens: StepScreens<"judge"> = {
  judge: { Screen: JudgeStep },
};
