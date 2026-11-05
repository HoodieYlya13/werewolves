import { applyAction, createGame } from "./flow";
import type { Action, GameSetup, GameState, Step } from "./types";

/**
 * Bumped when the engine adds steps an older action log doesn't answer.
 * 2: the prologue, the end of each night and day, the Witch called without
 * potions, turns called for powerless or left-over cards, and no successor
 * once the game is won.
 * 3: the bear's morning line read on after the Bear Tamer is gone, while
 * roles stay hidden.
 * 4: a tie with a living Mayor (and no Scapegoat) is the Mayor's to break.
 * 5: a tie with neither goes to a second vote between the tied players.
 */
export const ENGINE_VERSION = 5;

/** The answer to a step older engines skipped, when it has a neutral one. */
function filler(step: Step): Action | null {
  switch (step.kind) {
    case "prologue":
    case "phase-end":
    case "bluff":
    case "bear":
      return { type: "continue" };
    case "witch":
      return !step.canHeal && !step.canPoison ? { type: "witch", heal: false, poisonId: null } : null;
    // Older ties eliminated nobody.
    case "tie-break":
      return { type: "pick", targetIds: [] };
    case "vote":
      return step.runoff ? { type: "vote", targetId: null, tie: true } : null;
    default:
      return null;
  }
}

/**
 * Rewrites a log saved by an older engine so the current one can replay it,
 * answering the steps it didn't have. Null when it no longer fits (a game
 * running across the deploy then goes back to the lobby instead of breaking).
 */
export function upgradeLog(setup: GameSetup, log: Action[]): Action[] | null {
  // Before version 2, the Mayor was called the Sheriff.
  log = log.map((action) => ((action.type as string) === "sheriff" ? { ...action, type: "mayor" } : action) as Action);
  try {
    let state: GameState = createGame(setup);
    const out: Action[] = [];
    const answer = (action: Action) => {
      state = applyAction(state, action);
      out.push(action);
    };
    for (const action of log) {
      // Older engines asked for a dying Mayor's successor after the game was won.
      if (state.step.kind === "game-over") break;
      for (;;) {
        // Never in an old log: always answered first.
        while (state.step.kind === "prologue" || state.step.kind === "phase-end") answer({ type: "continue" });
        try {
          answer(action);
          break;
        } catch (e) {
          const fill = filler(state.step);
          if (!fill) throw e;
          answer(fill);
        }
      }
    }
    return out;
  } catch {
    return null;
  }
}
