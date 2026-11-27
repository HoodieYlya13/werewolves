import { bluff } from "../../engine/bluff";
import type { RoleDefinition } from "../role-definition";

export const cupid: RoleDefinition = {
  id: "cupid",
  team: "village",
  max: 1,
  night: { order: 20, firstNightOnly: true, act: (_, p) => ({ kind: "cupid", playerId: p.id }) },
  calls: [
    {
      id: "lovers",
      phase: "night",
      // Straight after Cupid: "Cupid, go back to sleep. I'll tap the lovers…"
      order: 21,
      firstNightOnly: true,
      // Follows Cupid's call, even a bluffed one.
      build: (state) => (state.lovers ? { kind: "lovers", lovers: state.lovers } : bluff(state, "lovers", "cupid")),
    },
  ],
};
