"use client";

import { Check, Smartphone, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Avatar, useRoomContext } from "@/components/room-context";
import { tallyBallot } from "@/lib/ballot";
import type { Action, GameState, Step } from "@/lib/engine";
import { format } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

const NOT_VOTED = "";
const NO_ONE = "__nobody__";

/**
 * Phone voting, for when counting hands is too hard: the day's vote, or the
 * Mayor's election between the candidates the game master picked. Every vote
 * shows up here; the game master can change any of them (misclicks, players
 * without a phone) and validates the result, which becomes the usual action.
 */
export function BallotPanel({
  game,
  step,
  act,
}: {
  game: GameState;
  step: Extract<Step, { kind: "vote" | "mayor-election" }>;
  act: (action: Action) => void;
}) {
  const { dict } = useI18n();
  const t = dict.ballot;
  const { ballot, players, send } = useRoomContext();
  if (!send) return null;
  const nameOf = (id: string) => game.players.find((p) => p.id === id)?.name ?? "?";
  const vote = step.kind === "vote" ? step : null;
  const election = ballot?.kind === "mayor";

  // The election's ballot opens once the candidates are picked (see MayorStep).
  if (!ballot || (ballot.kind === "mayor") !== (step.kind === "mayor-election")) {
    if (!vote) return null;
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" className="h-11" onClick={() => send({ type: "open-ballot" })}>
          <Smartphone aria-hidden className="size-4" />
          {t.open}
        </Button>
        <p className="text-sm text-muted-foreground">{t.openHint}</p>
      </div>
    );
  }

  const tally = tallyBallot(ballot, { mayorId: vote?.mayorId ?? null, ravenTargetId: vote?.ravenTargetId ?? null });
  const ranked = Object.entries(tally.counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  const outcome = tally.outcome;

  function validate() {
    if (!vote) {
      if (outcome.kind === "eliminate") act({ type: "mayor", targetId: outcome.targetId });
      return;
    }
    if (outcome.kind === "eliminate") act({ type: "vote", targetId: outcome.targetId });
    else if (outcome.kind === "tie") act({ type: "vote", targetId: null, tie: true });
    else act({ type: "vote", targetId: null });
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-2/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Smartphone aria-hidden className="size-4" />
          {format(t.progress, { answered: tally.answered, voters: ballot.voterIds.length })}
        </h3>
        <Button type="button" variant="outline" className="h-9 px-3" onClick={() => send({ type: "close-ballot" })}>
          <X aria-hidden className="size-4" />
          {t.cancel}
        </Button>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {ballot.voterIds.map((voterId) => {
          const manual = players.find((p) => p.id === voterId)?.manual;
          const value = !(voterId in ballot.votes) ? NOT_VOTED : (ballot.votes[voterId] ?? NO_ONE);
          return (
            <li key={voterId} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
              <Avatar playerId={voterId} name={nameOf(voterId)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {nameOf(voterId)}
                  {voterId === vote?.mayorId && <span className="text-moon"> ×2</span>}
                </span>
                {manual && <span className="block text-xs text-muted-foreground">{dict.host.noPhone}</span>}
              </span>
              <NativeSelect
                aria-label={format(t.voteOf, { name: nameOf(voterId) })}
                className={`h-9 w-36 py-0 text-sm ${value === NOT_VOTED ? "text-muted-foreground" : ""}`}
                value={value}
                onChange={(e) => {
                  const choice = e.target.value;
                  if (choice === NOT_VOTED) send({ type: "set-vote", voterId, targetId: null, clear: true });
                  else send({ type: "set-vote", voterId, targetId: choice === NO_ONE ? null : choice });
                }}
              >
                <option value={NOT_VOTED}>{t.notVoted}</option>
                {!election && <option value={NO_ONE}>{t.noOne}</option>}
                {ballot.candidateIds.map((id) => (
                  <option key={id} value={id}>
                    {nameOf(id)}
                  </option>
                ))}
              </NativeSelect>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">{t.results}</h4>
        {ranked.length === 0 && tally.nobody === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noVotes}</p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {ranked.map(([id, count]) => (
              <li key={id} className="flex items-center gap-1.5 rounded-full bg-surface-2 py-1 pr-3 pl-1">
                <Avatar playerId={id} name={nameOf(id)} className="size-6" />
                {nameOf(id)} · <strong>{count}</strong>
                {id === vote?.ravenTargetId && <span className="text-muted-foreground">{t.ravenBonus}</span>}
              </li>
            ))}
            {tally.nobody > 0 && (
              <li className="rounded-full bg-surface-2 px-3 py-1">
                {t.noOne} · <strong>{tally.nobody}</strong>
              </li>
            )}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">{election ? t.mayorRule : t.rule}</p>
      </div>

      {!vote ? (
        outcome.kind === "tie" ? (
          // A tied election: the game master settles it (new vote, the table's call…).
          <div className="flex flex-col gap-2">
            <p className="font-medium">{format(t.mayorTie, { names: outcome.targetIds.map(nameOf).join(", ") })}</p>
            <div className="flex flex-wrap gap-2">
              {outcome.targetIds.map((id) => (
                <Button key={id} type="button" className="h-12" onClick={() => act({ type: "mayor", targetId: id })}>
                  <Check aria-hidden className="size-5" />
                  {format(t.validateMayor, { name: nameOf(id) })}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <Button type="button" className="h-12 text-base" disabled={outcome.kind !== "eliminate"} onClick={validate}>
            <Check aria-hidden className="size-5" />
            {outcome.kind === "eliminate" ? format(t.validateMayor, { name: nameOf(outcome.targetId) }) : t.noVotes}
          </Button>
        )
      ) : (
        <Button type="button" className="h-12 text-base" onClick={validate}>
          <Check aria-hidden className="size-5" />
          {outcome.kind === "eliminate"
            ? format(t.validateEliminate, { name: nameOf(outcome.targetId) })
            : outcome.kind === "tie"
              ? vote.scapegoatId
                ? t.validateTieScapegoat
                : format(t.validateTie, { names: outcome.targetIds.map(nameOf).join(", ") })
              : t.validateNobody}
        </Button>
      )}
    </section>
  );
}
