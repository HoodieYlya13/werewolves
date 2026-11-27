import { roles } from "../../engine/roles";
import type { RoleDefinition } from "../role-definition";

export const thief: RoleDefinition = {
  id: "thief",
  team: "village",
  max: 1,
  night: {
    order: 10,
    firstNightOnly: true,
    act: (state, thief) => {
      if (state.extraCards.length === 0) return null;
      return {
        kind: "thief",
        playerId: thief.id,
        cards: [...state.extraCards],
        mustTakeWolf: state.extraCards.every((r) => roles[r].team === "wolves"),
      };
    },
  },
};
