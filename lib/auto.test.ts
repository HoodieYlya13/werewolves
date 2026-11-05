import { describe, expect, it } from "vitest";
import { assignRoles, createGame, defaultSettings, type RoleId, type Settings } from "./engine";
import * as auto from "./auto";
import en from "./i18n/dictionaries/en";

function room(roleList: RoleId[], settings: Partial<Settings> = {}) {
  const players = roleList.map((_, i) => ({ id: `p${i}`, name: `P${i}`, seat: i }));
  const setup = assignRoles(players, Object.fromEntries(players.map((p, i) => [p.id, roleList[i]])), [], {
    ...defaultSettings,
    mayor: false,
    ...settings,
  });
  let now = 1_000_000;
  const ctx = () => ({ dict: en, random: () => 0, now });
  const r: auto.AutoRoom = {
    game: createGame(setup),
    log: [],
    auto: auto.startAuto({ deck: "hidden", style: "classic", discussionSeconds: 120 }, ctx()),
    ballot: null,
    timer: null,
    candidates: [],
  };
  auto.tick(r, ctx());
  /** Lets time pass, reading every line straight away, until `until` holds (or a long while). */
  const run = (until: () => boolean, maxMs = 30 * 60_000) => {
    const end = now + maxMs;
    while (!until() && now < end) {
      if (r.auto.phase === "say" && r.auto.cue) auto.cueDone(r, r.auto.cue.id, ctx());
      auto.tick(r, ctx());
      if (until()) break;
      now += 500;
      auto.tick(r, ctx());
    }
  };
  /** Until `kind`'s turn is open on the phones. */
  const turn = (kind: string) =>
    run(() => r.game.step.kind === kind && r.auto.phase === "wait" && auto.currentBeat(r, en)?.wait.kind === "input");
  return { r, ctx, run, turn, advance: (ms: number) => (now += ms), step: () => r.game.step.kind };
}

