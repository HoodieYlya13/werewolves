import { alive, hasPower } from "../../engine/helpers";
import type { RoleDefinition } from "../role-definition";

export const hunter: RoleDefinition = {
  id: "hunter",
  team: "village",
  max: 1,
  onDeath: (state, player) => (hasPower(state, player) && alive(state).length > 0 ? [{ kind: "hunter", playerId: player.id }] : []),
};
