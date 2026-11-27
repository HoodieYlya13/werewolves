import { firstWolfToLeft, hasPower } from "../../engine/helpers";
import type { RoleDefinition } from "../role-definition";

export const knight: RoleDefinition = {
  id: "knight",
  team: "village",
  max: 1,
  // Eaten by the wolves: the first wolf to his left sleeps through the next night and is found dead at dawn.
  onDeath: (state, knight, cause) => {
    if (cause === "wolves" && hasPower(state, knight)) {
      state.rustTargetId = firstWolfToLeft(state, knight)?.id ?? null;
    }
    return [];
  },
};
