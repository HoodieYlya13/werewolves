"use client";

import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import { Say, Do, ChoiceButtons, nameOf, type StepProps, type StepScreens } from "@/components/host/step-parts";

function WolfHoundStep({ game, step, act }: StepProps<"wolf-hound">) {
  const { dict } = useI18n();
  const t = dict.game.steps["wolf-hound"];
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <ChoiceButtons
        options={[
          { label: t.village, onClick: () => act({ type: "choose", value: "village" }), ghost: true },
          { label: t.wolves, onClick: () => act({ type: "choose", value: "wolves" }) },
        ]}
      />
    </>
  );
}

export const wolfHoundScreens: StepScreens<"wolf-hound"> = {
  "wolf-hound": {
    describe: (_, __, action, dict) => (action.type === "choose" ? dict.game.steps["wolf-hound"][action.value as "village" | "wolves"] : ""),
    Screen: WolfHoundStep,
  },
};
