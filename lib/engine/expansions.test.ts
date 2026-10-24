import { describe, expect, it } from "vitest";
import {
  applyAction,
  assignRoles,
  createGame,
  deckProblems,
  defaultSettings,
  EngineError,
  replay,
  type Action,
  type GameSetup,
  type RoleId,
  type SetupOptions,
  type Settings,
} from ".";

/** Players p0, p1… get the roles in order and sit in that order, clockwise. */
function setup(
  roleList: RoleId[],
  opts: { extra?: RoleId[]; settings?: Partial<Settings> } & SetupOptions = {},
): GameSetup {
  const players = roleList.map((_, i) => ({ id: `p${i}`, name: `P${i}`, seat: i }));
  return assignRoles(
    players,
    Object.fromEntries(players.map((p, i) => [p.id, roleList[i]])),
    opts.extra ?? [],
    { ...defaultSettings, sheriff: false, ...opts.settings },
    { actorCards: opts.actorCards, groups: opts.groups },
  );
}

const go: Action = { type: "continue" };
const pick = (...targetIds: string[]): Action => ({ type: "pick", targetIds });
const choose = (value: number | string | boolean | null): Action => ({ type: "choose", value });
const wolves = (targetId: string): Action => ({ type: "wolves", targetId });
const vote = (targetId: string | null): Action => ({ type: "vote", targetId });
const play = (s: GameSetup, actions: Action[]) => replay(s, actions);

function expectError(fn: () => unknown, code: EngineError["code"]) {
  expect(fn).toThrowError(EngineError);
  try {
    fn();
  } catch (e) {
    expect((e as EngineError).code).toBe(code);
  }
}

