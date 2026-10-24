import { alive, nightSequence, roles, type SequenceEntry } from "./roles";
import { validateSetup } from "./setup";
import { getWinner } from "./win";
import {
  EngineError,
  type Action,
  type Death,
  type GameEvent,
  type GameSetup,
  type GameState,
  type Player,
  type Step,
} from "./types";

const daySequence: SequenceEntry[] = [
  {
    id: "sheriff-election",
    order: 10,
    build: (state) =>
      state.setup.settings.sheriff && !state.sheriffElected ? { kind: "sheriff-election" } : null,
  },
  { id: "vote", order: 20, build: (state) => ({ kind: "vote", sheriffId: state.sheriffId }) },
];

const emptyNight = (): GameState["night"] => ({ wolvesTargetId: null, healed: false, poisonedId: null });

export function createGame(setup: GameSetup): GameState {
  validateSetup(setup);
  const players: Player[] = [...setup.players]
    .sort((a, b) => a.seat - b.seat)
    .map((p) => {
      const role = setup.roles[p.id];
      return { ...p, role, alive: true, death: null, uses: { ...roles[role].uses } };
    });

  const state: GameState = {
    setup,
    players,
    phase: { kind: "night", number: 1 },
    cursor: 0,
    pending: [],
    step: { kind: "vote", sheriffId: null }, // replaced by advance()
    extraCards: [...setup.extraCards],
    lovers: null,
    sheriffId: null,
    sheriffElected: false,
    night: emptyNight(),
    winner: null,
    events: [],
  };
  advance(state);
  return state;
}

/** Applies one game-master action and moves to the next step. Never mutates `prev`. */
export function applyAction(prev: GameState, action: Action): GameState {
  if (prev.step.kind === "game-over") throw new EngineError("game-over", "The game is over");
  const state = structuredClone(prev);
  resolve(state, state.step, action);
  advance(state);
  return state;
}

/** Rebuilds the state from scratch. Undo = replay without the last action. */
export function replay(setup: GameSetup, log: Action[]): GameState {
  return log.reduce(applyAction, createGame(setup));
}

// --- step resolution ---

function resolve(state: GameState, step: Step, action: Action) {
  const expect = <T extends Action["type"]>(type: T) => {
    if (action.type !== type) {
      throw new EngineError("wrong-step", `Step "${step.kind}" expects "${type}", got "${action.type}"`);
    }
    return action as Extract<Action, { type: T }>;
  };

  switch (step.kind) {
    case "lovers":
    case "seer-result":
    case "deaths":
      expect("continue");
      return;

    case "thief": {
      const { pick } = expect("thief");
      if (pick === null) {
        if (step.mustTakeWolf) throw new EngineError("invalid-action", "The Thief must take a Werewolf");
        return;
      }
      const card = state.extraCards[pick];
      if (card === undefined) throw new EngineError("invalid-action", "No such card");
      const thief = getPlayer(state, step.playerId);
      state.extraCards[pick] = thief.role;
      log(state, { type: "thief-swap", playerId: thief.id, from: thief.role, to: card });
      thief.role = card;
      thief.uses = { ...roles[card].uses };
      return;
    }

    case "cupid": {
      const { lovers } = expect("cupid");
      const [a, b] = lovers.map((id) => getAlive(state, id));
      if (a.id === b.id) throw new EngineError("invalid-target", "Pick two different players");
      state.lovers = [a.id, b.id];
      log(state, { type: "lovers", lovers: state.lovers });
      return;
    }

    case "seer": {
      const target = getAlive(state, expect("seer").targetId);
      if (target.id === step.playerId) throw new EngineError("invalid-target", "The Seer can't look at herself");
      state.pending.unshift({ kind: "seer-result", playerId: step.playerId, targetId: target.id, role: target.role });
      log(state, { type: "seer", playerId: step.playerId, targetId: target.id, role: target.role });
      return;
    }

    case "wolves": {
      const target = getAlive(state, expect("wolves").targetId);
      if (target.role === "werewolf") throw new EngineError("invalid-target", "Wolves can't eat a wolf");
      state.night.wolvesTargetId = target.id;
      log(state, { type: "wolves-target", targetId: target.id });
      return;
    }

    case "witch": {
      const { heal, poisonId } = expect("witch");
      const witch = getPlayer(state, step.playerId);
      if (heal) {
        if (!step.canHeal || !step.victimId) throw new EngineError("invalid-action", "The Witch can't heal now");
        witch.uses.heal = (witch.uses.heal ?? 1) - 1;
        state.night.healed = true;
        log(state, { type: "witch-heal", targetId: step.victimId });
      }
      if (poisonId !== null) {
        if (!step.canPoison) throw new EngineError("invalid-action", "The Witch has no poison left");
        const target = getAlive(state, poisonId);
        witch.uses.poison = (witch.uses.poison ?? 1) - 1;
        state.night.poisonedId = target.id;
        log(state, { type: "witch-poison", targetId: target.id });
      }
      return;
    }

    case "hunter": {
      const target = getAlive(state, expect("hunter").targetId);
      kill(state, [{ playerId: target.id, cause: "hunter" }], "hunter");
      return;
    }

    case "sheriff-election":
    case "sheriff-succession": {
      const target = getAlive(state, expect("sheriff").targetId);
      const previousId = step.kind === "sheriff-succession" ? step.playerId : null;
      state.sheriffId = target.id;
      state.sheriffElected = true;
      log(state, { type: "sheriff", playerId: target.id, previousId });
      return;
    }

    case "vote": {
      const { targetId } = expect("vote");
      log(state, { type: "vote", targetId });
      if (targetId !== null) kill(state, [{ playerId: getAlive(state, targetId).id, cause: "vote" }], "vote");
      return;
    }

    case "game-over":
      throw new EngineError("game-over", "The game is over");
  }
}

