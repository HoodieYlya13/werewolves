import { log } from "../../engine/helpers";
import type { RoleDefinition } from "../role-definition";

export const elder: RoleDefinition = {
  id: "elder",
  team: "village",
  max: 1,
  uses: { lives: 1 },
  // Killed by his own village: every villager loses their power.
  onDeath: (state, _, cause) => {
    if ((cause === "vote" || cause === "poison" || cause === "hunter") && !state.villagePowersLost) {
      state.villagePowersLost = true;
      log(state, { type: "powers-lost" });
    }
    return [];
  },
};
