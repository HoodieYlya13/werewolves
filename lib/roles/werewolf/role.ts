import { alive, holders, isWolf, sickTonight } from "../../engine/helpers";
import type { RoleDefinition } from "../role-definition";

/** Every werewolf wakes with the pack: one call for them all. */
export const werewolf: RoleDefinition = {
  id: "werewolf",
  team: "wolves",
  calls: [
    {
      id: "wolves",
      phase: "night",
      order: 50,
      build: (state) => {
        const wolves = alive(state).filter((p) => isWolf(p) && !sickTonight(state, p.id));
        // The pack is always called, roles revealed or not: the village must never
        // learn how many wolves are left, and a Wild Child turning wolf mustn't
        // make the call come back out of nowhere.
        if (wolves.length === 0) return { kind: "bluff", turn: "wolves", role: "werewolf" };
        return {
          kind: "wolves",
          playerIds: wolves.map((p) => p.id),
          littleGirlIds: holders(state, "little-girl").map((p) => p.id),
        };
      },
    },
  ],
};
