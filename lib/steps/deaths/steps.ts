import { elderCostsPowers, shownCard } from "../../engine/helpers";
import type { Death, GameState } from "../../engine/types";
import { format } from "../../i18n/config";
import type { Dictionary } from "../../i18n/dictionaries/en";
import type { Stinger } from "../../sound-types";
import { nameOf, pickLine } from "../../auto/beats";
import { playOn, type StepModules, type StepOf } from "../step-module";

/** One death as the narrator announces it. */
export type AnnouncedDeath = Death & { line: string };

/**
 * The deaths in the order they're read, each with its line. At dawn, the order
 * would hint at who killed whom: by seat, grief last. Dawn tells who died,
 * never how, except a lover's grief; by day, everyone saw it.
 */
export function announcedDeaths(dict: Dictionary, game: GameState, step: StepOf<"deaths">): AnnouncedDeath[] {
  const t = dict.game.steps.deaths;
  const dawn = step.context === "dawn";
  const seed = `${game.phase.kind}${game.phase.number}`;
  const seat = (death: Death) => game.players.findIndex((p) => p.id === death.playerId) + (death.cause === "grief" ? game.players.length : 0);
  const deaths = dawn ? [...step.deaths].sort((a, b) => seat(a) - seat(b)) : step.deaths;
  return deaths.map((death, i) => {
    const name = nameOf(game, death.playerId);
    if (death.cause === "grief") return { ...death, line: format(t.grief, { name }) };
    if (dawn) return { ...death, line: format(pickLine(t.found, seed, i), { name }) };
    return { ...death, line: format(t.died, { name, cause: dict.game.causes[death.cause] }) };
  });
}

/** Nobody died: one of a few lines. */
export const nobodyDiedLine = (dict: Dictionary, game: GameState) => pickLine(dict.game.steps.deaths.nobody, `${game.phase.kind}${game.phase.number}`);

/** The Elder killed in plain sight: the village hears it lost its powers. */
export const announcesPowersLost = (game: GameState, step: StepOf<"deaths">) => step.context !== "dawn" && elderCostsPowers(game, step.deaths);

function deathLines(dict: Dictionary, game: GameState, step: StepOf<"deaths">) {
  const lines = [dict.game.steps.deaths[step.context]];
  const deaths = announcedDeaths(dict, game, step);
  if (deaths.length === 0) lines.push(nobodyDiedLine(dict, game));
  for (const death of deaths) {
    lines.push(death.line);
    const role = shownCard(game.players.find((p) => p.id === death.playerId)!);
    if (game.setup.settings.revealRoleOnDeath) lines.push(format(dict.auto.wasRole, { name: nameOf(game, death.playerId), role: dict.roles[role].name }));
  }
  if (announcesPowersLost(game, step)) lines.push(dict.game.steps.deaths.powersLost);
  return lines;
}

function deathSound(game: GameState, step: StepOf<"deaths">): Stinger | undefined {
  if (step.context === "dawn") return { kind: "dawn", theme: game.setup.settings.theme ?? "werewolves", count: step.deaths.length };
  return step.deaths.length ? { kind: "deaths", count: step.deaths.length } : undefined;
}

/** Who died, read out: phones keep the dead alive until it's done (see unannouncedDeadIds). */
export const deathsSteps: StepModules<"deaths"> = {
  deaths: {
    resolve: playOn,
    beats: (step, { dict, game }) => [{ say: deathLines(dict, game, step), sound: deathSound(game, step), wait: { kind: "hold", ms: 2_000 } }],
  },
};
