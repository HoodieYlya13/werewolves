import { describe, expect, it } from "vitest";
import {
  assignRoles,
  dealRoles,
  deckProblems,
  defaultSettings,
  EngineError,
  remainingTeams,
  playerInfo,
  publicGame,
  suggestedDeck,
  type Action,
  type GameSetup,
  type RoleId,
  type Settings,
} from ".";
import * as engine from ".";
import { applyAction, createGame, replay } from "./testing";

/** Players p0, p1… get the roles in order. Mayor off unless asked, to keep flows short. */
function setup(roleList: RoleId[], opts: { extra?: RoleId[]; settings?: Partial<Settings> } = {}): GameSetup {
  const players = roleList.map((_, i) => ({ id: `p${i}`, name: `P${i}`, seat: i }));
  return assignRoles(
    players,
    Object.fromEntries(players.map((p, i) => [p.id, roleList[i]])),
    opts.extra ?? [],
    { ...defaultSettings, mayor: false, ...opts.settings },
  );
}

const go: Action = { type: "continue" };
const play = (s: GameSetup, actions: Action[]) => replay(s, actions);

function expectError(fn: () => unknown, code: EngineError["code"]) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(EngineError);
    expect((e as EngineError).code).toBe(code);
    return;
  }
  throw new Error(`Expected EngineError "${code}"`);
}

describe("night order", () => {
  it("wakes base roles in the official order, then resolves dawn", () => {
    const s = setup(["thief", "cupid", "seer", "werewolf", "witch", "villager", "hunter"], {
      extra: ["villager", "little-girl"],
    });
    const kinds: string[] = [];
    let state = createGame(s);
    const actions: Action[] = [
      { type: "thief", pick: null },
      { type: "cupid", lovers: ["p5", "p6"] },
      go, // lovers see each other
      { type: "seer", targetId: "p3" },
      go, // seer result
      { type: "wolves", targetId: "p5" },
      { type: "witch", heal: false, poisonId: null },
    ];
    for (const a of actions) {
      kinds.push(state.step.kind);
      state = applyAction(state, a);
    }
    expect(kinds).toEqual(["thief", "cupid", "lovers", "seer", "seer-result", "wolves", "witch"]);

    // p5 eaten, lover p6 (Hunter) dies of grief and still shoots.
    expect(state.step).toEqual({
      kind: "deaths",
      context: "dawn",
      deaths: [
        { playerId: "p5", cause: "wolves" },
        { playerId: "p6", cause: "grief" },
      ],
    });
    state = applyAction(state, go);
    expect(state.step).toEqual({ kind: "hunter", playerId: "p6" });
    state = applyAction(state, { type: "hunter", targetId: "p3" });
    state = applyAction(state, go);
    expect(state.step.kind).toBe("game-over");
    expect(state.winner?.team).toBe("village");
  });

  it("dates night deaths to the night, then opens the day", () => {
    const state = play(setup(["werewolf", "villager", "villager", "villager"]), [{ type: "wolves", targetId: "p1" }]);
    expect(state.phase).toEqual({ kind: "day", number: 1 });
    expect(state.players[1].death?.phase).toEqual({ kind: "night", number: 1 });
    expect(state.events.at(-1)).toMatchObject({ type: "death", phase: { kind: "night", number: 1 } });
  });

  it("numbers the steps of each phase from 0", () => {
    const s = setup(["seer", "werewolf", "villager", "villager", "villager"]);
    expect(createGame(s).phaseStep).toBe(0);
    expect(play(s, [{ type: "seer", targetId: "p1" }]).phaseStep).toBe(1);
    const night2 = play(s, [{ type: "seer", targetId: "p1" }, go, { type: "wolves", targetId: "p2" }, go, { type: "vote", targetId: null }]);
    expect(night2.phase).toEqual({ kind: "night", number: 2 });
    expect(night2.phaseStep).toBe(0);
  });

  it("shows the seer the exact role", () => {
    const state = play(setup(["seer", "werewolf", "villager"]), [{ type: "seer", targetId: "p1" }]);
    expect(state.step).toEqual({ kind: "seer-result", playerId: "p0", targetId: "p1", role: "werewolf" });
  });

  it("tells the Little Girl's presence during the wolves' turn", () => {
    const state = createGame(setup(["werewolf", "little-girl", "villager"]));
    expect(state.step).toEqual({ kind: "wolves", playerIds: ["p0"], littleGirlIds: ["p1"] });
  });

  it("skips first-night-only roles after night 1", () => {
    const s = setup(["cupid", "werewolf", "villager", "villager", "villager"]);
    const state = play(s, [
      { type: "cupid", lovers: ["p2", "p3"] },
      go,
      { type: "wolves", targetId: "p4" },
      go,
      { type: "vote", targetId: null },
    ]);
    expect(state.phase).toEqual({ kind: "night", number: 2 });
    expect(state.step.kind).toBe("wolves");
  });
});

