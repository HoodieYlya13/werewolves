import { format } from "../../i18n/config";
import type { Dictionary } from "../../i18n/dictionaries/en";
import type { GameState } from "../../engine/types";
import { TIMING } from "../../auto/timing";
import type { StepModules } from "../step-module";

/**
 * What the whole table must know from the start, read after the opening story:
 * who the Villager-Villager is, and the Abominable Sectarian's two groups.
 */
export function tableLines(dict: Dictionary, game: GameState): string[] {
  const t = dict.game.story;
  const lines = game.players.filter((p) => p.role === "villager-villager").map((p) => format(t.villagerVillager, { name: p.name }));
  const groups = game.setup.groups;
  if (groups && game.players.some((p) => p.role === "abominable-sectarian")) {
    const side = (g: "a" | "b") => game.players.filter((p) => groups[p.id] === g).map((p) => p.name).join(", ");
    lines.push(format(t.groups, { a: side("a"), b: side("b") }));
  }
  return lines;
}

/** The story that opens the game: the narrator was the wolves' first victim. */
export const prologueSteps: StepModules<"prologue"> = {
  prologue: {
    resolve: (state, _, answer) => {
      answer.expect("continue");
      // The story was the prelude: the first night (or day) opens now.
      state.phaseStep = -1;
    },
    beats: (_, { dict, game }) => [
      { say: [dict.auto.lookAtCard], show: "card", wait: { kind: "hold", ms: TIMING.card } },
      { say: [...dict.game.story.prologue.say, ...tableLines(dict, game)], wait: { kind: "hold", ms: 1_000 } },
    ],
  },
};
