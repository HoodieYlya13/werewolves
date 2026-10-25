import { describe, expect, it } from "vitest";
import { tallyBallot, timerRemaining, type Ballot } from "./ballot";

const ballot = (votes: Ballot["votes"], voterIds = ["a", "b", "c", "d", "e"]): Ballot => ({
  voterIds,
  candidateIds: ["a", "b", "c", "d", "e"],
  votes,
});
const none = { sheriffId: null, ravenTargetId: null };

describe("tallyBallot", () => {
  it("eliminates the player with the most votes", () => {
    const tally = tallyBallot(ballot({ a: "c", b: "c", c: "a", d: null }), none);
    expect(tally.outcome).toEqual({ kind: "eliminate", targetId: "c" });
    expect(tally.answered).toBe(4);
    expect(tally.nobody).toBe(1);
  });

  it("treats a tie between players as a tie", () => {
    const tally = tallyBallot(ballot({ a: "c", b: "d" }), none);
    expect(tally.outcome).toEqual({ kind: "tie", targetIds: ["c", "d"] });
  });

  it("eliminates nobody when 'no one' wins or ties with the leader", () => {
    expect(tallyBallot(ballot({ a: "c", b: null, c: null, d: null }), none).outcome).toEqual({ kind: "nobody" });
    expect(tallyBallot(ballot({ a: "c", b: null }), none).outcome).toEqual({ kind: "nobody" });
    expect(tallyBallot(ballot({}), none).outcome).toEqual({ kind: "nobody" });
  });

  it("counts the Sheriff twice and adds the Raven's two votes", () => {
    expect(tallyBallot(ballot({ a: "c", b: "d", c: "d" }), { sheriffId: "a", ravenTargetId: null }).outcome).toEqual({
      kind: "tie",
      targetIds: ["c", "d"],
    });
    const raven = tallyBallot(ballot({ a: "c" }), { sheriffId: null, ravenTargetId: "e" });
    expect(raven.counts.e).toBe(2);
    expect(raven.outcome).toEqual({ kind: "eliminate", targetId: "e" });
  });

  it("ignores votes from players who may not vote", () => {
    const tally = tallyBallot(ballot({ a: "c", b: "d", e: "d" }, ["a", "b"]), none);
    expect(tally.outcome).toEqual({ kind: "tie", targetIds: ["c", "d"] });
  });
});

describe("timerRemaining", () => {
  it("counts down while running and holds while paused", () => {
    expect(timerRemaining({ endsAt: 10_000, remainingMs: 0, durationMs: 60_000 }, 4_000)).toBe(6_000);
    expect(timerRemaining({ endsAt: 10_000, remainingMs: 0, durationMs: 60_000 }, 12_000)).toBe(0);
    expect(timerRemaining({ endsAt: null, remainingMs: 30_000, durationMs: 60_000 }, 99_000)).toBe(30_000);
  });
});
