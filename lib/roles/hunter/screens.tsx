"use client";

import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import { Say, Do, PickPlayers, nameOf, type StepProps, type StepScreens } from "@/components/host/step-parts";

function HunterStep({ game, step, act }: StepProps<"hunter">) {
  const { dict } = useI18n();
  const t = dict.game.steps.hunter;
  const name = nameOf(game, step.playerId);
  return (
    <>
      <Say>{format(t.say, { name })}</Say>
      <Do>{format(t.do, { name })}</Do>
      <PickPlayers game={game} count={1} onConfirm={([targetId]) => act({ type: "hunter", targetId: targetId ?? null })} skip={dict.game.skipTurn} />
    </>
  );
}

export const hunterScreens: StepScreens<"hunter"> = {
  hunter: { Screen: HunterStep },
};
