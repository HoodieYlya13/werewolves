import * as engine from ".";
import type { Action, GameSetup, GameState } from "./types";

/**
 * The engine for rule tests: plays through the narrator's own steps (the
 * prologue, the end of each night and day) so tests only list the choices.
 */
function skipNarration(state: GameState): GameState {
  while (state.step.kind === "prologue" || state.step.kind === "phase-end") {
    state = engine.applyAction(state, { type: "continue" });
  }
  return state;
}

export const createGame = (setup: GameSetup) => skipNarration(engine.createGame(setup));
export const applyAction = (state: GameState, action: Action) => skipNarration(engine.applyAction(state, action));
export const replay = (setup: GameSetup, log: Action[]) => log.reduce(applyAction, createGame(setup));