describe("witch", () => {
  it("heals the wolves' victim: nobody dies", () => {
    const state = play(setup(["werewolf", "witch", "villager", "villager"]), [
      { type: "wolves", targetId: "p2" },
      { type: "witch", heal: true, poisonId: null },
    ]);
    expect(state.step).toEqual({ kind: "deaths", context: "dawn", deaths: [] });
    expect(state.players.every((p) => p.alive)).toBe(true);
  });

  it("can poison on the same night: two deaths", () => {
    const state = play(setup(["werewolf", "witch", "villager", "villager"]), [
      { type: "wolves", targetId: "p2" },
      { type: "witch", heal: false, poisonId: "p3" },
    ]);
    expect(state.step).toMatchObject({
      deaths: [
        { playerId: "p2", cause: "wolves" },
        { playerId: "p3", cause: "poison" },
      ],
    });
  });

  it("uses each potion only once", () => {
    const s = setup(["werewolf", "witch", "villager", "villager", "villager"]);
    const state = play(s, [
      { type: "wolves", targetId: "p2" },
      { type: "witch", heal: true, poisonId: null },
      go,
      { type: "vote", targetId: null },
      { type: "wolves", targetId: "p3" },
    ]);
    expect(state.step).toMatchObject({ kind: "witch", canHeal: false, canPoison: true });
    expectError(() => applyAction(state, { type: "witch", heal: true, poisonId: null }), "invalid-action");
  });

  it("is called every night, even with both potions used, roles revealed or not", () => {
    for (const revealRoleOnDeath of [true, false]) {
      const s = setup(["werewolf", "witch", "villager", "villager", "villager", "villager"], { settings: { revealRoleOnDeath } });
      const state = play(s, [
        { type: "wolves", targetId: "p2" },
        { type: "witch", heal: true, poisonId: "p3" },
        go,
        { type: "vote", targetId: null },
        { type: "wolves", targetId: "p4" },
      ]);
      expect(state.step).toEqual({ kind: "witch", playerId: "p1", victimId: "p4", canHeal: false, canPoison: false });
      expect(applyAction(state, { type: "witch", heal: false, poisonId: null }).step).toMatchObject({ kind: "deaths" });
    }
  });

  it("can't poison the wolves' victim", () => {
    const state = play(setup(["werewolf", "witch", "villager", "villager"]), [{ type: "wolves", targetId: "p2" }]);
    expectError(() => applyAction(state, { type: "witch", heal: false, poisonId: "p2" }), "invalid-target");
  });

  it("respects the self-heal setting", () => {
    const state = play(setup(["werewolf", "witch", "villager"], { settings: { witchCanSelfHeal: false } }), [
      { type: "wolves", targetId: "p1" },
    ]);
    expect(state.step).toMatchObject({ kind: "witch", canHeal: false, canPoison: true });
  });
});

describe("thief", () => {
  it("must take a werewolf when both cards are wolves", () => {
    const s = setup(["thief", "seer", "villager", "villager"], { extra: ["werewolf", "werewolf"] });
    const state = createGame(s);
    expect(state.step).toMatchObject({ kind: "thief", mustTakeWolf: true });
    expectError(() => applyAction(state, { type: "thief", pick: null }), "invalid-action");

    const after = applyAction(state, { type: "thief", pick: 0 });
    expect(after.players[0].role).toBe("werewolf");
    expect(after.extraCards).toEqual(["thief", "werewolf"]);
  });

  it("plays his new role the same night", () => {
    const s = setup(["thief", "werewolf", "villager", "villager"], { extra: ["cupid", "villager"] });
    const state = play(s, [{ type: "thief", pick: 0 }]);
    expect(state.step).toEqual({ kind: "cupid", playerId: "p0" });
  });

  it("doesn't end the game before he picks, even with no wolf dealt", () => {
    const s = setup(["thief", "seer", "villager", "villager"], { extra: ["werewolf", "villager"] });
    const state = createGame(s);
    expect(state.step.kind).toBe("thief");
    // Leaving the only wolf face down: the village has already won.
    expect(applyAction(state, { type: "thief", pick: null }).winner?.team).toBe("village");
  });
});

