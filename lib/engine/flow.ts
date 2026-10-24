import { alive, getAlive, getPlayer, hasPower, holders, isWolf, livingNeighbours, log } from "./helpers";
import { nightSequence, roles, type SequenceEntry } from "./roles";
import { validateSetup } from "./setup";
import { getWinner } from "./win";
import {
  EngineError,
  type Action,
  type Death,
  type GameSetup,
  type GameState,
  type Player,
  type Step,
} from "./types";

const daySequence: SequenceEntry[] = [
  {
    id: "bear",
    order: 5,
    build: (state) => {
      const tamer = holders(state, "bear-tamer")[0];
      if (!tamer || state.phase.number === 0) return null;
      const n = livingNeighbours(state, tamer);
      // An infected Bear Tamer's bear always growls.
      const growls = !!tamer.flags.infected || (!!n && (isWolf(n.left) || isWolf(n.right)));
      return { kind: "bear", playerId: tamer.id, growls };
    },
  },
  {
    id: "sheriff-election",
    order: 10,
    build: (state) =>
      state.setup.settings.sheriff && !state.sheriffElected && state.phase.number > 0
        ? { kind: "sheriff-election" }
        : null,
  },
  { id: "vote", order: 20, build: (state) => voteStep(state, false) },
  {
    id: "judge",
    order: 30,
    build: (state) => {
      const judge = holders(state, "stuttering-judge")[0];
      return judge && (judge.uses["second-vote"] ?? 0) > 0 ? { kind: "judge", playerId: judge.id } : null;
    },
  },
];

function voteStep(state: GameState, second: boolean): Step {
  const living = alive(state);
  const restricted = state.votersOnly?.day === state.phase.number ? state.votersOnly.ids : null;
  const cannotVote = living
    .filter((p) => p.flags["idiot-revealed"] || (restricted && !restricted.includes(p.id)))
    .map((p) => p.id);
  return {
    kind: "vote",
    sheriffId: state.sheriffId,
    ravenTargetId: state.ravenTargetId && getPlayer(state, state.ravenTargetId).alive ? state.ravenTargetId : null,
    cannotVote,
    scapegoatId: holders(state, "scapegoat")[0]?.id ?? null,
    second,
  };
}

const emptyNight = (): GameState["night"] => ({
  wolvesTargetId: null,
  healed: false,
  poisonedId: null,
  protectedId: null,
  infected: false,
  bigBadWolfTargetId: null,
  whiteWerewolfTargetId: null,
  actorRole: null,
});

