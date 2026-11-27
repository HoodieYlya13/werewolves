import { bluff } from "../../engine/bluff";
import type { RoleDefinition } from "../role-definition";

export const accursedWolfFather: RoleDefinition = {
  id: "accursed-wolf-father",
  team: "wolves",
  max: 1,
  uses: { infect: 1 },
  night: {
    order: 52,
    act: (state, p) => {
      const victimId = state.night.wolvesTargetId;
      if ((p.uses.infect ?? 0) === 0 || !victimId) return null;
      // The Elder can't be infected.
      if (state.players.find((player) => player.id === victimId)?.role === "elder") return null;
      return { kind: "infect", playerId: p.id, victimId };
    },
  },
  calls: [
    {
      id: "infected",
      phase: "night",
      // Once the pack is back asleep: called every night the Wolf-Father may be in play,
      // so the village never learns when somebody really was infected.
      order: 52.5,
      build: (state) => {
        const ids = state.events
          .filter((e) => e.type === "infected" && e.phase.kind === "night" && e.phase.number === state.phase.number)
          .flatMap((e) => (e.type === "infected" ? [e.targetId] : []));
        if (ids.length === 0) return bluff(state, "infected", "accursed-wolf-father");
        return { kind: "infected", playerIds: ids };
      },
    },
  ],
};
