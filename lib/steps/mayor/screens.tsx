"use client";

import { useState } from "react";
import { Smartphone } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { BallotPanel } from "@/components/host/ballot-panel";
import { PlayerGrid, toggle } from "@/components/host/player-grid";
import { useRoomContext } from "@/components/room-context";
import { Button } from "@/components/ui/button";
import { format } from "@/lib/i18n/config";
import { Say, Do, PickPlayers, living, nameOf, names, type StepProps, type StepScreens } from "@/components/host/step-parts";

function MayorStep({ game, step, act }: StepProps<"mayor-election" | "mayor-succession">) {
  const { dict } = useI18n();
  const t = dict.game.steps[step.kind];
  const name = step.kind === "mayor-succession" ? nameOf(game, step.playerId) : "";
  const { ballot, send, candidates: standing = [] } = useRoomContext();
  // The election's phone vote: the candidates being picked, before it opens.
  const [isPickingCandidates, setIsPickingCandidates] = useState(false);
  // Until the game master edits it, the list follows who stands, even after the picker opened.
  const [editedCandidates, setEditedCandidates] = useState<string[] | null>(null);
  const candidates = editedCandidates ?? standing.filter((id) => game.players.find((p) => p.id === id)?.alive);
  const election = step.kind === "mayor-election" ? step : null;
  const picking = !!election && !ballot && isPickingCandidates;
  const stopPicking = () => {
    setIsPickingCandidates(false);
    setEditedCandidates(null);
  };
  return (
    <>
      <Say>{format(t.say, { name })}</Say>
      {election && standing.length > 0 && <Do>{format(dict.auto.mayorCandidates, { names: names(game, standing) })}</Do>}
      {election && send && !ballot && !picking && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" className="h-11" onClick={() => setIsPickingCandidates(true)}>
            <Smartphone aria-hidden className="size-4" />
            {dict.ballot.open}
          </Button>
          <p className="text-sm text-muted-foreground">{dict.ballot.mayorOpenHint}</p>
        </div>
      )}
      {picking && send && (
        <>
          <Do>{dict.ballot.candidatesHint}</Do>
          <PlayerGrid
            game={game}
            players={living(game)}
            selected={candidates}
            onToggle={(id) => setEditedCandidates(toggle(candidates, id, Infinity))}
          />
          <div className="flex flex-wrap gap-2 [&>*]:grow sm:[&>*]:grow-0">
            <Button
              type="button"
              className="h-12 px-8 text-base"
              disabled={candidates.length < 2}
              onClick={() => send({ type: "open-ballot", candidateIds: candidates })}
            >
              {format(dict.ballot.startElection, { count: candidates.length })}
            </Button>
            <Button type="button" variant="outline" className="h-12" onClick={stopPicking}>
              {dict.ballot.back}
            </Button>
          </div>
        </>
      )}
      {election && <BallotPanel game={game} step={election} act={act} />}
      {!picking && (
        <>
          <Do>{t.do}</Do>
          <PickPlayers game={game} count={1} onConfirm={([targetId]) => act({ type: "mayor", targetId })} />
        </>
      )}
    </>
  );
}

export const mayorScreens: StepScreens<"mayor-election" | "mayor-succession"> = {
  "mayor-election": { Screen: (props) => <MayorStep {...props} /> },
  "mayor-succession": { Screen: (props) => <MayorStep {...props} /> },
};
