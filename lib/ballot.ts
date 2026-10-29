/**
 * Votes cast on phones during the day. The game master opens a ballot, sees
 * every vote (and can change any of them), then validates the result as the
 * usual vote action. The ballot itself never touches the game engine.
 */
export type Ballot = {
  /** Players allowed to vote (alive, and not barred by the Idiot or the Scapegoat). */
  voterIds: string[];
  /** Players who can be voted against. */
  candidateIds: string[];
  /** voterId → the player they vote against, or null for "no one". Missing = hasn't voted yet. */
  votes: Record<string, string | null>;
};

/** A countdown shared by the master screen and the phones. */
export type Timer = {
  /** Server time when it reaches zero, while it runs. */
  endsAt: number | null;
  /** Time left while it's paused. */
  remainingMs: number;
  durationMs: number;
};

export type BallotOutcome =
  | { kind: "eliminate"; targetId: string }
  | { kind: "tie"; targetIds: string[] }
  | { kind: "nobody" };

export type BallotTally = {
  /** Votes against each candidate, Mayor and Raven included. */
  counts: Record<string, number>;
  /** Votes for "no one". */
  nobody: number;
  /** How many voters have answered. */
  answered: number;
  outcome: BallotOutcome;
};

/**
 * Counts a ballot with the game's rules: the Mayor's vote counts double and
 * the Raven's mark adds 2 votes. "No one" is a choice like any other: when it
 * gets at least as many votes as the leading player, nobody is eliminated.
 * Otherwise the player with the most votes goes, and a tie between players is
 * a tie (which kills the Scapegoat when there is one).
 */
export function tallyBallot(
  ballot: Ballot,
  { mayorId, ravenTargetId }: { mayorId: string | null; ravenTargetId: string | null },
): BallotTally {
  const counts: Record<string, number> = Object.fromEntries(ballot.candidateIds.map((id) => [id, 0]));
  let nobody = 0;
  let answered = 0;

  for (const voterId of ballot.voterIds) {
    if (!(voterId in ballot.votes)) continue;
    answered += 1;
    const weight = voterId === mayorId ? 2 : 1;
    const targetId = ballot.votes[voterId];
    if (targetId === null) nobody += weight;
    else if (targetId in counts) counts[targetId] += weight;
  }
  if (ravenTargetId && ravenTargetId in counts) counts[ravenTargetId] += 2;

  const max = Math.max(0, ...Object.values(counts));
  const leaders = Object.keys(counts).filter((id) => counts[id] === max);
  const outcome: BallotOutcome =
    max === 0 || nobody >= max
      ? { kind: "nobody" }
      : leaders.length > 1
        ? { kind: "tie", targetIds: leaders }
        : { kind: "eliminate", targetId: leaders[0] };

  return { counts, nobody, answered, outcome };
}

/** Milliseconds left on a timer, given the server clock. */
export function timerRemaining(timer: Timer, serverNow: number) {
  return timer.endsAt === null ? timer.remainingMs : Math.max(0, timer.endsAt - serverNow);
}
