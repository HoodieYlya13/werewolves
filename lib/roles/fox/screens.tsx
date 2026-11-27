"use client";

import { useContext, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Reveal } from "@/components/host/reveal";
import { format } from "@/lib/i18n/config";
import { Say, Do, ContinueButton, PickPlayers, nameOf, pickOf, Restarted, type StepProps, type StepScreens } from "@/components/host/step-parts";

function FoxStep({ game, step, act }: StepProps<"fox">) {
  const { dict } = useI18n();
  const t = dict.game.steps.fox;
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <PickPlayers game={game} count={1} onConfirm={(ids) => act(pickOf(ids))} skip={dict.game.skipTurn} />
    </>
  );
}

/** Like the Seer's: opens on the answer straight away; Continue closes it, then the Fox goes back to sleep. */
function FoxResultStep({ game, step, act }: StepProps<"fox-result">) {
  const { dict } = useI18n();
  const t = dict.game.steps["fox-result"];
  const fox = game.players.find((p) => p.id === step.playerId);
  const restarted = useContext(Restarted);
  const [seen, setSeen] = useState(restarted);
  const reveal = (
    <Reveal to={nameOf(game, step.playerId)} defaultOpen={!restarted} closeLabel={dict.game.continue} onClose={() => setSeen(true)}>
      <p className="text-2xl">{step.hasWolf ? t.yes : t.no}</p>
      <ul className={`flex flex-col gap-2 font-display text-4xl font-bold wrap-anywhere sm:text-6xl ${step.hasWolf ? "text-primary" : "text-ok"}`}>
        {step.playerIds.map((id) => (
          <li key={id}>{nameOf(game, id)}</li>
        ))}
      </ul>
    </Reveal>
  );
  if (!seen) return reveal;
  return (
    <>
      {restarted && reveal}
      {!step.hasWolf && fox?.role === "fox" && <Do>{t.lost}</Do>}
      <Say>{t.say}</Say>
      <ContinueButton act={act} />
    </>
  );
}

export const foxScreens: StepScreens<"fox" | "fox-result"> = {
  fox: { Screen: FoxStep },
  "fox-result": { Screen: FoxResultStep },
};
