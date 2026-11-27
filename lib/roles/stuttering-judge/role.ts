import { holders } from "../../engine/helpers";
import type { RoleDefinition } from "../role-definition";

/** Asked after each vote whether they signalled for a second one. */
export const stutteringJudge: RoleDefinition = {
  id: "stuttering-judge",
  team: "village",
  max: 1,
  uses: { "second-vote": 1 },
  calls: [
    {
      id: "judge",
      phase: "day",
      order: 30,
      build: (state) => {
        const judge = holders(state, "stuttering-judge")[0];
        return judge && (judge.uses["second-vote"] ?? 0) > 0 ? { kind: "judge", playerId: judge.id } : null;
      },
    },
  ],
};
