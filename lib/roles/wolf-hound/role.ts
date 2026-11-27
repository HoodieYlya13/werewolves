import type { RoleDefinition } from "../role-definition";

export const wolfHound: RoleDefinition = {
  id: "wolf-hound",
  team: "village",
  max: 1,
  night: { order: 14, firstNightOnly: true, act: (_, p) => ({ kind: "wolf-hound", playerId: p.id }) },
};
