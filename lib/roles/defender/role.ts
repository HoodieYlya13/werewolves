import type { RoleDefinition } from "../role-definition";

export const defender: RoleDefinition = {
  id: "defender",
  team: "village",
  max: 1,
  actorCanBorrow: true,
  night: {
    order: 38,
    act: (_, p) => ({ kind: "defender", playerId: p.id, lastProtectedId: p.memo["last-protected"] ?? null }),
  },
};
