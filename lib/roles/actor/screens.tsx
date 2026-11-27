"use client";

import { useI18n } from "@/components/i18n-provider";
import { RoleName } from "@/components/game/role-chip";
import { Button } from "@/components/ui/button";
import { format } from "@/lib/i18n/config";
import { Say, Do, nameOf, type StepProps, type StepScreens } from "@/components/host/step-parts";


function ActorStep({ game, step, act }: StepProps<"actor">) {
  const { dict } = useI18n();
  const t = dict.game.steps.actor;
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <div className="grid grid-cols-3 gap-3 sm:max-w-lg">
        {step.cards.map((role, i) => (
          <button
            key={i}
            type="button"
            onClick={() => act({ type: "choose", value: i })}
            className="card flex aspect-[3/4] items-center justify-center p-3 text-center font-semibold hover:border-fg/40"
          >
            <RoleName role={role} />
          </button>
        ))}
      </div>
      <Button type="button" variant="outline" className="h-12 w-full sm:w-auto sm:self-start" onClick={() => act({ type: "choose", value: null })}>
        {t.none}
      </Button>
    </>
  );
}

export const actorScreens: StepScreens<"actor"> = {
  actor: {
    describe: (_, step, action, dict) =>
      action.type !== "choose" || action.value === null ? dict.game.steps.actor.none : dict.roles[step.cards[action.value as number]].name,
    Screen: ActorStep,
  },
};
