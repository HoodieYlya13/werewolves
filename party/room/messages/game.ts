import { applyAction, ENGINE_VERSION, replay } from "../../../lib/engine";
import * as auto from "../../../lib/auto";
import { WITCH_ASKS } from "../../../lib/auto";
import { MAX_TIMER_SECONDS, secureRandom } from "../state";
import type { RoomState } from "../state";
import { refuse, type MessageHandlerGroup, type Outcome } from "./handler";
import { rememberFormerPlayer, dropSeat, seatOf } from "../seats";
import { mayorRaceOpen } from "../auto-runner";
import { buildSetup, sendEngineError } from "../game";

/** A vote on the open ballot, for a seat that may vote. */
function castVote(state: RoomState, voterId: string, targetId: string | null): Outcome {
  const ballot = state.ballot;
  if (!ballot?.voterIds.includes(voterId)) return "unchanged";
  // A Mayor is always elected: "no one" is only for the day's vote.
  if (targetId === null ? ballot.kind === "mayor" : !ballot.candidateIds.includes(targetId)) return "unchanged";
  ballot.votes[voterId] = targetId;
  return "changed";
}

export const gameMessages = {
  "start-game": async ({ room, sender, isHost, state }, msg) => {
    if (!isHost) return refuse(room, sender, "not-host");
    try {
      const config = state.mode === "auto" ? auto.cleanAutoConfig(msg.auto) : undefined;
      const setup = buildSetup(room, msg, config);
      room.game = replay(setup, []);
      state.game = { setup, log: [], id: crypto.randomUUID(), startedAt: Date.now(), engine: ENGINE_VERSION, auto: config };
      state.endedGame = null;
      state.handover = null;
      state.leadReadAt = null;
      state.masterStage = null;
      state.phonePlays = null;
      state.locked = true;
      state.candidates = [];
      state.auto = config ? auto.startAuto(config, { random: secureRandom, now: Date.now() }) : null;
      state.game.organiser = state.hostSub ?? null;
      state.spectators = [];
      state.paused = null;
      state.leaderLostAt = null;
      state.lostLeader = null;
      state.formerHosts = {};
      state.masterLostAt = null;
      state.masterGone = false;
      state.masterSeatId = null;
      state.phonePlays = null;
    } catch (e) {
      sendEngineError(room, sender, e, "invalid-setup");
      return "unchanged";
    }
    return "changed";
  },
  "game-action": async ({ room, sender, isHost, state }, msg) => {
    if (!isHost) return refuse(room, sender, "not-host");
    if (!state.game || !room.game) return "unchanged";
    try {
      room.game = applyAction(room.game, msg.action);
      state.game.log.push(msg.action);
    } catch (e) {
      sendEngineError(room, sender, e, "invalid-action");
      return "unchanged";
    }
    return "changed";
  },
  "master-stage": async ({ room, isHost, state }, msg) => {
    if (!isHost || !room.game || room.game.step.kind !== "witch" || !WITCH_ASKS.includes(msg.stage)) return "unchanged";
    const at = state.game!.log.length;
    state.masterStage = { at, stage: msg.stage };
    // Started over (Undo): her phone answers again too.
    const plays = state.phonePlays;
    if (msg.stage === "show" && plays?.at === at) {
      delete plays.actions[room.game.step.playerId];
      delete plays.asked?.[room.game.step.playerId];
    }
    return "changed";
  },
  "lead-read": async ({ isHost, state }, msg) => {
    if (!isHost || !state.game || msg.at !== state.game.log.length || state.leadReadAt === msg.at) return "unchanged";
    state.leadReadAt = msg.at;
    return "changed";
  },
  undo: async ({ room, sender, isHost, state }) => {
    if (!isHost) return refuse(room, sender, "not-host");
    if (!state.game || state.game.log.length === 0) return "unchanged";
    state.game.log.pop();
    room.game = replay(state.game.setup, state.game.log);
    // Kept by log length, which comes back after an Undo: the turn played again starts clean,
    // or a phone would light up during the next "go back to sleep" (or show a stale answer).
    state.leadReadAt = null;
    state.masterStage = null;
    state.phonePlays = null;
    return "changed";
  },
  "end-game": async ({ room, sender, isHost, state }) => {
    if (!isHost) return refuse(room, sender, "not-host");
    state.endedGame = state.game;
    state.game = null;
    state.handover = null;
    state.awayMaster = null;
    state.auto = null;
    state.paused = null;
    state.spectators = [];
    // A dead player who took the game over runs the autoGame now: they don't play the next one.
    if (state.masterSeatId) {
      await dropSeat(room, state.masterSeatId);
      state.masterSeatId = null;
      state.endedGame = null;
    }
    // Players who left mid-game were only kept for the game master to play: they don't play the next one.
    const leavers = state.players.filter((p) => p.left);
    if (leavers.length) {
      leavers.forEach((player) => rememberFormerPlayer(room, player));
      state.endedGame = null;
    }
    state.ballot = null;
    state.timer = null;
    room.game = null;
    return "changed";
  },
  "resume-game": async ({ room, sender, isHost, state }) => {
    if (!isHost) return refuse(room, sender, "not-host");
    if (!state.endedGame) return "unchanged";
    state.game = state.endedGame;
    state.endedGame = null;
    room.game = replay(state.game.setup, state.game.log);
    // Picked up again at the start of the step it stopped on.
    const config = state.game.auto;
    state.auto = config ? auto.startAuto(config, { random: secureRandom, now: Date.now() }) : null;
    return "changed";
  },
  stand: async ({ room, sender, state }, msg) => {
    const id = seatOf(room, sender);
    const game = room.game;
    if (!id || !mayorRaceOpen(room) || !game?.players.find((p) => p.id === id)?.alive) return "unchanged";
    const others = (state.candidates ?? []).filter((c) => c !== id);
    state.candidates = msg.value ? [...others, id] : others;
    return "changed";
  },
  "open-ballot": async ({ room, sender, isHost, state }, msg) => {
    if (!isHost) return refuse(room, sender, "not-host");
    const step = room.game?.step;
    if (!room.game) return "unchanged";
    const living = room.game.players.filter((p) => p.alive).map((p) => p.id);
    if (step?.kind === "mayor-election") {
      const wanted = msg.candidateIds ?? [];
      const candidateIds = living.filter((id) => wanted.includes(id));
      if (candidateIds.length === 0) return "unchanged";
      state.ballot = { kind: "mayor", voterIds: living, candidateIds, votes: {} };
      return "changed";
    }
    if (step?.kind !== "vote") return "unchanged";
    state.ballot = {
      kind: "vote",
      voterIds: living.filter((id) => !step.cannotVote.includes(id)),
      candidateIds: step.runoff?.length ? step.runoff : living,
      votes: {},
    };
    return "changed";
  },
  "close-ballot": async ({ room, sender, isHost, state }) => {
    if (!isHost) return refuse(room, sender, "not-host");
    state.ballot = null;
    return "changed";
  },
  "set-timer": async ({ room, sender, isHost, state }, msg) => {
    if (!isHost) return refuse(room, sender, "not-host");
    if (msg.seconds === null) {
      state.timer = null;
      return "changed";
    }
    const seconds = Math.round(msg.seconds);
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > MAX_TIMER_SECONDS) return "unchanged";
    state.timer = { endsAt: Date.now() + seconds * 1000, remainingMs: seconds * 1000, durationMs: seconds * 1000 };
    return "changed";
  },
  "pause-timer": async ({ room, sender, isHost, state }) => {
    if (!isHost) return refuse(room, sender, "not-host");
    const timer = state.timer;
    if (!timer || timer.endsAt === null) return "unchanged";
    state.timer = { ...timer, endsAt: null, remainingMs: Math.max(0, timer.endsAt - Date.now()) };
    return "changed";
  },
  "resume-timer": async ({ room, sender, isHost, state }) => {
    if (!isHost) return refuse(room, sender, "not-host");
    const timer = state.timer;
    if (!timer || timer.endsAt !== null) return "unchanged";
    state.timer = { ...timer, endsAt: Date.now() + timer.remainingMs };
    return "changed";
  },
  /** A phone's own vote. */
  "cast-vote": async ({ room, sender, state }, msg) => {
    const seat = seatOf(room, sender);
    return seat ? castVote(state, seat, msg.targetId) : "unchanged";
  },
  /** The game master sets (or clears) a seat's vote. */
  "set-vote": async ({ room, sender, isHost, state }, msg) => {
    const ballot = state.ballot;
    if (!ballot) return "unchanged";
    if (!isHost) return refuse(room, sender, "not-host");
    if (!ballot.voterIds.includes(msg.voterId)) return "unchanged";
    if (!msg.clear) return castVote(state, msg.voterId, msg.targetId);
    delete ballot.votes[msg.voterId];
    return "changed";
  },
} satisfies MessageHandlerGroup;
