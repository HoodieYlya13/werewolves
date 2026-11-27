"use client";

import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import { Say, Do, PickPlayers, living, nameOf, pickOf, type StepProps, type StepScreens } from "@/components/host/step-parts";

function ScapegoatStep({ game, step, act }: StepProps<"scapegoat">) {
  const { dict } = useI18n();
  const t = dict.game.steps.scapegoat;
  return (
    <>
      <Say>{format(t.say, { name: nameOf(game, step.playerId) })}</Say>
      <Do>{t.do}</Do>
      <PickPlayers
        game={game}
        count={living(game).length}
        min={1}
        onConfirm={(ids) => act(pickOf(ids))}
        skip={dict.game.events.scapegoatNobody}
      />
    </>
  );
}

export const scapegoatScreens: StepScreens<"scapegoat"> = {
  scapegoat: { Screen: ScapegoatStep },
};
