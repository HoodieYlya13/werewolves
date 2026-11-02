import { describe, expect, it } from "vitest";
import { assignRoles, daysBy, defaultSettings, killersOf, type RoleId, type Settings } from ".";

const setup = (roleList: RoleId[], settings: Partial<Settings> = {}) => {
  const players = roleList.map((_, i) => ({ id: `p${i}`, name: `P${i}`, seat: i }));
  const roles = Object.fromEntries(players.map((p, i) => [p.id, roleList[i]]));
  return assignRoles(players, roles, [], { ...defaultSettings, mayor: false, ...settings });
};

describe("daysBy", () => {
  const plain = setup(["werewolf", "seer", "villager", "villager"]);

  it("counts the days begun: a night death misses the next day, a day death keeps it", () => {
    expect(daysBy(plain, { kind: "night", number: 1 })).toBe(0);
    expect(daysBy(plain, { kind: "day", number: 1 })).toBe(1);
    expect(daysBy(plain, { kind: "night", number: 2 })).toBe(1);
    expect(daysBy(plain, { kind: "day", number: 3 })).toBe(3);
  });

  it("counts the Angel's opening day 0 as a day", () => {
    const opening = setup(["werewolf", "angel", "villager", "villager"], { angelRule: "opening-vote" });
    expect(daysBy(opening, { kind: "day", number: 0 })).toBe(1);
    expect(daysBy(opening, { kind: "night", number: 1 })).toBe(1);
    expect(daysBy(opening, { kind: "day", number: 1 })).toBe(2);
  });

  it("has no day 0 when the Angel waits for the first vote", () => {
    const first = setup(["werewolf", "angel", "villager", "villager"], { angelRule: "first-vote" });
    expect(daysBy(first, { kind: "day", number: 1 })).toBe(1);
  });
});

describe("killersOf", () => {
  const base = setup(["werewolf", "werewolf", "witch", "hunter", "villager", "villager"]);
  const state = (deaths: Record<string, { cause: import(".").DeathCause; phase: import(".").PhaseRef }>) =>
    ({
      setup: base,
      villagePowersLost: false,
      players: base.players.map((p) => ({
        ...p,
        role: base.roles[p.id],
        alive: !deaths[p.id],
        death: deaths[p.id] ? { playerId: p.id, ...deaths[p.id] } : null,
        uses: {},
        flags: {},
        memo: {},
      })),
    }) as unknown as import(".").GameState;
  const night = (number: number) => ({ kind: "night" as const, number });
  const day = (number: number) => ({ kind: "day" as const, number });
  const victim = (s: import(".").GameState, id: string) => s.players.find((p) => p.id === id)!;

  it("blames the wolves still in the pack that night", () => {
    // p1 (a wolf) was voted out on day 1: p4's death on night 2 is p0's alone.
    const s = state({ p1: { cause: "vote", phase: day(1) }, p4: { cause: "wolves", phase: night(2) }, p5: { cause: "wolves", phase: night(1) } });
    expect(killersOf(s, victim(s, "p4"))).toEqual(["p0"]);
    expect(killersOf(s, victim(s, "p5"))).toEqual(["p0", "p1"]);
  });

  it("blames the Witch, the Hunter, and nobody for a vote", () => {
    const s = state({ p0: { cause: "poison", phase: night(1) }, p1: { cause: "hunter", phase: day(1) }, p4: { cause: "vote", phase: day(1) } });
    expect(killersOf(s, victim(s, "p0"))).toEqual(["p2"]);
    expect(killersOf(s, victim(s, "p1"))).toEqual(["p3"]);
    expect(killersOf(s, victim(s, "p4"))).toEqual([]);
  });
});
