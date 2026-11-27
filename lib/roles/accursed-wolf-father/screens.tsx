"use client";

import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import { Say, Do, ContinueButton, ChoiceButtons, nameOf, names, type StepProps, type StepScreens } from "@/components/host/step-parts";

function InfectStep({ game, step, act }: StepProps<"infect">) {
  const { dict } = useI18n();
  const t = dict.game.steps.infect;
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <ChoiceButtons
        options={[
          { label: format(t.infect, { name: nameOf(game, step.victimId) }), onClick: () => act({ type: "choose", value: true }) },
          { label: t.no, onClick: () => act({ type: "choose", value: false }), ghost: true },
        ]}
      />
    </>
  );
}

function InfectedStep({ game, step, act }: StepProps<"infected">) {
  const { dict } = useI18n();
  const t = dict.game.steps.infected;
  return (
    <>
      <Say>{t.say}</Say>
      <Do>
        <span className="secret-role">{format(t.do, { names: names(game, step.playerIds) })}</span>
      </Do>
      <ContinueButton act={act} />
    </>
  );
}

export const accursedWolfFatherScreens: StepScreens<"infect" | "infected"> = {
  infect: { Screen: InfectStep },
  infected: { Screen: InfectedStep },
};
