"use client";

import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import { Say, Do, ContinueButton, PickPlayers, nameOf, names, pickOf, type StepProps, type StepScreens } from "@/components/host/step-parts";

function PiperStep({ game, step, act }: StepProps<"piper">) {
  const { dict } = useI18n();
  const t = dict.game.steps.piper;
  return (
    <>
      <Say>{format(t.say, { count: step.min === step.count ? step.count : `${step.min}–${step.count}` })}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <PickPlayers
        game={game}
        count={step.count}
        min={step.min}
        isDisabled={(p) => p.id === step.playerId || !!p.flags.charmed}
        onConfirm={(ids) => act(pickOf(ids))}
        skip={dict.game.skipTurn}
      />
    </>
  );
}

function CharmedStep({ game, step, act }: StepProps<"charmed">) {
  const { dict } = useI18n();
  const t = dict.game.steps.charmed;
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { names: names(game, step.playerIds), newNames: names(game, step.newIds) })}</Do>
      <ContinueButton act={act} />
    </>
  );
}

export const piedPiperScreens: StepScreens<"piper" | "charmed"> = {
  piper: { Screen: PiperStep },
  charmed: { Screen: CharmedStep },
};
