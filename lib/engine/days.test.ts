import { describe, expect, it } from "vitest";
import { assignRoles, daysBy, defaultSettings, type RoleId, type Settings } from ".";

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
