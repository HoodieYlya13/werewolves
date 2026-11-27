import { callsAnyway } from "../../engine/bluff";
import { holders, isWolf, livingNeighbours } from "../../engine/helpers";
import type { RoleDefinition } from "../role-definition";

/** Each morning, the bear growls if a wolf sits next to the tamer. */
export const bearTamer: RoleDefinition = {
  id: "bear-tamer",
  team: "village",
  max: 1,
  calls: [
    {
      id: "bear",
      phase: "day",
      order: 5,
      build: (state) => {
        if (state.phase.number === 0) return null;
        const tamer = holders(state, "bear-tamer")[0];
        // The bear keeps quiet rather than going missing, which would tell the village the tamer is gone.
        if (!tamer) return callsAnyway(state, "bear-tamer") ? { kind: "bear", playerId: null, growls: false } : null;
        const neighbours = livingNeighbours(state, tamer);
        // An infected Bear Tamer's bear always growls.
        const growls = !!tamer.flags.infected || (!!neighbours && (isWolf(neighbours.left) || isWolf(neighbours.right)));
        return { kind: "bear", playerId: tamer.id, growls };
      },
    },
  ],
};
