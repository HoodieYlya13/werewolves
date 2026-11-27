"use client";

import { useI18n } from "@/components/i18n-provider";
import { BallotPanel } from "@/components/host/ballot-panel";
import { TimerControls } from "@/components/vote-timer";
import { Button } from "@/components/ui/button";
import { format } from "@/lib/i18n/config";
import { Say, Do, NextButton, PickPlayers, living, nameOf, names, pickOf, type StepProps, type StepScreens } from "@/components/host/step-parts";

function VoteStep({ game, step, act }: StepProps<"vote">) {
  const { dict } = useI18n();
  const t = dict.game.steps.vote;
  // The Scapegoat let nobody vote today: the village talks, then night falls.
  if (living(game).every((p) => step.cannotVote.includes(p.id))) {
    return (
      <>
        <Say>{t.noVoters}</Say>
        <NextButton onClick={() => act({ type: "vote", targetId: null })} />
      </>
    );
  }
  return (
    <>
      {step.second && <p className="font-semibold text-moon">{t.second}</p>}
      {step.runoff && (
        <p className="font-semibold text-moon">{step.runoff.length ? format(t.runoff, { names: names(game, step.runoff) }) : t.runoffAll}</p>
      )}
      <Say>{t.say}</Say>
      <Do>
        {t.do}
        {step.mayorId && <> {format(t.mayor, { name: nameOf(game, step.mayorId) })}</>}
      </Do>
      {step.ravenTargetId && (
        <p className="rounded-xl bg-surface-2 px-4 py-2">{format(t.raven, { name: nameOf(game, step.ravenTargetId) })}</p>
      )}
      {step.cannotVote.length > 0 && (
        <p className="rounded-xl bg-surface-2 px-4 py-2">{format(t.cannotVote, { names: names(game, step.cannotVote) })}</p>
      )}
      <TimerControls />
      <BallotPanel game={game} step={step} act={act} />
      <PickPlayers
        game={game}
        count={1}
        players={step.runoff?.length ? living(game).filter((p) => step.runoff!.includes(p.id)) : undefined}
        onConfirm={([targetId]) => act({ type: "vote", targetId })}
        extra={
          <>
            {/* Tighter on phones, so Validate, Tie and No elimination share a line. */}
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-12 px-3 whitespace-normal sm:px-5"
              onClick={() => act({ type: "vote", targetId: null, tie: true })}
            >
              {step.scapegoatId ? t.tieScapegoat : step.mayorId ? t.tieMayor : step.runoff ? t.tie : t.tieRunoff}
            </Button>
            <Button type="button" variant="outline" className="h-12 px-3 sm:px-5" onClick={() => act({ type: "vote", targetId: null })}>
              {t.nobody}
            </Button>
          </>
        }
      />
    </>
  );
}

/** A tied vote with a Mayor: the Mayor names who goes, among the tied players when the phones counted. */
function TieBreakStep({ game, step, act }: StepProps<"tie-break">) {
  const { dict } = useI18n();
  const t = dict.game.steps["tie-break"];
  const tied = step.tiedIds.length ? living(game).filter((p) => step.tiedIds.includes(p.id)) : living(game);
  return (
    <>
      <Say>{format(t.say, { name: nameOf(game, step.playerId) })}</Say>
      {step.tiedIds.length > 0 && <Do>{format(t.tied, { names: names(game, step.tiedIds) })}</Do>}
      <Do>{t.do}</Do>
      <PickPlayers game={game} count={1} players={tied} onConfirm={(ids) => act(pickOf(ids))} skip={dict.game.steps.vote.nobody} />
    </>
  );
}

export const voteScreens: StepScreens<"vote" | "tie-break"> = {
  vote: { Screen: VoteStep },
  "tie-break": { Screen: TieBreakStep },
};
