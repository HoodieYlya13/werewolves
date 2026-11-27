"use client";

import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import { Say, Do, PickPlayers, nameOf, pickOf, type StepProps, type StepScreens } from "@/components/host/step-parts";

function DefenderStep({ game, step, act }: StepProps<"defender">) {
  const { dict } = useI18n();
  const t = dict.game.steps.defender;
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      {step.lastProtectedId && <Do>{format(t.last, { name: nameOf(game, step.lastProtectedId) })}</Do>}
      <PickPlayers
        game={game}
        count={1}
        isDisabled={(p) => p.id === step.lastProtectedId}
        onConfirm={(ids) => act(pickOf(ids))}
        skip={t.skip}
      />
    </>
  );
}

export const defenderScreens: StepScreens<"defender"> = {
  defender: { Screen: DefenderStep },
};
