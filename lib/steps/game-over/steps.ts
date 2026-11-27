import { EngineError } from "../../engine/types";
import type { StepModules } from "../step-module";

export const gameOverSteps: StepModules<"game-over"> = {
  "game-over": {
    resolve: () => {
      throw new EngineError("game-over", "The game is over");
    },
    beats: (step, { dict, game }) => {
      const team = step.winner.team;
      const wins = dict.game.steps["game-over"];
      return [
        {
          say: [dict.game.story.epilogue[team ?? "draw"], team ? wins.wins[team] : wins.draw],
          sound: { kind: "win", team: team === "village" || team === "wolves" ? team : "other", howl: (game.setup.settings.theme ?? "werewolves") === "werewolves" },
          wait: { kind: "end" },
        },
      ];
    },
  },
};