// --- flow ---

/** Picks the next step: queued triggers first, then the phase's sequence. */
function advance(state: GameState) {
  for (;;) {
    const next = state.pending.shift();
    if (next) {
      state.step = next;
      return;
    }

    // Teams aren't final until the Thief has picked: a lone wolf left among his
    // cards must not hand the village a win before he wakes up.
    if (!thiefStillToWake(state)) {
      const winner = getWinner(state);
      if (winner) {
        state.winner = winner;
        state.step = { kind: "game-over", winner };
        return;
      }
    }

    const sequence = state.phase.kind === "night" ? nightSequence : daySequence;
    while (state.cursor < sequence.length) {
      const entry = sequence[state.cursor++];
      if (entry.firstNightOnly && state.phase.number !== 1) continue;
      const step = entry.build(state);
      if (step) {
        state.step = step;
        return;
      }
    }

    if (state.phase.kind === "night") endNight(state);
    else endDay(state);
  }
}

function endNight(state: GameState) {
  const { wolvesTargetId, healed, poisonedId } = state.night;
  const victims: Death[] = [];
  if (wolvesTargetId && !healed) victims.push({ playerId: wolvesTargetId, cause: "wolves" });
  if (poisonedId && !victims.some((v) => v.playerId === poisonedId)) {
    victims.push({ playerId: poisonedId, cause: "poison" });
  }
  // Deaths belong to the night they happened in; the announcement opens the day.
  kill(state, victims, "dawn");
  state.phase = { kind: "day", number: state.phase.number };
  state.cursor = 0;
}

function endDay(state: GameState) {
  state.phase = { kind: "night", number: state.phase.number + 1 };
  state.cursor = 0;
  state.night = emptyNight();
}

/**
 * Kills players, follows lovers into grief, then queues the announcement and
 * any death triggers (Hunter, Sheriff succession) at the front of the queue.
 */
function kill(state: GameState, victims: Death[], context: "dawn" | "vote" | "hunter") {
  const deaths: Death[] = [];
  const queue = [...victims];
  for (let death = queue.shift(); death; death = queue.shift()) {
    const player = getPlayer(state, death.playerId);
    if (!player.alive) continue;
    player.alive = false;
    player.death = { ...death, phase: { ...state.phase } };
    deaths.push(death);
    log(state, { type: "death", playerId: player.id, cause: death.cause });

    const partnerId = state.lovers?.find((id) => id !== player.id);
    if (state.lovers?.includes(player.id) && partnerId) queue.push({ playerId: partnerId, cause: "grief" });
  }

  const triggers: Step[] = [];
  for (const { playerId } of deaths) {
    const player = getPlayer(state, playerId);
    triggers.push(...(roles[player.role].onDeath?.(state, player) ?? []));
    if (state.sheriffId === player.id) {
      state.sheriffId = null;
      if (alive(state).length > 0) triggers.push({ kind: "sheriff-succession", playerId: player.id });
    }
  }

  if (deaths.length > 0 || context === "dawn") state.pending.unshift({ kind: "deaths", context, deaths }, ...triggers);
}

// --- helpers ---

function thiefStillToWake(state: GameState) {
  if (state.phase.kind !== "night" || state.phase.number !== 1) return false;
  return nightSequence.slice(state.cursor).some((e) => e.id === "thief");
}

function getPlayer(state: GameState, id: string) {
  const player = state.players.find((p) => p.id === id);
  if (!player) throw new EngineError("invalid-target", `Unknown player ${id}`);
  return player;
}

function getAlive(state: GameState, id: string) {
  const player = getPlayer(state, id);
  if (!player.alive) throw new EngineError("invalid-target", `${player.name} is dead`);
  return player;
}

function log(state: GameState, event: GameEvent) {
  state.events.push({ ...event, phase: { ...state.phase } });
}
