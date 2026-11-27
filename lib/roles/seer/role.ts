import type { RoleDefinition } from "../role-definition";

export const seer: RoleDefinition = {
  id: "seer",
  team: "village",
  max: 1,
  actorCanBorrow: true,
  night: { order: 40, act: (_, p) => ({ kind: "seer", playerId: p.id }) },
};