describe("Nouvelle Lune", () => {
  it("Elder survives the first wolf attack, not the second", () => {
    const s = setup(["werewolf", "elder", "villager", "villager"]);
    const first = play(s, [wolves("p1")]);
    expect(first.step).toEqual({ kind: "deaths", context: "dawn", deaths: [] });
    const second = play(s, [wolves("p1"), go, vote(null), wolves("p1")]);
    expect(second.step).toMatchObject({ deaths: [{ playerId: "p1", cause: "wolves" }] });
  });

  it("killing the Elder by vote strips villagers of their powers", () => {
    const s = setup(["werewolf", "elder", "seer", "hunter", "villager"]);
    const state = play(s, [{ type: "seer", targetId: "p0" }, go, wolves("p4"), go, vote("p1"), go]);
    expect(state.villagePowersLost).toBe(true);
    // No Seer tonight, and the Hunter won't shoot.
    expect(state.step.kind).toBe("wolves");
    const after = play(s, [{ type: "seer", targetId: "p0" }, go, wolves("p4"), go, vote("p1"), go, wolves("p3"), go]);
    expect(after.step.kind).toBe("vote");
  });

  it("Village Idiot survives his first vote but loses his own", () => {
    const s = setup(["werewolf", "village-idiot", "villager", "villager"]);
    const revealed = play(s, [wolves("p2"), go, vote("p1")]);
    expect(revealed.step).toEqual({ kind: "idiot", playerId: "p1" });
    expect(revealed.players[1].alive).toBe(true);

    const nextVote = play(s, [wolves("p2"), go, vote("p1"), go, wolves("p3"), go]);
    expect(nextVote.step).toMatchObject({ kind: "vote", cannotVote: ["p1"] });
    expect(applyAction(applyAction(nextVote, vote("p1")), go).winner?.team).toBe("wolves");
  });

  it("Scapegoat dies on a tie and picks tomorrow's voters", () => {
    const s = setup(["werewolf", "scapegoat", "villager", "villager", "villager"]);
    let state = play(s, [wolves("p2"), go]);
    expect(state.step).toMatchObject({ kind: "vote", scapegoatId: "p1" });
    state = applyAction(state, { type: "vote", targetId: null, tie: true });
    expect(state.step).toMatchObject({ deaths: [{ playerId: "p1", cause: "scapegoat" }] });
    state = applyAction(state, go);
    expect(state.step).toEqual({ kind: "scapegoat", playerId: "p1" });
    state = play(s, [wolves("p2"), go, { type: "vote", targetId: null, tie: true }, go, pick("p3"), wolves("p4"), go]);
    expect(state.step).toMatchObject({ kind: "vote", cannotVote: ["p0"] });
  });

  it("a tie without a Scapegoat eliminates nobody", () => {
    const state = play(setup(["werewolf", "villager", "villager", "villager"]), [
      wolves("p1"),
      go,
      { type: "vote", targetId: null, tie: true },
    ]);
    expect(state.phase).toEqual({ kind: "night", number: 2 });
  });

  it("Pied Piper charms players and wins once everyone else is charmed", () => {
    const s = setup(["pied-piper", "werewolf", "villager", "villager"]);
    let state = play(s, [wolves("p2")]);
    expect(state.step).toEqual({ kind: "piper", playerId: "p0", count: 2 });
    expectError(() => applyAction(state, pick("p1")), "invalid-action");
    state = applyAction(state, pick("p1", "p3"));
    expect(state.step).toEqual({ kind: "charmed", playerIds: ["p1", "p3"], newIds: ["p1", "p3"] });
    state = applyAction(applyAction(state, go), go);
    expect(state.winner).toEqual({ team: "piper", playerIds: ["p0"] });
  });

  it("Piper charms only one player a night when set to 1", () => {
    const state = play(setup(["pied-piper", "werewolf", "villager", "villager"], { settings: { piperCharms: 1 } }), [
      wolves("p2"),
    ]);
    expect(state.step).toMatchObject({ kind: "piper", count: 1 });
  });

  it("Defender protects from the wolves, never the same player twice in a row", () => {
    const s = setup(["defender", "werewolf", "villager", "villager"]);
    const saved = play(s, [pick("p2"), wolves("p2")]);
    expect(saved.step).toEqual({ kind: "deaths", context: "dawn", deaths: [] });
    const night2 = play(s, [pick("p2"), wolves("p2"), go, vote(null)]);
    expect(night2.step).toEqual({ kind: "defender", playerId: "p0", lastProtectedId: "p2" });
    expectError(() => applyAction(night2, pick("p2")), "invalid-target");
  });
});

