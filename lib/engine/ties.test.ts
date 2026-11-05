import { describe, expect, it } from "vitest";
import { assignRoles, defaultSettings, elderCostsPowers, playerInfo, upgradeLog, type GameState, type RoleId, type Settings, type StepKind } from ".";
import { applyAction, createGame } from "./testing";

const setup = (roleList: RoleId[], settings: Partial<Settings> = {}) => {
  const players = roleList.map((_, i) => ({ id: `p${i}`, name: `P${i}`, seat: i }));
  const roles = Object.fromEntries(players.map((p, i) => [p.id, roleList[i]]));
  return assignRoles(players, roles, [], { ...defaultSettings, mayor: true, ...settings });
};

/** Reads on through the steps that only need a Continue, up to `kind`. */
function until(state: GameState, kind: StepKind) {
  while (state.step.kind !== kind) {
    if (!["deaths", "bluff", "lovers", "charmed", "siblings", "seer-result", "bear", "idiot"].includes(state.step.kind)) {
      throw new Error(`Stuck on ${state.step.kind} before ${kind}`);
    }
    state = applyAction(state, { type: "continue" });
  }
  return state;
}

/** Night 1 with no victim, then p1 elected Mayor: the day's vote is on. */
function toVote(roles: RoleId[]) {
  let s = createGame(setup(roles));
  s = applyAction(until(s, "wolves"), { type: "wolves", targetId: null });
  s = applyAction(until(s, "mayor-election"), { type: "mayor", targetId: "p1" });
  return until(s, "vote");
}

describe("ties", () => {
  it("lets the Mayor break a tie, among the tied players", () => {
    let s = toVote(["werewolf", "villager", "villager", "villager", "villager"]);
    s = applyAction(s, { type: "vote", targetId: null, tie: true, tiedIds: ["p2", "p3"] });
    expect(s.step).toEqual({ kind: "tie-break", playerId: "p1", tiedIds: ["p2", "p3"] });
    expect(() => applyAction(s, { type: "pick", targetIds: ["p4"] })).toThrow();
    s = applyAction(s, { type: "pick", targetIds: ["p3"] });
    expect(s.players.find((p) => p.id === "p3")!.alive).toBe(false);
  });

  it("eliminates nobody when the Mayor doesn't choose", () => {
    let s = toVote(["werewolf", "villager", "villager", "villager", "villager"]);
    s = applyAction(applyAction(s, { type: "vote", targetId: null, tie: true }), { type: "pick", targetIds: [] });
    expect(s.players.every((p) => p.alive)).toBe(true);
  });

  it("kills only the Scapegoat on a tie, Mayor or not", () => {
    let s = toVote(["werewolf", "villager", "scapegoat", "villager", "villager"]);
    s = applyAction(s, { type: "vote", targetId: null, tie: true, tiedIds: ["p3", "p4"] });
    expect(s.step.kind).toBe("deaths");
    expect(s.players.filter((p) => !p.alive).map((p) => p.id)).toEqual(["p2"]);
  });

  it("without a Mayor or Scapegoat, votes again between the tied players only", () => {
    let s = createGame(setup(["werewolf", "villager", "villager", "villager", "villager"], { mayor: false }));
    s = applyAction(until(s, "wolves"), { type: "wolves", targetId: null });
    s = until(s, "vote");
    s = applyAction(s, { type: "vote", targetId: null, tie: true, tiedIds: ["p2", "p3"] });
    expect(s.step).toMatchObject({ kind: "vote", runoff: ["p2", "p3"] });
    expect(() => applyAction(s, { type: "vote", targetId: "p4" })).toThrow();
    const out = applyAction(s, { type: "vote", targetId: "p3" });
    expect(out.players.find((p) => p.id === "p3")!.alive).toBe(false);
    // Another tie: nobody is eliminated.
    s = applyAction(s, { type: "vote", targetId: null, tie: true });
    expect(s.step.kind).not.toBe("vote");
    expect(s.players.every((p) => p.alive)).toBe(true);
  });

  it("replays an older log, where a tie without a Mayor eliminated nobody", () => {
    const game = setup(["werewolf", "villager", "villager", "villager", "villager"], { mayor: false });
    const log = upgradeLog(game, [{ type: "wolves", targetId: null }, { type: "continue" }, { type: "vote", targetId: null, tie: true }, { type: "wolves", targetId: null }]);
    expect(log?.filter((a) => a.type === "vote")).toHaveLength(2);
    expect(log?.at(-1)).toEqual({ type: "wolves", targetId: null });
  });

  it("replays an older log, where a tie with a Mayor eliminated nobody", () => {
    const game = setup(["werewolf", "villager", "villager", "villager", "villager"]);
    const log = upgradeLog(game, [{ type: "wolves", targetId: null }, { type: "continue" }, { type: "mayor", targetId: "p1" }, { type: "vote", targetId: null, tie: true }, { type: "wolves", targetId: null }]);
    expect(log?.slice(-3)).toEqual([{ type: "pick", targetIds: [] }, { type: "continue" }, { type: "wolves", targetId: null }]);
  });
});

describe("skipped night turns", () => {
  it("lets Cupid and the Wild Child choose nobody", () => {
    let s = createGame(setup(["werewolf", "cupid", "wild-child", "villager", "villager"]));
    s = applyAction(until(s, "cupid"), { type: "cupid", lovers: null });
    expect(s.lovers).toBeNull();
    s = applyAction(until(s, "wild-child"), { type: "pick", targetIds: [] });
    expect(s.players.find((p) => p.id === "p2")!.memo.model).toBeUndefined();
  });

  it("puts a Seer who skipped back to sleep", () => {
    let s = createGame(setup(["werewolf", "seer", "villager", "villager"]));
    s = applyAction(until(s, "seer"), { type: "seer", targetId: null });
    expect(s.backToSleep).toBe("seer");
    s = createGame(setup(["werewolf", "seer", "villager", "villager"]));
    s = applyAction(until(s, "seer"), { type: "seer", targetId: "p0" });
    expect(s.backToSleep).toBeNull();
  });
});

describe("phones in step with the narrator", () => {
  it("tells the charmed only once their turn is over", () => {
    let s = createGame(setup(["werewolf", "pied-piper", "villager", "villager", "villager"], { piperCharms: 2 }));
    s = applyAction(until(s, "wolves"), { type: "wolves", targetId: null });
    s = applyAction(until(s, "piper"), { type: "pick", targetIds: ["p2", "p3"] });
    expect(s.step.kind).toBe("charmed");
    expect(playerInfo(s, "p2")!.charmed).toBe(false);
    s = applyAction(s, { type: "continue" });
    expect(playerInfo(s, "p2")!.charmed).toBe(true);
  });

  it("tells the lovers only once their turn is over", () => {
    let s = createGame(setup(["werewolf", "cupid", "villager", "villager"]));
    s = applyAction(until(s, "cupid"), { type: "cupid", lovers: ["p2", "p3"] });
    expect(s.step.kind).toBe("lovers");
    expect(playerInfo(s, "p2")!.loverId).toBeNull();
    s = applyAction(s, { type: "continue" });
    expect(playerInfo(s, "p2")!.loverId).toBe("p3");
  });
});

describe("the Elder", () => {
  it("announces the lost powers when the village votes the Elder out", () => {
    let s = toVote(["werewolf", "villager", "elder", "villager", "villager"]);
    s = applyAction(s, { type: "vote", targetId: "p2" });
    expect(s.step.kind).toBe("deaths");
    expect(s.villagePowersLost).toBe(true);
    expect(s.step.kind === "deaths" && elderCostsPowers(s, s.step.deaths)).toBe(true);
  });
});
