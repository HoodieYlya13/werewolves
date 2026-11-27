import { getAlive } from "./helpers";
import { EngineError, type Action, type GameState, type Player, type Step } from "./types";

/** The action played on a step, read the way the step expects it. */
export type Answer = {
  expect: <T extends Action["type"]>(type: T) => Extract<Action, { type: T }>;
  /** Living players picked, between `min` and `max` of them. */
  picked: (min: number, max: number) => Player[];
  /** A choice: an index, a side, yes or no. */
  choice: () => Extract<Action, { type: "choose" }>["value"];
};

export function answerFor(state: GameState, step: Step, action: Action): Answer {
  const expect = <T extends Action["type"]>(type: T) => {
    if (action.type !== type) {
      throw new EngineError("wrong-step", `Step "${step.kind}" expects "${type}", got "${action.type}"`);
    }
    return action as Extract<Action, { type: T }>;
  };
  return {
    expect,
    picked: (min, max) => {
      const ids = [...new Set(expect("pick").targetIds)];
      if (ids.length < min || ids.length > max) {
        throw new EngineError("invalid-action", `Pick between ${min} and ${max} players`);
      }
      return ids.map((id) => getAlive(state, id));
    },
    choice: () => expect("choose").value,
  };
}
