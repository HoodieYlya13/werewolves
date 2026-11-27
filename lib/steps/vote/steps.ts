import { alive, getAlive, getPlayer, hasPower, holders, log } from "../../engine/helpers";
import { kill } from "../../engine/deaths";
import { EngineError, type GameState, type Step } from "../../engine/types";
import { format } from "../../i18n/config";
import { input, nameOf, namesOf, type Beat } from "../../auto/beats";
import type { Call, StepModules } from "../step-module";

/** The day's vote, with who may not vote today and what weighs on it. */
export function voteStep(state: GameState, second: boolean, runoff: string[] | null = null): Step {
  const living = alive(state);
  const restricted = state.votersOnly?.day === state.phase.number ? state.votersOnly.ids : null;
  const cannotVote = living.filter((p) => p.flags["idiot-revealed"] || (restricted && !restricted.includes(p.id))).map((p) => p.id);
  return {
    kind: "vote",
    mayorId: state.mayorId,
    ravenTargetId: state.ravenTargetId && getPlayer(state, state.ravenTargetId).alive ? state.ravenTargetId : null,
    cannotVote,
    scapegoatId: holders(state, "scapegoat")[0]?.id ?? null,
    second,
    runoff: runoff && runoff.filter((id) => getPlayer(state, id).alive),
  };
}

export const voteCall: Call = { id: "vote", phase: "day", order: 20, build: (state) => voteStep(state, false) };

/** The village's vote lands on `targetId` (null: nobody goes). */
export function eliminate(state: GameState, targetId: string | null) {
  log(state, { type: "vote", targetId });
  if (targetId === null) return;
  const target = getAlive(state, targetId);
  // The Village Idiot survives his first vote, but loses his own vote.
  if (target.role === "village-idiot" && !target.flags["idiot-revealed"] && hasPower(state, target)) {
    target.flags["idiot-revealed"] = true;
    state.pending.unshift({ kind: "idiot", playerId: target.id });
    log(state, { type: "idiot-revealed", playerId: target.id });
    return;
  }
  kill(state, [{ playerId: target.id, cause: "vote" }], "vote");
}

export const voteSteps: StepModules<"vote" | "tie-break"> = {
  vote: {
    resolve: (state, step, answer) => {
      const { targetId, tie, tiedIds } = answer.expect("vote");
      state.votedToday = true;
      if (tie) {
        if (step.scapegoatId) {
          // The Scapegoat dies instead of the tied players: the Mayor has nothing to settle.
          log(state, { type: "vote", targetId: null });
          kill(state, [{ playerId: step.scapegoatId, cause: "scapegoat" }], "vote");
        } else if (state.mayorId) {
          state.pending.unshift({ kind: "tie-break", playerId: state.mayorId, tiedIds: (tiedIds ?? []).filter((id) => getPlayer(state, id).alive) });
        } else if (!step.runoff) {
          // A second vote, only against the tied players.
          state.pending.unshift(voteStep(state, step.second, tiedIds ?? []));
        } else {
          log(state, { type: "vote", targetId: null });
        }
        return;
      }
      if (targetId && step.runoff?.length && !step.runoff.includes(targetId)) {
        throw new EngineError("invalid-target", "Pick one of the tied players");
      }
      eliminate(state, targetId);
    },
    beats: (step, { dict, game, debateMinutes }) => {
      const t = dict.game.steps.vote;
      // The second vote after a tie follows straight on, without a new debate.
      if (step.runoff) {
        return [{ say: [step.runoff.length ? format(t.runoff, { names: namesOf(game, step.runoff) }) : t.runoffAll, dict.auto.vote], wait: { kind: "ballot" } }];
      }
      // The Scapegoat let nobody vote: the village still talks, and the empty ballot eliminates nobody.
      const noVoters = game.players.every((p) => !p.alive || step.cannotVote.includes(p.id));
      const debate: Beat = {
        say: [step.second ? t.second : "", noVoters ? t.noVoters : "", format(dict.auto.discussion, { minutes: debateMinutes(step.second) })].filter(Boolean),
        wait: { kind: "debate" },
      };
      return [debate, { say: noVoters ? [] : [dict.auto.vote], wait: { kind: "ballot" } }];
    },
  },
  /** A tie with a living Mayor (and no Scapegoat): the Mayor picks who goes. */
  "tie-break": {
    resolve: (state, step, answer) => {
      // Nobody: the Mayor didn't choose in time (no game master).
      const [target] = answer.picked(0, 1);
      if (target && step.tiedIds.length > 0 && !step.tiedIds.includes(target.id)) {
        throw new EngineError("invalid-target", "Pick one of the tied players");
      }
      eliminate(state, target?.id ?? null);
    },
    actors: (step) => [step.playerId],
    caller: () => "mayor",
    turn: (step, { ids }) => ({
      kind: "pick",
      step: "tie-break",
      min: 1,
      max: 1,
      targets: step.tiedIds.length ? ids((p) => step.tiedIds.includes(p.id)) : ids(),
      skip: false,
    }),
    beats: (step, { dict, game }) => [input([format(dict.auto.tieBreak, { name: nameOf(game, step.playerId), names: namesOf(game, step.tiedIds) })])],
  },
};
