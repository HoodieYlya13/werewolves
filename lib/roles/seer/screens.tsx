"use client";

import { useContext, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Reveal } from "@/components/host/reveal";
import { RoleName } from "@/components/game/role-chip";
import { format } from "@/lib/i18n/config";
import type { GameState } from "@/lib/engine";
import { Say, Do, ContinueButton, PickPlayers, nameOf, Restarted, type StepProps, type StepScreens } from "@/components/host/step-parts";

/**
 * The Seer's last pick each night, so an undo back to the Seer's turn comes
 * back with it selected. Keyed by the deal and the night: never another game's.
 */
const seerPicks = new Map<string, string>();

const seerKey = (game: GameState, seerId: string) => `${JSON.stringify(game.setup.roles)}:${game.phase.number}:${seerId}`;

function SeerStep({ game, step, act }: StepProps<"seer">) {
  const { dict } = useI18n();
  const t = dict.game.steps.seer;
  const key = seerKey(game, step.playerId);
  const last = seerPicks.get(key);
  return (
    <>
      <Say>{t.say}</Say>
      <Do>{format(t.do, { name: nameOf(game, step.playerId) })}</Do>
      <PickPlayers
        game={game}
        count={1}
        initial={last && game.players.some((p) => p.id === last && p.alive) ? [last] : []}
        isDisabled={(p) => p.id === step.playerId}
        onConfirm={([targetId]) => {
          if (targetId) seerPicks.set(key, targetId);
          act({ type: "seer", targetId: targetId ?? null });
        }}
        skip={dict.game.skipTurn}
      />
    </>
  );
}

/** Opens on the card straight away; Continue closes it, then the Seer goes back to sleep. */
function SeerResultStep({ game, step, act }: StepProps<"seer-result">) {
  const { dict } = useI18n();
  const t = dict.game.steps["seer-result"];
  // Started over by Undo, the card was already seen: shown again only on a tap.
  const restarted = useContext(Restarted);
  const [seen, setSeen] = useState(restarted);
  const reveal = (
    <Reveal to={nameOf(game, step.playerId)} defaultOpen={!restarted} closeLabel={dict.game.continue} onClose={() => setSeen(true)}>
      <p className="text-2xl">{format(t.reveal, { target: nameOf(game, step.targetId) })}</p>
      <RoleName role={step.role} className="font-display text-5xl font-bold sm:text-7xl" />
    </Reveal>
  );
  if (seen) {
    return (
      <>
        {restarted && reveal}
        <Say>{t.say}</Say>
        <ContinueButton act={act} />
      </>
    );
  }
  return reveal;
}

export const seerScreens: StepScreens<"seer" | "seer-result"> = {
  seer: { Screen: SeerStep },
  "seer-result": { Screen: SeerResultStep },
};
