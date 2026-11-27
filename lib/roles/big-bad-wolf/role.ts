import { callsAnyway, wolfCardShown } from "../../engine/bluff";
import type { RoleDefinition } from "../role-definition";

export const bigBadWolf: RoleDefinition = {
  id: "big-bad-wolf",
  team: "wolves",
  max: 1,
  night: {
    order: 54,
    act: (state, p) => (state.wolfDied ? null : { kind: "big-bad-wolf", playerId: p.id, wolvesTargetId: state.night.wolvesTargetId }),
    // The village saw a wolf's card on a dead player: it knows the second victim is gone, nothing to hide.
    isBluffed: (state) => !wolfCardShown(state) && callsAnyway(state, "big-bad-wolf"),
  },
};
