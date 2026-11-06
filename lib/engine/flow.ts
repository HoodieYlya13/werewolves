import { alive, getAlive, getPlayer, hasPower, holders, isWolf, livingNeighbours, log, opensWithVote } from "./helpers";
import { callsAnyway, nightSequence, roles, type SequenceEntry } from "./roles";
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

/** Closes every night and day: the game master moves on when the table is ready. */
const phaseEnd: SequenceEntry = {
  id: "phase-end",
  order: 1000,
  build: (state) => ({
    kind: "phase-end",
    next: state.phase.kind === "night" ? { kind: "day", number: state.phase.number } : { kind: "night", number: state.phase.number + 1 },
  }),
};

const nightTurns = [...nightSequence, phaseEnd];

const daySequence: SequenceEntry[] = [
  {
    id: "bear",
    order: 5,
    build: (state) => {
      if (state.phase.number === 0) return null;
      const tamer = holders(state, "bear-tamer")[0];
      // The bear keeps quiet rather than going missing, which would tell the village the tamer is gone.
      if (!tamer) return callsAnyway(state, "bear-tamer") ? { kind: "bear", playerId: null, growls: false } : null;
      const n = livingNeighbours(state, tamer);
      // An infected Bear Tamer's bear always growls.
      const growls = !!tamer.flags.infected || (!!n && (isWolf(n.left) || isWolf(n.right)));
      return { kind: "bear", playerId: tamer.id, growls };
    },
  },
  {
    id: "mayor-election",
    order: 10,
    build: (state) =>
      state.setup.settings.mayor && !state.mayorElected && state.phase.number > 0
        ? { kind: "mayor-election" }
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
  phaseEnd,
];

function voteStep(state: GameState, second: boolean, runoff: string[] | null = null): Step {
  const living = alive(state);
  const restricted = state.votersOnly?.day === state.phase.number ? state.votersOnly.ids : null;
  const cannotVote = living
    .filter((p) => p.flags["idiot-revealed"] || (restricted && !restricted.includes(p.id)))
    .map((p) => p.id);
  return {
    kind: "vote",
    mayorId: state.mayorId,
    ravenTargetId: state.ravenTargetId && getPlayer(state, state.ravenTargetId).alive ? state.ravenTargetId : null,
    cannotVote,
    scapegoatId: holders(state, "scapegoat")[0]?.id ?? null,
    second,
    runoff: runoff && runoff.filter((id) => getPlayer(state, id).alive),
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
  const angel = opensWithVote(setup);

  const state: GameState = {
    setup,
    players,
    phase: angel ? { kind: "day", number: 0 } : { kind: "night", number: 1 },
    cursor: 0,
    pending: [{ kind: "prologue" }],
    step: { kind: "prologue" }, // replaced by advance()
    backToSleep: null,
    phaseStep: -1,
    extraCards: [...setup.extraCards],
    actorCards: [...(setup.actorCards ?? [])],
    lovers: null,
    mayorId: null,
    mayorElected: false,
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
  if (action.type === "sudden-death") return suddenDeath(state, action.playerId);
  const done = state.step;
  resolve(state, state.step, action);
  advance(state);
  const sleeper = backToSleep(done, state.step);
  // A borrowed power's turn is the Actor's: the Actor goes back to sleep, not the real holder.
  const player = "playerId" in done && done.kind !== "actor" ? state.players.find((p) => p.id === done.playerId) : undefined;
  state.backToSleep = sleeper && player?.role === "actor" ? "actor" : sleeper;
  return state;
}

/**
 * Who closes their eyes once a night step is played. Steps followed by their
 * own closing line (the Seer's result, the lovers, the siblings…) need none.
 */
function backToSleep(done: Step, next: Step): GameState["backToSleep"] {
  switch (done.kind) {
    case "thief":
    case "actor":
    case "wolf-hound":
    case "wild-child":
    case "defender":
    case "big-bad-wolf":
    case "white-werewolf":
    case "witch":
    case "raven":
      return done.kind;
    case "piper":
      return "pied-piper";
    // Skipped: no result screen follows to put them back to sleep.
    case "seer":
    case "fox":
      return next.kind === `${done.kind}-result` ? null : done.kind;
    // The Wolf-Father answers while the pack is still awake.
    case "wolves":
      return next.kind === "infect" ? null : "wolves";
    case "infect":
      return "wolves";
    case "bluff":
      if (done.turn === "wolves") return "wolves";
      // These calls already end with everyone going back to sleep.
      if (["lovers", "charmed", "two-sisters", "three-brothers"].includes(done.turn)) return null;
      return done.role;
    default:
      return null;
  }
}

/**
 * Kills a player outside the rules, whatever the step: the death is announced
 * (with what it sets off: grief, the Hunter…), then the step that was on
 * comes back, updated, unless it was theirs to play.
 */
function suddenDeath(state: GameState, playerId: string): GameState {
  const victim = getAlive(state, playerId);
  const step = state.step;
  let resumed: Step | null = step;
  if (step.kind === "vote") resumed = voteStep(state, step.second, step.runoff);
  else if (step.kind === "wolves") resumed = { ...step, playerIds: step.playerIds.filter((id) => id !== victim.id) };
  if ("playerId" in step && step.playerId === victim.id && step.kind !== "mayor-succession") resumed = null;
  if (step.kind === "wolves" && resumed?.kind === "wolves" && resumed.playerIds.length === 0) resumed = null;
  const before = state.pending.length;
  kill(state, [{ playerId: victim.id, cause: "sudden" }], "sudden");
  // The vote's lists were made before the death: rebuilt now that it happened.
  if (resumed?.kind === "vote") resumed = voteStep(state, resumed.second, resumed.runoff);
  // Announced first (with its triggers), then the step that was on, then what was already queued.
  if (resumed && !getWinner(state)) state.pending.splice(state.pending.length - before, 0, resumed);
  advance(state);
  state.backToSleep = null;
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
    case "prologue":
      expect("continue");
      // The story was the prelude: the first night (or day) opens now.
      state.phaseStep = -1;
      return;

    case "phase-end":
    case "lovers":
    case "siblings":
    case "seer-result":
    case "fox-result":
    case "charmed":
    case "infected":
    case "deaths":
    case "bear":
    case "idiot":
    case "bluff":
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
      if (lovers === null) return;
      const [a, b] = lovers.map((id) => getAlive(state, id));
      if (a.id === b.id) throw new EngineError("invalid-target", "Pick two different players");
      state.lovers = [a.id, b.id];
      log(state, { type: "lovers", lovers: state.lovers });
      return;
    }

    case "wild-child": {
      // Nobody: the Wild Child didn't choose, and never turns.
      const [model] = picked(0, 1);
      if (!model) return;
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
      const { targetId } = expect("seer");
      if (targetId === null) return;
      const target = getAlive(state, targetId);
      if (target.id === step.playerId) throw new EngineError("invalid-target", "The Seer can't look at their own card");
      state.pending.unshift({ kind: "seer-result", playerId: step.playerId, targetId: target.id, role: target.role });
      log(state, { type: "seer", playerId: step.playerId, targetId: target.id, role: target.role });
      return;
    }

    case "fox": {
      // Nobody: the Fox didn't choose in time (no game master).
      const [center] = picked(0, 1);
      if (!center) return;
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
      const { targetId } = expect("wolves");
      if (targetId === null) return;
      const target = getAlive(state, targetId);
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
        if (target.id === step.victimId) throw new EngineError("invalid-target", "The wolves' victim is already dying");
        witch.uses.poison = (witch.uses.poison ?? 1) - 1;
        state.night.poisonedId = target.id;
        log(state, { type: "witch-poison", targetId: target.id });
      }
      return;
    }

    case "piper": {
      // Nobody: the Piper didn't choose in time (no game master).
      const targets = expect("pick").targetIds.length === 0 ? [] : picked(step.min, step.count);
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
      const { targetId } = expect("hunter");
      if (targetId === null) return;
      const target = getAlive(state, targetId);
      kill(state, [{ playerId: target.id, cause: "hunter" }], "hunter");
      return;
    }

    case "mayor-election":
    case "mayor-succession": {
      const target = getAlive(state, expect("mayor").targetId);
      const previousId = step.kind === "mayor-succession" ? step.playerId : null;
      state.mayorId = target.id;
      state.mayorElected = true;
      log(state, { type: "mayor", playerId: target.id, previousId });
      return;
    }

    case "vote": {
      const { targetId, tie, tiedIds } = expect("vote");
      state.votedToday = true;
      if (tie) {
        if (step.scapegoatId) {
          // The Scapegoat dies instead of the tied players: the Mayor has nothing to settle.
          log(state, { type: "vote", targetId: null });
          kill(state, [{ playerId: step.scapegoatId, cause: "scapegoat" }], "vote");
        } else if (state.mayorId) {
          state.pending.unshift({ kind: "tie-break", playerId: state.mayorId, tiedIds: (tiedIds ?? []).filter((id) => getPlayer(state, id).alive) });
        } else if (!step.runoff) {
          // A second vote, only against the tied players.
          state.pending.unshift(voteStep(state, step.second, tiedIds ?? []));
        } else {
          log(state, { type: "vote", targetId: null });
        }
        return;
      }
      if (targetId && step.runoff?.length && !step.runoff.includes(targetId)) {
        throw new EngineError("invalid-target", "Pick one of the tied players");
      }
      eliminate(state, targetId);
      return;
    }

    case "tie-break": {
      // Nobody: the Mayor didn't choose in time (no game master).
      const [target] = picked(0, 1);
      if (target && step.tiedIds.length > 0 && !step.tiedIds.includes(target.id)) {
        throw new EngineError("invalid-target", "Pick one of the tied players");
      }
      eliminate(state, target?.id ?? null);
      return;
    }

    case "servant": {
      // Left alone, the card is announced (the deaths step, next), then its own triggers.
      if (choice() !== true) {
        state.pending.splice(state.pending[0]?.kind === "deaths" ? 1 : 0, 0, ...step.roleTriggers);
        return;
      }
      // She takes the card unseen, with its powers as new (a Fox who missed, used potions…):
      // the dead player's own death power is hers now, and her own card is the one shown.
      const servant = getPlayer(state, step.playerId);
      const victim = getPlayer(state, step.victimId);
      const role = victim.role;
      servant.role = role;
      servant.uses = { ...roles[role].uses };
      victim.memo.card = "devoted-servant";
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

/** The village's vote lands on `targetId` (null: nobody goes). */
function eliminate(state: GameState, targetId: string | null) {
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
}

// --- flow ---

/** Picks the next step: queued triggers first, then the phase's sequence. */
function advance(state: GameState) {
  for (;;) {
    const next = state.pending.shift();
    // A successor only matters if the game goes on.
    if (next?.kind === "mayor-succession" && !thiefStillToWake(state) && getWinner(state)) continue;
    if (next) {
      state.step = next;
      state.phaseStep += 1;
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

    const sequence = state.phase.kind === "night" ? nightTurns : daySequence;
    while (state.cursor < sequence.length) {
      const entry = sequence[state.cursor++];
      if (entry.firstNightOnly && state.phase.number !== 1) continue;
      if (entry.evenNightsOnly && state.phase.number % 2 !== 0) continue;
      const step = entry.build(state);
      if (step) {
        state.step = step;
        state.phaseStep += 1;
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
  state.phaseStep = -1;
}

function endDay(state: GameState) {
  if (state.votersOnly && state.votersOnly.day <= state.phase.number) state.votersOnly = null;
  state.phase = { kind: "night", number: state.phase.number + 1 };
  state.cursor = 0;
  state.phaseStep = -1;
  state.night = emptyNight();
  state.ravenTargetId = null;
  state.votedToday = false;
}

/**
 * Kills players, follows lovers into grief, turns Wild Children whose model
 * died, then queues the announcement and death triggers at the front.
 */
function kill(state: GameState, victims: Death[], context: "dawn" | "vote" | "hunter" | "sudden") {
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

// --- helpers ---

function thiefStillToWake(state: GameState) {
  if (state.phase.kind === "day" && state.phase.number === 0) return state.players.some((p) => p.role === "thief");
  if (state.phase.kind !== "night" || state.phase.number !== 1) return false;
  return nightTurns.slice(state.cursor).some((e) => e.id === "thief");
}
