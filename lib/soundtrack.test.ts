import { describe, expect, it } from "vitest";
import { assignRoles, defaultSettings, replay, type Action, type RoleId } from "./engine";
import { sceneFor } from "./soundtrack";

const players = [0, 1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}`, seat: i }));
const deck: RoleId[] = ["werewolf", "witch", "seer", "villager", "villager"];
const roles = Object.fromEntries(players.map((p, i) => [p.id, deck[i]]));
const setup = (revealRoleOnDeath: boolean) =>
  assignRoles(players, roles, [], { ...defaultSettings, mayor: false, revealRoleOnDeath });
const go: Action = { type: "continue" };

describe("soundtrack", () => {
  it("follows the story: prologue, each role's turn, the day and the vote", () => {
    const s = setup(true);
    const scenes = (log: Action[]) => sceneFor(replay(s, log));
    expect(scenes([])).toBe("prologue");
    expect(scenes([go])).toBe("seer");
    expect(scenes([go, { type: "seer", targetId: "p0" }, go])).toBe("wolves");
    expect(scenes([go, { type: "seer", targetId: "p0" }, go, { type: "wolves", targetId: "p3" }])).toBe("witch");
    const night1: Action[] = [go, { type: "seer", targetId: "p0" }, go, { type: "wolves", targetId: "p3" }, { type: "witch", heal: false, poisonId: null }];
    expect(scenes(night1)).toBe("night");
    expect(scenes([...night1, go])).toBe("day");
    expect(scenes([...night1, go, go])).toBe("vote");
  });

  it("plays a bluffed turn like a real one", () => {
    const s = setup(false);
    // Night 2, the Seer is dead: still called, with the Seer's music.
    const log: Action[] = [go, { type: "seer", targetId: "p0" }, go, { type: "wolves", targetId: "p2" }, { type: "witch", heal: false, poisonId: null }, go, go, { type: "vote", targetId: null }, go];
    const state = replay(s, log);
    expect(state.step).toEqual({ kind: "bluff", turn: "seer", role: "seer" });
    expect(sceneFor(state)).toBe("seer");
  });
});