describe("day", () => {
  it("elects a Mayor on day 1 who names a successor on death", () => {
    const s = setup(["werewolf", "hunter", "villager", "villager", "villager"], { settings: { mayor: true } });
    let state = play(s, [{ type: "wolves", targetId: "p2" }, go]);
    expect(state.step.kind).toBe("mayor-election");
    state = applyAction(state, { type: "mayor", targetId: "p1" });
    expect(state.step).toMatchObject({ kind: "vote", mayorId: "p1" });

    // The village votes out its Hunter-Mayor: he shoots, then names a successor.
    state = applyAction(state, { type: "vote", targetId: "p1" });
    state = applyAction(state, go);
    expect(state.step).toEqual({ kind: "hunter", playerId: "p1" });
    const shot = applyAction(state, { type: "hunter", targetId: "p3" });
    expect(applyAction(shot, go).step).toEqual({ kind: "mayor-succession", playerId: "p1" });
    expect(applyAction(applyAction(shot, go), { type: "mayor", targetId: "p4" }).mayorId).toBe("p4");

    // Shooting the last wolf ends the game: no successor to name.
    const last = applyAction(applyAction(state, { type: "hunter", targetId: "p0" }), go);
    expect(last.step).toMatchObject({ kind: "game-over", winner: { team: "village" } });
  });

  it("only elects once", () => {
    const s = setup(["werewolf", "villager", "villager", "villager", "villager"], { settings: { mayor: true } });
    const state = play(s, [
      { type: "wolves", targetId: "p1" },
      go,
      { type: "mayor", targetId: "p2" },
      { type: "vote", targetId: null },
      { type: "wolves", targetId: "p3" },
      go,
    ]);
    expect(state.step).toMatchObject({ kind: "vote", mayorId: "p2" });
  });
});

describe("win checks", () => {
  it("village wins when the last wolf is voted out", () => {
    const state = play(setup(["werewolf", "villager", "villager", "villager"]), [
      { type: "wolves", targetId: "p1" },
      go,
      { type: "vote", targetId: "p0" },
      go,
    ]);
    expect(state.step.kind).toBe("game-over");
    expect(state.winner).toEqual({ team: "village", playerIds: ["p1", "p2", "p3"] });
  });

  it("wolves win when no one else is left", () => {
    const state = play(setup(["werewolf", "villager", "villager"]), [
      { type: "wolves", targetId: "p1" },
      go,
      { type: "vote", targetId: "p2" },
      go,
    ]);
    expect(state.winner).toEqual({ team: "wolves", playerIds: ["p0"] });
  });

  it("wolves win at parity only with the house rule", () => {
    const actions: Action[] = [{ type: "wolves", targetId: "p2" }, { type: "witch", heal: false, poisonId: "p3" }];
    const official = play(setup(["werewolf", "witch", "villager", "villager"]), actions);
    expect(official.winner).toBeNull();
    const parity = play(setup(["werewolf", "witch", "villager", "villager"], { settings: { wolvesWinAtParity: true } }), [
      ...actions,
      go,
    ]);
    expect(parity.winner?.team).toBe("wolves");
  });

  it("mixed lovers win as the last two standing", () => {
    const state = play(setup(["cupid", "werewolf", "villager", "villager"]), [
      { type: "cupid", lovers: ["p1", "p2"] },
      go,
      { type: "wolves", targetId: "p3" },
      go,
      { type: "vote", targetId: "p0" },
      go,
    ]);
    expect(state.winner).toEqual({ team: "lovers", playerIds: ["p1", "p2"] });
  });

  it("mixed lovers stop the wolves from winning", () => {
    const state = play(setup(["cupid", "werewolf", "werewolf", "villager", "villager"]), [
      { type: "cupid", lovers: ["p1", "p3"] },
      go,
      { type: "wolves", targetId: "p0" },
      go,
      { type: "vote", targetId: "p4" },
      go,
    ]);
    // Alive: p1 (wolf, lover), p2 (wolf), p3 (villager, lover).
    expect(state.winner).toBeNull();
    expect(remainingTeams(state).sort()).toEqual(["lovers", "wolves"]);
  });

  it("is a draw when everyone dies", () => {
    // Wolf and Hunter left; the village votes the Hunter, who shoots the wolf.
    const state = play(setup(["werewolf", "hunter", "villager"]), [
      { type: "wolves", targetId: "p2" },
      go,
      { type: "vote", targetId: "p1" },
      go,
      { type: "hunter", targetId: "p0" },
      go,
    ]);
    expect(state.winner).toEqual({ team: null, playerIds: [] });
  });
});

