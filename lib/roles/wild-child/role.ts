import type { RoleDefinition } from "../role-definition";

export const wildChild: RoleDefinition = {
  id: "wild-child",
  team: "village",
  max: 1,
  night: { order: 22, firstNightOnly: true, act: (_, p) => ({ kind: "wild-child", playerId: p.id }) },
};
