"use client";

import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";
import { Say, Do, ContinueButton, type StepProps, type StepScreens } from "@/components/host/step-parts";

/** A turn nobody can play: the narrator calls it anyway, word for word. */
function BluffStep({ game, step, act }: StepProps<"bluff">) {
  const { dict } = useI18n();
  const turns = dict.game.steps as Record<string, { say?: string }>;
  const siblings = dict.game.steps.siblings as Record<string, string>;
  const piper = game.setup.settings.piperCharms;
  // Turns named after their role, whose lines sit under their step's name.
  const turn = step.turn === "pied-piper" ? "piper" : step.turn === "accursed-wolf-father" ? "infect" : step.turn;
  const say = format(turns[turn]?.say ?? siblings[turn] ?? "", { count: piper === "choice" ? 2 : piper });
  return (
    <>
      <Say>{say}</Say>
      <Do>{step.turn === "infected" ? dict.game.steps.infected.nobody : dict.game.steps.bluff.do}</Do>
      <ContinueButton act={act} />
    </>
  );
}

export const bluffScreens: StepScreens<"bluff"> = {
  bluff: { Screen: BluffStep },
};