describe("undo", () => {
  it("replaying without the last action gives the previous state", () => {
    const s = setup(["seer", "werewolf", "witch", "villager", "villager"]);
    const log: Action[] = [
      { type: "seer", targetId: "p1" },
      go,
      { type: "wolves", targetId: "p3" },
      { type: "witch", heal: false, poisonId: "p4" },
    ];
    const before = play(s, log.slice(0, -1));
    expect(play(s, log).step.kind).toBe("deaths");
    expect(play(s, log.slice(0, -1))).toEqual(before);
    expect(before.step.kind).toBe("witch");
  });

  it("never mutates the previous state", () => {
    const state = createGame(setup(["werewolf", "villager", "villager"]));
    const snapshot = structuredClone(state);
    applyAction(state, { type: "wolves", targetId: "p1" });
    expect(state).toEqual(snapshot);
  });
});

describe("validation", () => {
  it("rejects actions for the wrong step", () => {
    const state = createGame(setup(["werewolf", "villager", "villager"]));
    expectError(() => applyAction(state, { type: "vote", targetId: null }), "wrong-step");
  });

  it("rejects wolves eating a wolf and targeting the dead", () => {
    const s = setup(["werewolf", "werewolf", "villager", "villager", "villager"]);
    expectError(() => applyAction(createGame(s), { type: "wolves", targetId: "p1" }), "invalid-target");
    const day = play(s, [{ type: "wolves", targetId: "p2" }, go]);
    expectError(() => applyAction(day, { type: "vote", targetId: "p2" }), "invalid-target");
  });

  it("rejects actions after the game is over", () => {
    const over = play(setup(["werewolf", "villager", "villager"]), [
      { type: "wolves", targetId: "p1" },
      go,
      { type: "vote", targetId: "p2" },
      go,
    ]);
    expectError(() => applyAction(over, go), "game-over");
  });
});