export function createGame(setup: GameSetup): GameState {
  validateSetup(setup);
  const players: Player[] = [...setup.players]
    .sort((a, b) => a.seat - b.seat)
    .map((p) => {
      const role = setup.roles[p.id];
      return { ...p, role, alive: true, death: null, uses: { ...roles[role].uses }, flags: {}, memo: {} };
    });

  // With the Angel in play, the game may open with a vote before night 1.
  const angel = players.some((p) => p.role === "angel") && setup.settings.angelRule !== "first-vote";

  const state: GameState = {
    setup,
    players,
    phase: angel ? { kind: "day", number: 0 } : { kind: "night", number: 1 },
    cursor: 0,
    pending: [],
    step: { kind: "sheriff-election" }, // replaced by advance()
    extraCards: [...setup.extraCards],
    actorCards: [...(setup.actorCards ?? [])],
    lovers: null,
    sheriffId: null,
    sheriffElected: false,
    villagePowersLost: false,
    wolfDied: false,
    rustTargetId: null,
    votersOnly: null,
    night: emptyNight(),
    ravenTargetId: null,
    votedToday: false,
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
  /** Living players picked on a "pick" step, between min and max of them. */
  const picked = (min: number, max: number) => {
    const ids = [...new Set(expect("pick").targetIds)];
    if (ids.length < min || ids.length > max) {
      throw new EngineError("invalid-action", `Pick between ${min} and ${max} players`);
    }
    return ids.map((id) => getAlive(state, id));
  };
  const choice = () => expect("choose").value;

  switch (step.kind) {
    case "lovers":
    case "siblings":
    case "seer-result":
    case "fox-result":
    case "charmed":
    case "deaths":
    case "bear":
    case "idiot":
      expect("continue");
      return;

    case "actor": {
      const pick = choice();
      if (pick === null) return;
      const role = typeof pick === "number" ? state.actorCards[pick] : undefined;
      if (!role) throw new EngineError("invalid-action", "No such card");
      const actor = getPlayer(state, step.playerId);
      state.actorCards.splice(pick as number, 1);
      state.night.actorRole = role;
      actor.uses = { ...actor.uses, ...roles[role].uses };
      log(state, { type: "actor", playerId: actor.id, role });
      return;
    }

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

    case "wolf-hound": {
      const side = choice();
      if (side !== "village" && side !== "wolves") throw new EngineError("invalid-action", "Choose a side");
      if (side === "wolves") getPlayer(state, step.playerId).flags["turned-wolf"] = true;
      log(state, { type: "wolf-hound", playerId: step.playerId, side });
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

    case "wild-child": {
      const [model] = picked(1, 1);
      if (model.id === step.playerId) throw new EngineError("invalid-target", "Pick someone else");
      getPlayer(state, step.playerId).memo.model = model.id;
      log(state, { type: "model", playerId: step.playerId, modelId: model.id });
      return;
    }

    case "defender": {
      const defender = getPlayer(state, step.playerId);
      const [target] = picked(0, 1);
      if (target && target.id === step.lastProtectedId) {
        throw new EngineError("invalid-target", "Can't protect the same player two nights in a row");
      }
      state.night.protectedId = target?.id ?? null;
      if (target) {
        defender.memo["last-protected"] = target.id;
        log(state, { type: "protected", targetId: target.id });
      } else {
        delete defender.memo["last-protected"];
      }
      return;
    }

    case "seer": {
      const target = getAlive(state, expect("seer").targetId);
      if (target.id === step.playerId) throw new EngineError("invalid-target", "The Seer can't look at their own card");
      state.pending.unshift({ kind: "seer-result", playerId: step.playerId, targetId: target.id, role: target.role });
      log(state, { type: "seer", playerId: step.playerId, targetId: target.id, role: target.role });
      return;
    }

    case "fox": {
      const [center] = picked(1, 1);
      const n = livingNeighbours(state, center);
      const group = [...new Map([n?.right, center, n?.left].filter(Boolean).map((p) => [p!.id, p!])).values()];
      const hasWolf = group.some(isWolf);
      const fox = getPlayer(state, step.playerId);
      if (!hasWolf && fox.role === "fox") fox.flags["fox-powerless"] = true;
      state.pending.unshift({ kind: "fox-result", playerId: fox.id, playerIds: group.map((p) => p.id), hasWolf });
      log(state, { type: "fox", playerId: fox.id, centerId: center.id, hasWolf });
      return;
    }

    case "wolves": {
      const target = getAlive(state, expect("wolves").targetId);
      if (isWolf(target)) throw new EngineError("invalid-target", "Wolves can't eat a wolf");
      state.night.wolvesTargetId = target.id;
      log(state, { type: "wolves-target", targetId: target.id });
      return;
    }

    case "infect": {
      if (choice() !== true) return;
      const father = getPlayer(state, step.playerId);
      father.uses.infect = (father.uses.infect ?? 1) - 1;
      getAlive(state, step.victimId).flags.infected = true;
      state.night.infected = true;
      log(state, { type: "infected", targetId: step.victimId });
      return;
    }

    case "big-bad-wolf": {
      const [target] = picked(0, 1);
      if (!target) return;
      if (isWolf(target)) throw new EngineError("invalid-target", "Wolves can't eat a wolf");
      if (target.id === state.night.wolvesTargetId) throw new EngineError("invalid-target", "Already the wolves' victim");
      state.night.bigBadWolfTargetId = target.id;
      log(state, { type: "big-bad-wolf", targetId: target.id });
      return;
    }

    case "white-werewolf": {
      const [target] = picked(0, 1);
      if (!target) return;
      if (!isWolf(target) || target.id === step.playerId) {
        throw new EngineError("invalid-target", "The White Werewolf can only kill another wolf");
      }
      state.night.whiteWerewolfTargetId = target.id;
      log(state, { type: "white-werewolf", targetId: target.id });
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

    case "piper": {
      const targets = picked(step.min, step.count);
      if (targets.some((t) => t.id === step.playerId || t.flags.charmed)) {
        throw new EngineError("invalid-target", "Pick players who aren't charmed yet");
      }
      targets.forEach((t) => (t.flags.charmed = true));
      log(state, { type: "charmed", targetIds: targets.map((t) => t.id) });
      return;
    }

    case "raven": {
      const [target] = picked(0, 1);
      if (!target) return;
      state.ravenTargetId = target.id;
      log(state, { type: "raven", targetId: target.id });
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
      const { targetId, tie } = expect("vote");
      state.votedToday = true;
      if (tie) {
        log(state, { type: "vote", targetId: null });
        if (step.scapegoatId) kill(state, [{ playerId: step.scapegoatId, cause: "scapegoat" }], "vote");
        return;
      }
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
      return;
    }

    case "servant": {
      if (choice() !== true) {
        state.pending.unshift(...step.roleTriggers);
        return;
      }
      // She takes the card: the dead player's own death power is hers now, not theirs.
      const servant = getPlayer(state, step.playerId);
      const role = getPlayer(state, step.victimId).role;
      servant.role = role;
      servant.uses = { ...roles[role].uses };
      log(state, { type: "servant", playerId: servant.id, role });
      return;
    }

    case "scapegoat": {
      const voters = picked(0, alive(state).length);
      state.votersOnly = { day: state.phase.number + 1, ids: voters.map((p) => p.id) };
      log(state, { type: "scapegoat", voterIds: state.votersOnly.ids });
      return;
    }

    case "judge": {
      if (choice() !== true) return;
      const judge = getPlayer(state, step.playerId);
      judge.uses["second-vote"] = 0;
      state.pending.unshift(voteStep(state, true));
      log(state, { type: "second-vote" });
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
      if (entry.evenNightsOnly && state.phase.number % 2 !== 0) continue;
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
  const { wolvesTargetId, healed, infected, poisonedId, protectedId, bigBadWolfTargetId, whiteWerewolfTargetId } =
    state.night;
  const victims: Death[] = [];
  const add = (playerId: string | null, cause: Death["cause"]) => {
    if (playerId && !victims.some((v) => v.playerId === playerId)) victims.push({ playerId, cause });
  };

  // Wolf attacks: the Defender's protection and the Elder's extra life stop them.
  const attacks: [string | null, Death["cause"]][] = [
    [healed || infected ? null : wolvesTargetId, "wolves"],
    [bigBadWolfTargetId, "wolves"],
    [whiteWerewolfTargetId, "white-werewolf"],
  ];
  for (const [targetId, cause] of attacks) {
    if (!targetId || targetId === protectedId) continue;
    const target = getPlayer(state, targetId);
    if (target.role === "elder" && (target.uses.lives ?? 0) > 0) {
      target.uses.lives! -= 1;
      log(state, { type: "elder-survived", playerId: target.id });
      continue;
    }
    add(targetId, cause);
  }
  add(poisonedId, "poison");
  if (state.rustTargetId && getPlayer(state, state.rustTargetId).alive) add(state.rustTargetId, "rust");
  state.rustTargetId = null;

  // A borrowed power only lasts one night.
  if (state.night.actorRole) {
    const actor = state.players.find((p) => p.role === "actor");
    if (actor) actor.uses = {};
  }

  // Deaths belong to the night they happened in; the announcement opens the day.
  kill(state, victims, "dawn");
  state.phase = { kind: "day", number: state.phase.number };
  state.cursor = 0;
}

function endDay(state: GameState) {
  if (state.votersOnly && state.votersOnly.day <= state.phase.number) state.votersOnly = null;
  state.phase = { kind: "night", number: state.phase.number + 1 };
  state.cursor = 0;
  state.night = emptyNight();
  state.ravenTargetId = null;
  state.votedToday = false;
}

/**
 * Kills players, follows lovers into grief, turns Wild Children whose model
 * died, then queues the announcement and death triggers at the front.
 */
function kill(state: GameState, victims: Death[], context: "dawn" | "vote" | "hunter") {
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

  // The Devoted Servant may take the voted-out player's card before it acts.
  const voted = context === "vote" ? deaths.find((d) => d.cause === "vote") : undefined;
  const servant = voted && holders(state, "devoted-servant").find((p) => p.id !== voted.playerId);

  const roleTriggers = new Map<string, Step[]>();
  const sheriffTriggers: Step[] = [];
  for (const { playerId, cause } of deaths) {
    const player = getPlayer(state, playerId);
    roleTriggers.set(playerId, roles[player.role].onDeath?.(state, player, cause) ?? []);
    if (state.sheriffId === player.id) {
      state.sheriffId = null;
      if (alive(state).length > 0) sheriffTriggers.push({ kind: "sheriff-succession", playerId: player.id });
    }
  }

  const queued: Step[] = [];
  if (deaths.length > 0 || context === "dawn") queued.push({ kind: "deaths", context, deaths });
  for (const { playerId } of deaths) {
    if (servant && voted && playerId === voted.playerId) {
      queued.push({ kind: "servant", playerId: servant.id, victimId: playerId, roleTriggers: roleTriggers.get(playerId)! });
    } else {
      queued.push(...roleTriggers.get(playerId)!);
    }
  }
  queued.push(...sheriffTriggers);
  state.pending.unshift(...queued);
}

// --- helpers ---

function thiefStillToWake(state: GameState) {
  if (state.phase.kind === "day" && state.phase.number === 0) return state.players.some((p) => p.role === "thief");
  if (state.phase.kind !== "night" || state.phase.number !== 1) return false;
  return nightSequence.slice(state.cursor).some((e) => e.id === "thief");
}
