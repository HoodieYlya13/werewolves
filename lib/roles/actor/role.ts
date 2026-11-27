import type { RoleDefinition } from "../role-definition";

export const actor: RoleDefinition = {
  id: "actor",
  team: "village",
  max: 1,
  night: {
    order: 5,
    act: (state, p) => (state.actorCards.length > 0 ? { kind: "actor", playerId: p.id, cards: [...state.actorCards] } : null),
  },
};
