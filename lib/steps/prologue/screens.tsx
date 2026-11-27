"use client";

import { useI18n } from "@/components/i18n-provider";
import { PhonelessIntro } from "@/components/host/phoneless-cards";
import { tableLines } from "@/lib/steps/prologue/steps";
import { Say, Do, StartPhaseButton, type StepProps, type StepScreens } from "@/components/host/step-parts";


function PrologueStep({ game, act }: StepProps<"prologue">) {
  const { dict } = useI18n();
  const t = dict.game.story.prologue;
  return (
    <>
      <PhonelessIntro game={game} />
      <Say>
        {[...t.say, ...tableLines(dict, game)].map((paragraph, i) => (
          <span key={i} className="block not-first:mt-3">
            {paragraph}
          </span>
        ))}
      </Say>
      <Do>{t.do}</Do>
      <StartPhaseButton act={act} next={game.phase} />
    </>
  );
}

export const prologueScreens: StepScreens<"prologue"> = {
  prologue: { Screen: PrologueStep },
};
