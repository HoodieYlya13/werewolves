import type { RoleDefinition } from "../role-definition";

export const fox: RoleDefinition = {
  id: "fox",
  team: "village",
  max: 1,
  actorCanBorrow: true,
  night: { order: 44, act: (_, p) => ({ kind: "fox", playerId: p.id }) },
};
