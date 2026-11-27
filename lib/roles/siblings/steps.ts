import { bluff } from "../../engine/bluff";
import { groupBeats } from "../../auto/beats";
import { playOn, type Call, type StepModules } from "../../steps/step-module";

/** The Two Sisters or the Three Brothers wake together on the first night to recognise each other. */
export const siblingsCall = (role: "two-sisters" | "three-brothers", order: number): Call => ({
  id: role,
  phase: "night",
  order,
  firstNightOnly: true,
  build: (state) => {
    const ids = state.players.filter((p) => p.alive && p.role === role).map((p) => p.id);
    return ids.length > 1 ? { kind: "siblings", role, playerIds: ids } : bluff(state, role, role);
  },
});

export const siblingsSteps: StepModules<"siblings"> = {
  siblings: {
    resolve: playOn,
    beats: (step, { dict }) => groupBeats(dict, step.role, false),
    group: (step) => ({ group: step.role, ids: step.playerIds }),
  },
};
