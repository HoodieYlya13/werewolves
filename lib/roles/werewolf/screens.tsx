"use client";

import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import { isWolf } from "@/lib/engine";
import { Say, Do, PickPlayers, nameOf, type StepProps, type StepScreens } from "@/components/host/step-parts";

function WolvesStep({ game, step, act }: StepProps<"wolves">) {
  const { dict } = useI18n();
  const t = dict.game.steps.wolves;
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{t.do}</Do>
      {game.rustTargetId && game.players.some((p) => p.id === game.rustTargetId && p.alive) && (
        <p className="rounded-xl bg-surface-2 px-4 py-2 text-sm">{format(t.sick, { name: nameOf(game, game.rustTargetId) })}</p>
      )}
      {step.littleGirlIds.map((id) => (
        <p key={id} className="rounded-xl bg-surface-2 px-4 py-2 text-sm">
          {format(t.littleGirl, { name: nameOf(game, id) })}
        </p>
      ))}
      <PickPlayers
        game={game}
        count={1}
        isDisabled={isWolf}
        onConfirm={([targetId]) => act({ type: "wolves", targetId: targetId ?? null })}
        skip={dict.game.skipTurn}
      />
    </>
  );
}

export const werewolfScreens: StepScreens<"wolves"> = {
  wolves: { Screen: WolvesStep },
};