describe("Personnages", () => {
  it("Angel opens the game with a vote and wins if voted out then", () => {
    const s = setup(["angel", "werewolf", "villager", "villager"]);
    const start = createGame(s);
    expect(start.phase).toEqual({ kind: "day", number: 0 });
    expect(start.step.kind).toBe("vote");
    expect(play(s, [vote("p0"), go]).winner).toEqual({ team: "angel", playerIds: ["p0"] });
    // Survives the first vote: he's a plain villager from then on.
    const survived = play(s, [vote("p2"), go]);
    expect(survived.phase).toEqual({ kind: "night", number: 1 });
    expect(survived.step.kind).toBe("wolves");
  });

  it("Knight eaten by the wolves: the first wolf to his left dies of rust next dawn", () => {
    const s = setup(["knight", "villager", "werewolf", "villager", "werewolf"]);
    const state = play(s, [wolves("p0"), go, vote(null), wolves("p1")]);
    expect(state.step).toMatchObject({
      deaths: [
        { playerId: "p1", cause: "wolves" },
        { playerId: "p2", cause: "rust" },
      ],
    });
  });

  it("Wolf-Hound who picks the wolves wakes with them", () => {
    const state = play(setup(["wolf-hound", "werewolf", "villager", "villager"]), [choose("wolves")]);
    expect(state.step).toMatchObject({ kind: "wolves", playerIds: ["p0", "p1"] });
  });

  it("Actor borrows a power for one night, and the card is used up", () => {
    const s = setup(["actor", "werewolf", "villager", "villager"], { actorCards: ["seer", "defender", "fox"] });
    let state = createGame(s);
    expect(state.step).toEqual({ kind: "actor", playerId: "p0", cards: ["seer", "defender", "fox"] });
    state = applyAction(state, choose(0));
    expect(state.step).toEqual({ kind: "seer", playerId: "p0" });
    expect(state.actorCards).toEqual(["defender", "fox"]);
  });

  it("Two Sisters wake together on night 1", () => {
    const state = createGame(setup(["two-sisters", "two-sisters", "werewolf", "villager"]));
    expect(state.step).toEqual({ kind: "siblings", role: "two-sisters", playerIds: ["p0", "p1"] });
  });

  it("Wild Child turns into a wolf when the model dies", () => {
    const s = setup(["wild-child", "werewolf", "villager", "villager", "villager"]);
    const state = play(s, [pick("p2"), wolves("p2"), go, vote(null)]);
    expect(state.players[0].flags["turned-wolf"]).toBe(true);
    expect(state.step).toMatchObject({ kind: "wolves", playerIds: ["p0", "p1"] });
  });

  it("Big Bad Wolf kills a second victim until a wolf dies", () => {
    const s = setup(["big-bad-wolf", "werewolf", "villager", "villager", "villager", "villager"]);
    const night1 = play(s, [wolves("p2"), pick("p3")]);
    expect(night1.step).toMatchObject({
      deaths: [
        { playerId: "p2", cause: "wolves" },
        { playerId: "p3", cause: "wolves" },
      ],
    });
    const night2 = play(s, [wolves("p2"), pick("p3"), go, vote("p1"), go, wolves("p4")]);
    expect(night2.step).toMatchObject({ kind: "deaths", deaths: [{ playerId: "p4" }] });
  });

  it("Accursed Wolf-Father infects instead of killing; the Witch sees no victim", () => {
    const s = setup(["accursed-wolf-father", "witch", "villager", "villager", "villager"]);
    let state = play(s, [wolves("p2")]);
    expect(state.step).toEqual({ kind: "infect", playerId: "p0", victimId: "p2" });
    state = applyAction(state, choose(true));
    expect(state.step).toMatchObject({ kind: "witch", victimId: null, canHeal: false });
    state = play(s, [wolves("p2"), choose(true), { type: "witch", heal: false, poisonId: null }]);
    expect(state.step).toEqual({ kind: "deaths", context: "dawn", deaths: [] });
    state = play(s, [wolves("p2"), choose(true), { type: "witch", heal: false, poisonId: null }, go, vote(null)]);
    expect(state.step).toMatchObject({ kind: "wolves", playerIds: ["p0", "p2"] });
  });

  it("Stuttering Judge calls one second vote per game", () => {
    const s = setup(["stuttering-judge", "werewolf", "villager", "villager", "villager", "villager"]);
    let state = play(s, [wolves("p2"), go, vote("p3"), go]);
    expect(state.step).toEqual({ kind: "judge", playerId: "p0" });
    state = applyAction(state, choose(true));
    expect(state.step).toMatchObject({ kind: "vote", second: true });
    state = play(s, [wolves("p2"), go, vote("p3"), go, choose(true), vote(null), wolves("p4"), go, vote(null)]);
    // No judge on day 2: his power is used.
    expect(state.phase).toEqual({ kind: "night", number: 3 });
  });

  it("White Werewolf kills a wolf every other night and wins alone", () => {
    const s = setup(["white-werewolf", "werewolf", "villager", "villager", "villager", "villager"]);
    let state = play(s, [wolves("p2"), go, vote(null), wolves("p3")]);
    expect(state.step).toEqual({ kind: "white-werewolf", playerId: "p0" });
    state = applyAction(state, pick("p1"));
    expect(state.step).toMatchObject({
      deaths: [
        { playerId: "p3", cause: "wolves" },
        { playerId: "p1", cause: "white-werewolf" },
      ],
    });
    state = play(s, [wolves("p2"), go, vote(null), wolves("p3"), pick("p1"), go, vote("p4"), go, wolves("p5"), go]);
    expect(state.winner).toEqual({ team: "white-werewolf", playerIds: ["p0"] });
  });

  it("Bear Tamer's bear growls next to a wolf, skipping dead neighbours", () => {
    const next = play(setup(["villager", "bear-tamer", "werewolf", "villager", "villager"]), [wolves("p4"), go]);
    expect(next.step).toEqual({ kind: "bear", playerId: "p1", growls: true });

    const s = setup(["werewolf", "villager", "bear-tamer", "villager", "villager"]);
    expect(play(s, [wolves("p4"), go]).step).toMatchObject({ kind: "bear", growls: false });
    // Once p1 dies, the wolf p0 becomes the tamer's neighbour.
    expect(play(s, [wolves("p1"), go]).step).toMatchObject({ kind: "bear", growls: true });
  });

  it("Fox sniffs three neighbours and loses his power on a miss", () => {
    const s = setup(["fox", "villager", "villager", "werewolf", "villager", "villager"]);
    expect(play(s, [pick("p4")]).step).toEqual({
      kind: "fox-result",
      playerId: "p0",
      playerIds: ["p3", "p4", "p5"],
      hasWolf: true,
    });
    const miss = play(s, [pick("p1")]);
    expect(miss.step).toMatchObject({ kind: "fox-result", playerIds: ["p0", "p1", "p2"], hasWolf: false });
    expect(play(s, [pick("p1"), go, wolves("p4"), go, vote(null)]).step.kind).toBe("wolves");
  });

  it("Devoted Servant can take the voted-out player's card, and its death power", () => {
    const s = setup(["devoted-servant", "hunter", "werewolf", "villager", "villager"]);
    const offer = play(s, [wolves("p3"), go, vote("p1"), go]);
    expect(offer.step).toMatchObject({ kind: "servant", playerId: "p0", victimId: "p1" });

    const taken = applyAction(offer, choose(true));
    expect(taken.players[0].role).toBe("hunter");
    expect(taken.step.kind).toBe("wolves");

    const declined = applyAction(offer, choose(false));
    expect(declined.step).toEqual({ kind: "hunter", playerId: "p1" });
  });

  it("Abominable Sectarian wins once the other group is dead", () => {
    const s = setup(["abominable-sectarian", "villager", "werewolf", "villager"], {
      groups: { p0: "a", p1: "a", p2: "b", p3: "b" },
    });
    const state = play(s, [wolves("p3"), go, vote("p2"), go]);
    expect(state.winner).toEqual({ team: "sectarian", playerIds: ["p0"] });
  });
});

describe("Le Village", () => {
  it("Raven's mark shows on the next vote", () => {
    const state = play(setup(["raven", "werewolf", "villager", "villager"]), [wolves("p2"), pick("p1"), go]);
    expect(state.step).toMatchObject({ kind: "vote", ravenTargetId: "p1" });
  });
});

describe("expansion setup", () => {
  it("requires complete sets of sisters and brothers", () => {
    expect(deckProblems(4, ["two-sisters", "werewolf", "villager", "villager"])).toContain("incomplete-set");
    expect(deckProblems(4, ["two-sisters", "two-sisters", "werewolf", "villager"])).toEqual([]);
  });

  it("requires the Actor's cards and the Sectarian's groups", () => {
    expectError(() => setup(["actor", "werewolf", "villager"]), "invalid-setup");
    expectError(() => setup(["actor", "werewolf", "villager"], { actorCards: ["seer", "hunter", "fox"] }), "invalid-setup");
    expectError(() => setup(["abominable-sectarian", "werewolf", "villager"]), "invalid-setup");
  });
});
