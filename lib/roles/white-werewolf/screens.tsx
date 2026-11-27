"use client";

import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import { isWolf } from "@/lib/engine";
import { Say, Do, PickPlayers, nameOf, pickOf, type StepProps, type StepScreens } from "@/components/host/step-parts";

function WhiteWerewolfStep({ game, step, act }: StepProps<"white-werewolf">) {
  const { dict } = useI18n();
  const t = dict.game.steps["white-werewolf"];
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <PickPlayers
        game={game}
        count={1}
        isDisabled={(p) => !isWolf(p) || p.id === step.playerId}
        onConfirm={(ids) => act(pickOf(ids))}
        skip={t.skip}
      />
    </>
  );
}

export const whiteWerewolfScreens: StepScreens<"white-werewolf"> = {
  "white-werewolf": { Screen: WhiteWerewolfStep },
};
