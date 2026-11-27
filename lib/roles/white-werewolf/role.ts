import { alive, isWolf } from "../../engine/helpers";
import type { RoleDefinition } from "../role-definition";

export const whiteWerewolf: RoleDefinition = {
  id: "white-werewolf",
  team: "white-werewolf",
  max: 1,
  night: {
    order: 56,
    evenNightsOnly: true,
    act: (state, p) => (alive(state).some((o) => o.id !== p.id && isWolf(o)) ? { kind: "white-werewolf", playerId: p.id } : null),
  },
};
