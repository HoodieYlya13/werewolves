import { bluff } from "../../engine/bluff";
import { alive } from "../../engine/helpers";
import type { RoleDefinition } from "../role-definition";

export const piedPiper: RoleDefinition = {
  id: "pied-piper",
  team: "piper",
  max: 1,
  night: {
    order: 70,
    act: (state, piper) => {
      const charmable = alive(state).filter((p) => p.id !== piper.id && !p.flags.charmed).length;
      const setting = state.setup.settings.piperCharms;
      const count = Math.min(setting === "choice" ? 2 : setting, charmable);
      const min = setting === "choice" ? Math.min(1, count) : count;
      return count > 0 ? { kind: "piper", playerId: piper.id, count, min } : null;
    },
  },
  calls: [
    {
      id: "charmed",
      phase: "night",
      order: 72,
      build: (state) => {
        const charmed = alive(state).filter((p) => p.flags.charmed);
        const newIds = state.events
          .filter((e) => e.type === "charmed" && e.phase.kind === "night" && e.phase.number === state.phase.number)
          .flatMap((e) => (e.type === "charmed" ? e.targetIds : []));
        // Follows the Piper's call, even a bluffed one.
        if (newIds.length === 0) return bluff(state, "charmed", "pied-piper");
        return { kind: "charmed", playerIds: charmed.map((p) => p.id), newIds };
      },
    },
  ],
};
