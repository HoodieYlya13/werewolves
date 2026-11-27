import { getPlayer, isWolf, livingNeighbours, log } from "../../engine/helpers";
import { actorCall, nightCall } from "../../auto/beats";
import { TIMING } from "../../auto/timing";
import { playOn, type StepModules } from "../../steps/step-module";

export const foxSteps: StepModules<"fox" | "fox-result"> = {
  fox: {
    resolve: (state, step, answer) => {
      // Nobody: the Fox didn't choose in time (no game master).
      const [center] = answer.picked(0, 1);
      if (!center) return;
      const neighbours = livingNeighbours(state, center);
      const group = [...new Map([neighbours?.right, center, neighbours?.left].filter(Boolean).map((p) => [p!.id, p!])).values()];
      const hasWolf = group.some(isWolf);
      const fox = getPlayer(state, step.playerId);
      if (!hasWolf && fox.role === "fox") fox.flags["fox-powerless"] = true;
      state.pending.unshift({ kind: "fox-result", playerId: fox.id, playerIds: group.map((p) => p.id), hasWolf });
      log(state, { type: "fox", playerId: fox.id, centerId: center.id, hasWolf });
    },
    // Skipped: no result screen follows to put the Fox back to sleep.
    sleeper: (_, next) => (next.kind === "fox-result" ? null : "fox"),
    actors: (step) => [step.playerId],
    turn: (_, { ids }) => ({ kind: "pick", step: "fox", min: 1, max: 1, targets: ids(), skip: false }),
    beats: nightCall("fox"),
  },
  "fox-result": {
    resolve: playOn,
    beats: (_, { dict, game }) => [
      { say: [], show: "result", wait: { kind: "hold", ms: TIMING.look } },
      { say: [actorCall(dict, game, dict.game.steps["fox-result"].say)], wait: { kind: "hold", ms: TIMING.sleep } },
    ],
    result: (step) => ({ playerId: step.playerId, turn: { kind: "fox-result", playerIds: step.playerIds, hasWolf: step.hasWolf } }),
  },
};