describe("setup", () => {
  const players = [0, 1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}`, seat: i }));

  it("reports deck problems", () => {
    expect(deckProblems(5, ["werewolf", "villager", "villager", "villager", "villager"])).toEqual([]);
    expect(deckProblems(5, ["werewolf", "villager"])).toContain("wrong-size");
    expect(deckProblems(3, ["villager", "villager", "villager"])).toContain("no-wolf");
    expect(deckProblems(3, ["seer", "seer", "werewolf"])).toContain("too-many-copies");
    expect(deckProblems(5, ["thief", "werewolf", "villager", "villager", "villager"])).toContain("wrong-size");
  });

  it("deals every card exactly once, the same way for the same random source", () => {
    const deck: RoleId[] = ["thief", "werewolf", "werewolf", "seer", "villager", "villager", "witch"];
    const seeded = () => {
      let x = 42;
      return () => ((x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    };
    const a = dealRoles(players, deck, defaultSettings, {}, seeded());
    const b = dealRoles(players, deck, defaultSettings, {}, seeded());
    expect(a).toEqual(b);
    expect(a.extraCards).toHaveLength(2);
    expect([...Object.values(a.roles), ...a.extraCards].sort()).toEqual([...deck].sort());
  });
});

describe("suggested deck", () => {
  it("is playable for every group size", () => {
    for (let n = 3; n <= 24; n++) expect(deckProblems(n, suggestedDeck(n))).toEqual([]);
  });
});

describe("phone views", () => {
  it("never shows other players' roles, unless revealed on death or at the end", () => {
    const hidden = play(setup(["werewolf", "villager", "villager", "villager"], { settings: { revealRoleOnDeath: false } }), [
      { type: "wolves", targetId: "p1" },
    ]);
    expect(publicGame(hidden).dead).toEqual([{ playerId: "p1", role: null }]);
    expect(publicGame(hidden).roles).toBeNull();
    expect(playerInfo(hidden, "p2")).toMatchObject({ role: "villager", team: "village", loverId: null });

    const over = play(setup(["werewolf", "villager", "villager"], { settings: { revealRoleOnDeath: false } }), [
      { type: "wolves", targetId: "p1" },
      go,
      { type: "vote", targetId: "p2" },
      go,
    ]);
    expect(publicGame(over).roles).toEqual({ p0: "werewolf", p1: "villager", p2: "villager" });
  });
});

describe("narration", () => {
  const s = () => setup(["werewolf", "seer", "villager", "villager", "villager"]);

  it("opens with the prologue, then the first night", () => {
    let state = engine.createGame(s());
    expect(state.step).toEqual({ kind: "prologue" });
    state = engine.applyAction(state, go);
    // The first call of the night opens it ("Night falls…").
    expect(state).toMatchObject({ phase: { kind: "night", number: 1 }, phaseStep: 0, step: { kind: "seer" } });
  });

  it("waits for the game master between night and day, and only then kills", () => {
    let state = engine.replay(s(), [go, { type: "seer", targetId: "p0" }, go, { type: "wolves", targetId: "p2" }]);
    expect(state.step).toEqual({ kind: "phase-end", next: { kind: "day", number: 1 } });
    expect(state.phase.kind).toBe("night");
    expect(state.players[2].alive).toBe(true);
    state = engine.applyAction(state, go);
    expect(state.step).toMatchObject({ kind: "deaths", context: "dawn" });
    expect(state.players[2].alive).toBe(false);

    state = engine.replay(s(), [go, { type: "seer", targetId: "p0" }, go, { type: "wolves", targetId: "p2" }, go, go]);
    state = engine.applyAction(state, { type: "vote", targetId: null });
    expect(state.step).toEqual({ kind: "phase-end", next: { kind: "night", number: 2 } });
    state = engine.applyAction(state, go);
    expect(state).toMatchObject({ phase: { kind: "night", number: 2 }, phaseStep: 0 });
  });

  it("goes straight to the end when a death ends the game", () => {
    const state = play(setup(["werewolf", "villager", "villager"]), [{ type: "wolves", targetId: "p1" }, go]);
    const over = applyAction(state, { type: "vote", targetId: "p0" });
    expect(applyAction(over, go).step.kind).toBe("game-over");
  });

  it("calls a card the Thief left over, and the lovers after a bluffed Cupid", () => {
    const state = createGame(setup(["thief", "werewolf", "villager", "villager"], { extra: ["cupid", "seer"] }));
    const after = applyAction(state, { type: "thief", pick: null });
    expect(after.step).toEqual({ kind: "bluff", turn: "cupid", role: "cupid" });
    const lovers = applyAction(after, go);
    expect(lovers.step).toEqual({ kind: "bluff", turn: "lovers", role: "cupid" });
    expect(applyAction(lovers, go).step).toEqual({ kind: "bluff", turn: "seer", role: "seer" });
  });
});

describe("logs from older engines", () => {
  it("fill in the steps they didn't have", () => {
    const s = setup(["werewolf", "witch", "villager", "villager", "villager", "villager"]);
    // Night 1: both potions. Night 2: the old engine skipped the Witch.
    const old: Action[] = [
      { type: "wolves", targetId: "p2" },
      { type: "witch", heal: true, poisonId: "p3" },
      go,
      { type: "vote", targetId: null },
      { type: "wolves", targetId: "p4" },
      go,
    ];
    const log = engine.upgradeLog(s, old)!;
    const state = engine.replay(s, log);
    expect(state.step).toMatchObject({ kind: "vote" });
    expect(state.players.filter((p) => !p.alive).map((p) => p.id)).toEqual(["p3", "p4"]);
    expect(log.filter((a) => a.type === "witch")).toHaveLength(2);
  });

  it("keep a game that ended on a Mayor's succession", () => {
    const s = setup(["werewolf", "villager", "villager", "villager"], { settings: { mayor: true } });
    const old: Action[] = [
      { type: "wolves", targetId: "p1" },
      go,
      { type: "mayor", targetId: "p2" },
      { type: "vote", targetId: "p0" },
      go,
      { type: "mayor", targetId: "p3" },
    ];
    const log = engine.upgradeLog(s, old)!;
    expect(engine.replay(s, log).step).toMatchObject({ kind: "game-over", winner: { team: "village" } });
  });

  it("are dropped when they no longer fit", () => {
    expect(engine.upgradeLog(setup(["werewolf", "villager", "villager"]), [{ type: "seer", targetId: "p1" }])).toBeNull();
  });
});
