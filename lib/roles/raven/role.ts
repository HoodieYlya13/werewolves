import type { RoleDefinition } from "../role-definition";

export const raven: RoleDefinition = {
  id: "raven",
  team: "village",
  max: 1,
  actorCanBorrow: true,
  night: { order: 80, act: (_, p) => ({ kind: "raven", playerId: p.id }) },
};
