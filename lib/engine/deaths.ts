import { alive, getPlayer, holders, isWolf, log } from "./helpers";
import { roles } from "./roles";
import { getWinner } from "./win";
import type { Death, GameState, Step } from "./types";

export type DeathContext = Extract<Step, { kind: "deaths" }>["context"];

/**
 * Kills players, follows lovers into grief, turns Wild Children whose model
 * died, then queues the announcement and death triggers at the front.
 */
export function kill(state: GameState, victims: Death[], context: DeathContext) {
  const deaths: Death[] = [];
  const queue = [...victims];
  for (let death = queue.shift(); death; death = queue.shift()) {
    const player = getPlayer(state, death.playerId);
    if (!player.alive) continue;
    if (isWolf(player)) state.wolfDied = true;
    player.alive = false;
    player.death = { ...death, phase: { ...state.phase } };
    deaths.push(death);
    log(state, { type: "death", playerId: player.id, cause: death.cause });

    const partnerId = state.lovers?.find((id) => id !== player.id);
    if (state.lovers?.includes(player.id) && partnerId) queue.push({ playerId: partnerId, cause: "grief" });
  }

  const deadIds = new Set(deaths.map((d) => d.playerId));
  for (const child of alive(state).filter((p) => p.role === "wild-child" && !p.flags["turned-wolf"])) {
    if (child.memo.model && deadIds.has(child.memo.model)) {
      child.flags["turned-wolf"] = true;
      log(state, { type: "turned-wolf", playerId: child.id });
    }
  }

  // The Devoted Servant may take the voted-out player's card before it's shown, and before it acts.
  // Not an Angel's who wins by this vote: the game ends there.
  const voted = context === "vote" ? deaths.find((d) => d.cause === "vote") : undefined;
  const servant =
    voted && getWinner(state)?.team !== "angel" ? holders(state, "devoted-servant").find((p) => p.id !== voted.playerId) : undefined;

  const roleTriggers = new Map<string, Step[]>();
  const mayorTriggers: Step[] = [];
  for (const { playerId, cause } of deaths) {
    const player = getPlayer(state, playerId);
    roleTriggers.set(playerId, roles[player.role].onDeath?.(state, player, cause) ?? []);
    if (state.mayorId === player.id) {
      state.mayorId = null;
      if (alive(state).length > 0) mayorTriggers.push({ kind: "mayor-succession", playerId: player.id });
    }
  }

  const queued: Step[] = [];
  // Her choice comes first; the card's own triggers follow the announcement only if she leaves it.
  if (servant && voted) queued.push({ kind: "servant", playerId: servant.id, victimId: voted.playerId, roleTriggers: roleTriggers.get(voted.playerId)! });
  if (deaths.length > 0 || context === "dawn") queued.push({ kind: "deaths", context, deaths });
  for (const { playerId } of deaths) {
    if (!(servant && voted && playerId === voted.playerId)) queued.push(...roleTriggers.get(playerId)!);
  }
  queued.push(...mayorTriggers);
  state.pending.unshift(...queued);
}