describe("games without a game master", () => {
  it("opens with the cards, the story, then night falls", () => {
    const g = room(["werewolf", "seer", "villager", "villager", "villager"]);
    expect(g.r.auto.cue?.lines[0]).toBe(en.auto.lookAtCard);
    g.turn("seer");
    expect(g.r.auto.cue?.lines).toContain(en.auto.wake.seer);
    expect(auto.phoneTurn(g.r, "p1", en)).toMatchObject({ kind: "pick", step: "seer" });
    expect(auto.phoneTurn(g.r, "p2", en)).toBeNull();
  });

  it("lets only the right player play, then sends them back to sleep", () => {
    const g = room(["werewolf", "seer", "villager", "villager", "villager"]);
    g.turn("seer");
    expect(auto.answer(g.r, "p2", { type: "seer", targetId: "p0" }, g.ctx())).toBe(false);
    expect(auto.answer(g.r, "p1", { type: "seer", targetId: "p0" }, g.ctx())).toBe(true);
    auto.tick(g.r, g.ctx());
    expect(g.step()).toBe("seer-result");
    expect(auto.phoneTurn(g.r, "p1", en)).toMatchObject({ kind: "seer-result", targetId: "p0", role: "werewolf" });
    g.turn("wolves");
    // The seer went back to sleep, then the night waited before calling the pack.
    expect(g.r.auto.cue?.lines).toContain(en.auto.wake.wolves);
  });

  it("reminds twice, offers one more minute, then skips", () => {
    const g = room(["werewolf", "seer", "villager", "villager", "villager"]);
    g.turn("seer");
    g.advance(auto.TIMING.reminder);
    auto.tick(g.r, g.ctx());
    expect(g.r.auto.cue?.lines[0]).toBe("Seer, it's still your turn.");
    expect(auto.moreTime(g.r, "p1", g.ctx())).toBe(false);
    g.advance(auto.TIMING.lastCall - auto.TIMING.reminder);
    auto.tick(g.r, g.ctx());
    expect(g.r.auto.reminded).toBe(2);
    expect(auto.autoPublic(g.r, "p1", en).clock).toMatchObject({ lastCall: true, canExtend: true });
    g.advance(auto.TIMING.skip - auto.TIMING.lastCall - 1_000);
    expect(auto.moreTime(g.r, "p1", g.ctx())).toBe(true);
    expect(auto.moreTime(g.r, "p1", g.ctx())).toBe(false);
    g.advance(30_000);
    auto.tick(g.r, g.ctx());
    expect(g.step()).toBe("seer");
    g.advance(31_000);
    auto.tick(g.r, g.ctx());
    // Skipped: no result to show.
    expect(g.r.log.at(-1)).toEqual({ type: "seer", targetId: null });
    expect(g.step()).toBe("wolves");
  });

  it("kills only when every wolf agrees", () => {
    const g = room(["werewolf", "werewolf", "villager", "villager", "villager", "villager"]);
    g.turn("wolves");
    expect(auto.wolfPick(g.r, "p0", "p1", g.ctx())).toBe(false);
    auto.wolfPick(g.r, "p0", "p2", g.ctx());
    auto.wolfPick(g.r, "p1", "p3", g.ctx());
    auto.tick(g.r, g.ctx());
    expect(g.step()).toBe("wolves");
    expect(auto.phoneTurn(g.r, "p1", en)).toMatchObject({ kind: "wolves", picks: { p0: "p2", p1: "p3" } });
    auto.wolfPick(g.r, "p1", "p2", g.ctx());
    auto.tick(g.r, g.ctx());
    expect(g.r.log.at(-1)).toEqual({ type: "wolves", targetId: "p2" });
  });

  it("no agreement in time: nobody dies", () => {
    const g = room(["werewolf", "werewolf", "villager", "villager", "villager", "villager"]);
    g.turn("wolves");
    auto.wolfPick(g.r, "p0", "p2", g.ctx());
    g.advance(auto.TIMING.skip);
    auto.tick(g.r, g.ctx());
    expect(g.r.log.at(-1)).toEqual({ type: "wolves", targetId: null });
    g.run(() => g.step() === "deaths");
    expect(g.r.auto.cue?.lines.some((l) => en.game.steps.deaths.nobody.includes(l))).toBe(true);
  });

  it("wakes everyone to check their phone, then the lovers alone", () => {
    const g = room(["cupid", "werewolf", "villager", "villager", "villager"]);
    g.turn("cupid");
    auto.answer(g.r, "p0", { type: "cupid", lovers: ["p2", "p3"] }, g.ctx());
    auto.tick(g.r, g.ctx());
    expect(g.step()).toBe("lovers");
    g.run(() => g.r.auto.cue?.lines[0] === en.auto.everyoneCheck);
    // Nothing on the phones while the narrator is still talking.
    expect(auto.phoneTurn(g.r, "p2", en)).toBeNull();
    g.run(() => g.r.auto.phase === "wait");
    expect(auto.phoneTurn(g.r, "p2", en)).toEqual({ kind: "check", message: "lover", partnerId: "p3" });
    expect(auto.phoneTurn(g.r, "p4", en)).toEqual({ kind: "check", message: "nothing" });
    g.run(() => g.r.auto.cue?.lines[0] === en.auto.groupWake.lovers && g.r.auto.phase === "wait");
    expect(auto.phoneTurn(g.r, "p3", en)).toEqual({ kind: "group", group: "lovers", ids: ["p2", "p3"] });
    expect(auto.phoneTurn(g.r, "p4", en)).toBeNull();
  });

  it("runs the day: debate, early vote when most are ready, then the result", () => {
    const g = room(["werewolf", "villager", "villager", "villager", "villager"]);
    g.turn("wolves");
    auto.wolfPick(g.r, "p0", "p4", g.ctx());
    g.run(() => g.step() === "vote" && g.r.auto.phase === "wait" && auto.currentBeat(g.r, en)?.wait.kind === "debate");
    expect(g.r.timer?.durationMs).toBe(120_000);
    for (const id of ["p0", "p1"]) auto.setReady(g.r, id, true, g.ctx());
    auto.tick(g.r, g.ctx());
    expect(g.r.ballot).toBeNull();
    auto.setReady(g.r, "p2", true, g.ctx());
    g.run(() => !!g.r.ballot && g.r.auto.phase === "wait");
    expect(g.r.ballot?.voterIds).toEqual(["p0", "p1", "p2", "p3"]);
    Object.assign(g.r.ballot!.votes, { p0: "p1", p1: "p0", p2: "p0", p3: "p0" });
    auto.tick(g.r, g.ctx());
    expect(g.r.log.at(-1)).toEqual({ type: "vote", targetId: "p0" });
    g.run(() => g.step() === "game-over");
    expect(g.r.game.winner?.team).toBe("village");
  });

  it("votes again between the tied players, then eliminates nobody on a second tie", () => {
    const g = room(["werewolf", "villager", "villager", "villager", "villager"]);
    g.turn("wolves");
    auto.wolfPick(g.r, "p0", "p4", g.ctx());
    g.run(() => g.step() === "vote" && auto.currentBeat(g.r, en)?.wait.kind === "debate");
    for (const id of ["p0", "p1", "p2", "p3"]) auto.setReady(g.r, id, true, g.ctx());
    g.run(() => !!g.r.ballot && g.r.auto.phase === "wait");
    Object.assign(g.r.ballot!.votes, { p0: "p1", p1: "p0", p2: "p1", p3: "p0" });
    auto.tick(g.r, g.ctx());
    expect(g.r.game.step).toMatchObject({ kind: "vote" });
    g.run(() => !!g.r.ballot && g.r.auto.phase === "wait");
    expect([...g.r.ballot!.candidateIds].sort()).toEqual(["p0", "p1"]);
    Object.assign(g.r.ballot!.votes, { p0: "p1", p1: "p0", p2: "p1", p3: "p0" });
    auto.tick(g.r, g.ctx());
    expect(g.r.log.at(-1)).toMatchObject({ type: "vote", tie: true });
    expect(g.r.game.players.filter((p) => p.alive)).toHaveLength(4);
  });

  it("elects a Mayor among the candidates", () => {
    const g = room(["werewolf", "villager", "villager", "villager", "villager"], { mayor: true });
    g.turn("wolves");
    auto.wolfPick(g.r, "p0", "p4", g.ctx());
    g.run(() => g.step() === "mayor-election" && g.r.auto.phase === "wait");
    expect(auto.autoPublic(g.r, "p1", en).candidacy).toBe(true);
    g.r.candidates = ["p1", "p2"];
    g.run(() => !!g.r.ballot);
    expect(g.r.ballot?.candidateIds).toEqual(["p1", "p2"]);
    Object.assign(g.r.ballot!.votes, { p0: "p1", p1: "p1", p2: "p2", p3: "p1" });
    auto.tick(g.r, g.ctx());
    expect(g.r.game.mayorId).toBe("p1");
    g.run(() => g.step() === "vote");
    expect(g.r.auto.cue?.lines).toContain("P1 is your new Mayor.");
  });

  it("calls a turn nobody can play like a real one", () => {
    const g = room(["werewolf", "seer", "villager", "villager", "villager"], { revealRoleOnDeath: false });
    g.turn("seer");
    auto.answer(g.r, "p1", { type: "seer", targetId: "p2" }, g.ctx());
    g.turn("wolves");
    auto.wolfPick(g.r, "p0", "p1", g.ctx());
    // The next night, the dead Seer's turn is still called.
    g.run(() => g.step() === "bluff" && !!g.r.auto.cue?.lines.includes(en.auto.wake.seer));
    expect(g.r.game.phase).toEqual({ kind: "night", number: 2 });
  });

  it("resumes a night with eyes closed first, then where it stopped", () => {
    const g = room(["werewolf", "seer", "villager", "villager", "villager"]);
    g.turn("seer");
    auto.pause(g.r, g.ctx().now);
    expect(auto.phoneTurn(g.r, "p1", en)).toBeNull();
    g.advance(120_000);
    auto.tick(g.r, g.ctx());
    expect(g.step()).toBe("seer");
    auto.resume(g.r, g.ctx().now, en.auto.everyoneSleep);
    expect(g.r.auto.cue?.lines).toEqual([en.auto.everyoneSleep]);
    auto.cueDone(g.r, g.r.auto.cue!.id, g.ctx());
    auto.tick(g.r, g.ctx());
    // The Seer's turn is open again, with the time it had left.
    expect(auto.phoneTurn(g.r, "p1", en)).toMatchObject({ kind: "pick", step: "seer" });
    expect(g.r.auto.deadline - g.ctx().now).toBeGreaterThan(auto.TIMING.skip - 5_000);
  });

  it("speaks to a lone wolf as to a pack", () => {
    const g = room(["werewolf", "villager", "villager", "villager", "villager"], { revealRoleOnDeath: false });
    g.turn("wolves");
    g.advance(auto.TIMING.reminder);
    auto.tick(g.r, g.ctx());
    expect(g.r.auto.cue?.lines[0]).toBe("Werewolves, it's still your turn.");
  });
});
