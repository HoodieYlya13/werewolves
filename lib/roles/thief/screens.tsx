"use client";

import { useState } from "react";
import { Check, Smartphone } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Reveal } from "@/components/host/reveal";
import { RoleName } from "@/components/host/role-chip";
import { useRoomContext } from "@/components/room-context";
import { Button } from "@/components/ui/button";
import { format } from "@/lib/i18n/config";
import { Say, Do, nameOf, type StepProps, type StepScreens } from "@/components/host/step-parts";

function ThiefStep({ game, step, act }: StepProps<"thief">) {
  const { dict } = useI18n();
  const t = dict.game.steps.thief;
  const { phonePlays } = useRoomContext();
  // The Thief may have chosen on their phone: shown picked here, ready to validate.
  const phone = phonePlays?.actions[step.playerId];
  const fromPhone = phone?.type === "thief" ? phone.pick : undefined;
  const [mine, setMine] = useState<number | null | undefined>(undefined);
  const pick = mine !== undefined ? mine : fromPhone;
  const picked = "border-primary bg-primary/10 ring-2 ring-primary";
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      {/* The Thief may see these two cards, nothing else: the choice happens in the reveal. */}
      <Reveal to={nameOf(game, step.playerId)}>
        {fromPhone !== undefined && (
          <p className="flex items-center gap-2 text-sm font-semibold text-moon">
            <Smartphone aria-hidden className="size-4" />
            {dict.lead.fromPhones}
          </p>
        )}
        <div className="grid w-full grid-cols-2 gap-4">
          {step.cards.map((role, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={pick === i}
              onClick={() => setMine(i)}
              className={`card flex aspect-[3/4] flex-col items-center justify-center gap-2 p-4 text-center text-2xl font-semibold ${pick === i ? picked : "hover:border-fg/40"}`}
            >
              <RoleName role={role} />
            </button>
          ))}
        </div>
        {step.mustTakeWolf && <p className="text-primary">{t.mustTakeWolf}</p>}
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          {!step.mustTakeWolf && (
            <Button
              type="button"
              variant="outline"
              aria-pressed={pick === null}
              className={`h-12 px-6 ${pick === null ? picked : ""}`}
              onClick={() => setMine(null)}
            >
              {t.keep}
            </Button>
          )}
          <Button type="button" className="h-12 px-6" disabled={pick === undefined} onClick={() => act({ type: "thief", pick: pick ?? null })}>
            <Check aria-hidden className="size-5" />
            {dict.lead.validate}
          </Button>
        </div>
      </Reveal>
    </>
  );
}

export const thiefScreens: StepScreens<"thief"> = {
  thief: {
    describe: (_, step, action, dict) =>
      action.type !== "thief" || action.pick === null ? dict.game.steps.thief.keep : dict.roles[step.cards[action.pick]].name,
    Screen: ThiefStep,
  },
};
