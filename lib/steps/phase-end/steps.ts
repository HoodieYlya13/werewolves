import { isWolf, silentDay } from "../../engine/helpers";
import type { GameState, PhaseRef } from "../../engine/types";
import type { Dictionary } from "../../i18n/dictionaries/en";
import { pickLine } from "../../auto/beats";
import { playOn, type Call, type StepModules, type StepOf } from "../step-module";

/** Closes every night and day: the narrator moves on when the table is ready. */
const phaseEndCall = (phase: PhaseRef["kind"]): Call => ({
  id: "phase-end",
  phase,
  order: 1000,
  build: (state) => ({
    kind: "phase-end",
    next: state.phase.kind === "night" ? { kind: "day", number: state.phase.number } : { kind: "night", number: state.phase.number + 1 },
  }),
});

export const phaseEndCalls = [phaseEndCall("night"), phaseEndCall("day")];

/** The line of story that ends a night or a day. A wolf the village killed today cheers the ghost up, when cards are shown (else it gives the wolf away). */
export function phaseEndLine(dict: Dictionary, game: GameState, step: StepOf<"phase-end">) {
  const story = dict.game.story;
  const wolfDown =
    game.setup.settings.revealRoleOnDeath &&
    game.players.some((p) => p.death && p.death.phase.kind === game.phase.kind && p.death.phase.number === game.phase.number && isWolf(p));
  const lines = step.next.kind === "day" ? story.nightEnds : wolfDown ? story.dayEndsWolfDown : silentDay(game) ? story.dayEndsNoVote : story.dayEnds;
  return pickLine(lines, `${game.phase.kind}${game.phase.number}`);
}

export const phaseEndSteps: StepModules<"phase-end"> = {
  "phase-end": {
    resolve: playOn,
    beats: (step, { dict, game }) => [{ say: [phaseEndLine(dict, game, step)], wait: { kind: "hold", ms: 2_000 } }],
  },
};
