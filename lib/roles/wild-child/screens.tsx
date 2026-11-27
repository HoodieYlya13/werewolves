"use client";

import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import { Say, Do, PickPlayers, nameOf, pickOf, type StepProps, type StepScreens } from "@/components/host/step-parts";

function WildChildStep({ game, step, act }: StepProps<"wild-child">) {
  const { dict } = useI18n();
  const t = dict.game.steps["wild-child"];
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <PickPlayers
        game={game}
        count={1}
        isDisabled={(p) => p.id === step.playerId}
        onConfirm={(ids) => act(pickOf(ids))}
        skip={dict.game.skipTurn}
      />
    </>
  );
}

export const wildChildScreens: StepScreens<"wild-child"> = {
  "wild-child": { Screen: WildChildStep },
};
