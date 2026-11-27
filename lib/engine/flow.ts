import { answerFor } from "./answer";
import { kill } from "./deaths";
import { getAlive, getPlayer, log, opensWithVote } from "./helpers";
import { callsOf, roles } from "./roles";
import { validateSetup } from "./setup";
import { getWinner } from "./win";
import { moduleOf } from "../steps";
import { voteStep } from "../steps/vote/steps";
import {
  EngineError,
  type Action,
  type Death,
  type GameSetup,
  type GameState,
  type Player,
  type Step,
} from "./types";

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
  moduleOf(done).resolve(state, done, answerFor(state, done, action));
  advance(state);
  const sleeper = moduleOf(done).sleeper?.(done, state.step) ?? null;
  // A borrowed power's turn is the Actor's: the Actor goes back to sleep, not the real holder.
  const player = "playerId" in done && done.kind !== "actor" ? state.players.find((p) => p.id === done.playerId) : undefined;
  state.backToSleep = sleeper && player?.role === "actor" ? "actor" : sleeper;
  return state;
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

    const sequence = callsOf(state.phase.kind);
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

// --- helpers ---

function thiefStillToWake(state: GameState) {
  if (state.phase.kind === "day" && state.phase.number === 0) return state.players.some((p) => p.role === "thief");
  if (state.phase.kind !== "night" || state.phase.number !== 1) return false;
  return callsOf("night").slice(state.cursor).some((e) => e.id === "thief");
}
