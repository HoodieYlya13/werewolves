"use client";

import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import { Say, Do, ContinueButton, PickPlayers, nameOf, type StepProps, type StepScreens } from "@/components/host/step-parts";

function CupidStep({ game, step, act }: StepProps<"cupid">) {
  const { dict } = useI18n();
  const t = dict.game.steps.cupid;
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <PickPlayers
        game={game}
        count={2}
        onConfirm={(ids) => act({ type: "cupid", lovers: ids.length === 2 ? [ids[0], ids[1]] : null })}
        skip={dict.game.skipTurn}
      />
    </>
  );
}

function LoversStep({ game, step, act }: StepProps<"lovers">) {
  const { dict } = useI18n();
  const t = dict.game.steps.lovers;
  const [a, b] = step.lovers.map((id) => nameOf(game, id));
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { a, b })}</Do>
      <ContinueButton act={act} />
    </>
  );
}

export const cupidScreens: StepScreens<"cupid" | "lovers"> = {
  cupid: { Screen: CupidStep },
  lovers: { Screen: LoversStep },
};
