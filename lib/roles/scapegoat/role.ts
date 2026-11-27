import type { RoleDefinition } from "../role-definition";

export const scapegoat: RoleDefinition = {
  id: "scapegoat",
  team: "village",
  max: 1,
  onDeath: (_, player, cause) => (cause === "scapegoat" ? [{ kind: "scapegoat", playerId: player.id }] : []),
};
