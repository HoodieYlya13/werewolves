"use client";

import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import { Say, Do, PickPlayers, nameOf, pickOf, type StepProps, type StepScreens } from "@/components/host/step-parts";

function RavenStep({ game, step, act }: StepProps<"raven">) {
  const { dict } = useI18n();
  const t = dict.game.steps.raven;
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <PickPlayers game={game} count={1} onConfirm={(ids) => act(pickOf(ids))} skip={t.skip} />
    </>
  );
}

export const ravenScreens: StepScreens<"raven"> = {
  raven: { Screen: RavenStep },
};
