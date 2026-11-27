import { applyAction, type Action, type GameState, type Player, type Step } from "../engine";
import { tallyBallot, type Ballot, type Timer } from "../ballot";
import { format } from "../i18n/config";
import type { Dictionary } from "../i18n/dictionaries/en";
import type { Stinger } from "../sound-types";
import { actorsOf, moduleOf, type BeatContext } from "../steps";
import { reminderLine } from "../steps/bluff/steps";
import { setWolfPick } from "../roles/werewolf/steps";
import { unreachable } from "../exhaustive";
import { callerName, nameOf, type Beat, type Caller, type Show } from "./beats";
import type { AutoConfig } from "./config";
import type { PhoneTurn } from "./phone";
import { TIMING } from "./timing";

export * from "./config";
export { TIMING } from "./timing";
export { actorCall, actorTurn, type Show } from "./beats";
export { WITCH_ASKS, pickAction, type PhoneTurn, type WitchAsk } from "./phone";
export { tableLines } from "../steps/prologue/steps";
export { actorsOf } from "../steps";
export { agreedVictim, setWolfPick } from "../roles/werewolf/steps";

/**
 * Games without a game master: everyone plays on their phone, and the room
 * runs the game. Each engine step becomes a few beats: lines the narrator
 * phone reads out, then a wait (a fixed hold, a player's choice, the debate,
 * a ballot). Pure: the room server calls it on every message and alarm, with
 * the clock, and keeps what it returns.
 */

/** What the narrator phone reads out. A new id means new lines. */
export type Cue = { id: number; lines: string[]; sound?: Stinger };

export type AutoState = {
  config: AutoConfig;
  /** The game log's length when the current step began: progress below belongs to that step. */
  at: number;
  beat: number;
  /** Reading the beat's lines, then waiting. */
  phase: "say" | "wait";
  since: number;
  /** "say": when to stop waiting for the narrator. "wait": when the hold ends or the turn is skipped. */
  deadline: number;
  cue: Cue | null;
  /** The cue the "say" phase waits for. */
  beatCue: number;
  reminded: 0 | 1 | 2;
  extended: boolean;
  /** A choice made, applied once the beat's minimum time is up (secret choices). */
  answer: Action | null;
  /** Wolf id → the victim they point at. */
  wolfPicks: Record<string, string>;
  /** Players who want to vote now. */
  ready: string[];
  /** Players done with what the current beat shows them (their card, a message, a result): see `audience`. */
  acks?: string[];
  /** Lines to read when the step at `leadAt` begins (a vote's result). */
  lead: string[];
  leadAt: number;
  seed: number;
  /** Paused since then (the leader's call, or their phone is gone): nothing moves. */
  pausedAt?: number | null;
  /** Back from a pause: a line read first (eyes closed again at night), then the wait as it was. */
  resumed?: { phase: "say" | "wait"; since: number; deadline: number } | null;
};

/** The room's parts the auto game reads and changes. */
export type AutoRoom = {
  game: GameState;
  log: Action[];
  auto: AutoState;
  ballot: Ballot | null;
  timer: Timer | null;
  /** Players running for Mayor. */
  candidates: string[];
};

export type AutoContext = { dict: Dictionary; random: () => number; now: number };

export function startAuto(config: AutoConfig, ctx: Pick<AutoContext, "random" | "now">): AutoState {
  const auto: AutoState = {
    config,
    // Nothing started yet: the first tick opens the first step.
    at: -1,
    beat: 0,
    phase: "say",
    since: ctx.now,
    deadline: ctx.now,
    cue: null,
    beatCue: 0,
    reminded: 0,
    extended: false,
    answer: null,
    wolfPicks: {},
    ready: [],
    lead: [],
    leadAt: -1,
    seed: Math.floor(ctx.random() * 2 ** 31),
  };
  return auto;
}

// --- beats ---

/** Whom reminders call on the current step. */
const callerOf = (step: Step): Caller => moduleOf(step).caller?.(step) ?? (step.kind as Caller);

/** The beats of the current step, from the state alone (the same on every call). */
export function beatsOf(room: AutoRoom, dict: Dictionary): Beat[] {
  const { game, auto } = room;
  const step = game.step;
  const beats: Beat[] = [];

  if (auto.leadAt === room.log.length && auto.lead.length) beats.push({ say: auto.lead, wait: { kind: "hold", ms: 1_500 } });
  // The last turn's role goes back to sleep, and the night waits a moment before the next call.
  const sleeper = game.backToSleep;
  if (sleeper) {
    const line = sleeper === "wolves" ? dict.game.wolvesSleep : format(dict.game.sleep, { role: dict.roles[sleeper].name });
    beats.push({ say: [line], wait: { kind: "hold", ms: TIMING.sleep } });
  }
  if (game.phase.kind === "night" && game.phaseStep === 0 && step.kind !== "prologue" && step.kind !== "phase-end") {
    beats.push({ say: [dict.game.nightFalls], wait: { kind: "hold", ms: TIMING.sleep } });
  }
  const context: BeatContext = { game, dict, seed: `${auto.seed}:${room.log.length}`, debateMinutes: (second) => debateMinutes(room, second) };
  return [...beats, ...moduleOf(step).beats(step, context)];
}

const debateMs = (room: AutoRoom, second: boolean) => (second ? TIMING.secondDebate : room.auto.config.discussionSeconds * 1000);
const debateMinutes = (room: AutoRoom, second: boolean) => Math.round(debateMs(room, second) / 60_000);

// --- running it ---

/** Words read at a calm pace, plus a margin: how long the narrator gets before the game moves on anyway. */
function readingTime(lines: string[]) {
  const words = lines.join(" ").split(/\s+/).filter(Boolean).length;
  return 5_000 + words * 700;
}

function say(auto: AutoState, lines: string[], sound?: Stinger) {
  auto.cue = { id: (auto.cue?.id ?? 0) + 1, lines, sound };
  return auto.cue.id;
}

/** The current beat, or null once the game is over. */
export function currentBeat(room: AutoRoom, dict: Dictionary): Beat | null {
  return beatsOf(room, dict)[room.auto.beat] ?? null;
}

function startBeat(room: AutoRoom, ctx: AutoContext) {
  const { auto } = room;
  const beat = currentBeat(room, ctx.dict);
  auto.reminded = 0;
  auto.extended = false;
  auto.answer = null;
  auto.acks = [];
  auto.since = ctx.now;
  if (beat && (beat.say.length || beat.sound)) {
    auto.phase = "say";
    auto.beatCue = say(auto, beat.say, beat.sound);
    auto.deadline = ctx.now + readingTime(beat.say);
  } else {
    startWait(room, ctx);
  }
}

function startWait(room: AutoRoom, ctx: AutoContext) {
  const { auto, game } = room;
  const beat = currentBeat(room, ctx.dict);
  auto.phase = "wait";
  auto.since = ctx.now;
  if (!beat) return;
  const wait = beat.wait;
  if (wait.kind === "hold") auto.deadline = ctx.now + wait.ms;
  else if (wait.kind === "input") auto.deadline = ctx.now + (wait.secret ? TIMING.secretSkip : TIMING.skip);
  else if (wait.kind === "debate") {
    const ms = debateMs(room, game.step.kind === "vote" && game.step.second);
    auto.ready = [];
    auto.deadline = ctx.now + ms;
    room.timer = { endsAt: auto.deadline, remainingMs: ms, durationMs: ms };
  } else if (wait.kind === "ballot") {
    openBallot(room, ctx);
    auto.deadline = ctx.now + TIMING.ballot;
  } else auto.deadline = Infinity;
}

function openBallot(room: AutoRoom, ctx: AutoContext) {
  const { game } = room;
  const living = game.players.filter((p) => p.alive).map((p) => p.id);
  if (game.step.kind === "mayor-election") {
    const candidates = room.candidates.filter((id) => living.includes(id));
    room.ballot = { kind: "mayor", voterIds: living, candidateIds: candidates.length ? candidates : living, votes: {} };
  } else if (game.step.kind === "vote") {
    const cannot = game.step.cannotVote;
    const runoff = game.step.runoff;
    room.ballot = { kind: "vote", voterIds: living.filter((id) => !cannot.includes(id)), candidateIds: runoff?.length ? runoff : living, votes: {} };
  }
  room.timer = { endsAt: ctx.now + TIMING.ballot, remainingMs: TIMING.ballot, durationMs: TIMING.ballot };
}

/**
 * Moves the game on as far as the clock allows. Returns the actions played,
 * already applied to `room.game` and added to `room.log`.
 */
export function tick(room: AutoRoom, ctx: AutoContext): Action[] {
  const played: Action[] = [];
  const { auto } = room;
  if (auto.pausedAt) return played;
  // Enough for a whole night of instant steps; a loop past it is a bug, not a game.
  for (let guard = 0; guard < 200; guard++) {
    if (auto.at !== room.log.length) {
      // A new step: its first beat.
      auto.at = room.log.length;
      auto.beat = 0;
      auto.wolfPicks = {};
      startBeat(room, ctx);
      continue;
    }
    const beat = currentBeat(room, ctx.dict);
    if (!beat) {
      // Out of beats: the step plays on with "continue" (or is over).
      if (room.game.step.kind === "game-over") return played;
      if (!play(room, { type: "continue" }, played, ctx)) return played;
      continue;
    }
    if (auto.phase === "say") {
      if (ctx.now < auto.deadline) return played;
      const back = auto.resumed;
      if (back) {
        // The line read on resuming is over: back to where the game was.
        auto.resumed = null;
        const spent = ctx.now - auto.since;
        if (back.phase === "say") startBeat(room, ctx);
        else {
          Object.assign(auto, { phase: "wait", since: back.since + spent, deadline: back.deadline + spent });
          if (room.timer?.endsAt != null) room.timer = { ...room.timer, endsAt: room.timer.endsAt + spent };
        }
        continue;
      }
      startWait(room, ctx);
      continue;
    }
    const action = waitOver(room, beat, ctx);
    if (action === undefined) return played;
    if (action === null) {
      // The beat is done, the step isn't.
      auto.beat += 1;
      startBeat(room, ctx);
      continue;
    }
    if (!play(room, action, played, ctx)) return played;
  }
  return played;
}

function play(room: AutoRoom, action: Action, played: Action[], ctx: AutoContext) {
  const { auto } = room;
  // A new Mayor named by their predecessor is announced too (an elected one already is).
  if (action.type === "mayor" && auto.leadAt !== room.log.length + 1) {
    auto.lead = [format(ctx.dict.auto.mayorElected, { name: nameOf(room.game, action.targetId) })];
    auto.leadAt = room.log.length + 1;
  }
  try {
    room.game = applyAction(room.game, action);
  } catch {
    return false;
  }
  room.log.push(action);
  played.push(action);
  room.ballot = null;
  room.timer = null;
  return true;
}

/**
 * Whether the current wait is over: undefined (not yet), null (on to the next
 * beat), or the action that ends the step.
 */
function waitOver(room: AutoRoom, beat: Beat, ctx: AutoContext): Action | null | undefined {
  const { auto, game } = room;
  const step = game.step;
  const wait = beat.wait;
  const late = ctx.now >= auto.deadline;
  switch (wait.kind) {
    case "end":
      return undefined;
    case "hold": {
      // Everyone it shows something to is done: no need to wait for the clock.
      const who = audience(room, beat);
      return late || (who.length > 0 && who.every((id) => auto.acks?.includes(id))) ? null : undefined;
    }
    case "debate": {
      const living = game.players.filter((p) => p.alive).length;
      if (!late && auto.ready.length * 2 <= living) return undefined;
      room.timer = null;
      return null;
    }
    case "ballot":
      return ballotOver(room, ctx, late);
    case "input": {
      if (auto.answer) return ctx.now - auto.since >= (wait.secret ? TIMING.secretMin : 0) ? auto.answer : undefined;
      const together = moduleOf(step).jointAnswer?.(step, auto.wolfPicks);
      if (together) return together;
      if (late) return timeoutAction(game, ctx.random);
      if (!wait.secret) remind(room, ctx);
      return undefined;
    }
    default:
      return unreachable(wait);
  }
}

function remind(room: AutoRoom, ctx: AutoContext) {
  const { auto, game } = room;
  const elapsed = ctx.now - auto.since;
  const caller = callerOf(game.step);
  const role = callerName(ctx.dict, caller);
  if (auto.reminded === 0 && elapsed >= TIMING.reminder) {
    auto.reminded = 1;
    say(auto, [format(reminderLine(ctx.dict, caller, "reminder"), { role })]);
  } else if (auto.reminded === 1 && elapsed >= TIMING.lastCall) {
    auto.reminded = 2;
    say(auto, [format(reminderLine(ctx.dict, caller, "lastCall"), { role })]);
  }
}

/** A turn nobody played in time: the step's own rule, or nobody picked. */
export function timeoutAction(game: GameState, random: () => number): Action {
  const step = game.step;
  return moduleOf(step).timeout?.(step, game, random) ?? { type: "pick", targetIds: [] };
}

function ballotOver(room: AutoRoom, ctx: AutoContext, late: boolean): Action | undefined {
  const { game, auto } = room;
  const ballot = room.ballot;
  const step = game.step;
  if (!ballot) return undefined;
  const t = ctx.dict.auto;
  const answered = ballot.voterIds.filter((id) => id in ballot.votes).length;
  const single = ballot.kind === "mayor" && ballot.candidateIds.length === 1;
  if (!late && !single && answered < ballot.voterIds.length) {
    if (auto.reminded === 0 && ctx.now - auto.since >= TIMING.ballot / 2) {
      auto.reminded = 1;
      say(auto, [format(t.votesMissing, { count: ballot.voterIds.length - answered })]);
    }
    return undefined;
  }
  const name = (id: string) => nameOf(game, id);
  if (step.kind === "mayor-election") {
    const { counts } = tallyBallot(ballot, { mayorId: null, ravenTargetId: null });
    const max = Math.max(...ballot.candidateIds.map((id) => counts[id] ?? 0));
    const leaders = ballot.candidateIds.filter((id) => (counts[id] ?? 0) === max);
    const elected = leaders[Math.floor(ctx.random() * leaders.length)];
    auto.lead = [format(t.mayorElected, { name: name(elected) })];
    auto.leadAt = room.log.length + 1;
    return { type: "mayor", targetId: elected };
  }
  if (step.kind !== "vote") return undefined;
  const tally = tallyBallot(ballot, { mayorId: step.mayorId, ravenTargetId: step.ravenTargetId });
  const counted = Object.entries(tally.counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => format(t.tallyEntry, { name: name(id), count: n }));
  if (tally.nobody) counted.push(format(t.tallyEntry, { name: ctx.dict.ballot.noOne, count: tally.nobody }));
  const lines = counted.length ? [format(t.tally, { list: counted.join(", ") })] : [];
  const outcome = tally.outcome;
  if (outcome.kind === "tie") lines.push(step.scapegoatId ? t.tieScapegoat : step.mayorId ? t.tieMayor : step.runoff ? t.tie : t.tieRunoff);
  if (outcome.kind === "nobody") lines.push(t.nobody);
  auto.lead = lines;
  auto.leadAt = room.log.length + 1;
  if (outcome.kind === "eliminate") return { type: "vote", targetId: outcome.targetId };
  return outcome.kind === "tie" ? { type: "vote", targetId: null, tie: true, tiedIds: outcome.targetIds } : { type: "vote", targetId: null };
}

/** Stops the clock: every wait picks up where it was on `resume`. */
export function pause(room: AutoRoom, now: number) {
  const { auto } = room;
  if (auto.pausedAt) return false;
  auto.pausedAt = now;
  const timer = room.timer;
  if (timer?.endsAt != null) room.timer = { ...timer, endsAt: null, remainingMs: Math.max(0, timer.endsAt - now) };
  return true;
}

/**
 * Starts the clock again. `line`: read before anything else (at night,
 * everyone closes their eyes again), then the game goes on from where it
 * stopped; a beat stopped while it was being read is read again.
 */
export function resume(room: AutoRoom, now: number, line?: string) {
  const { auto } = room;
  if (!auto.pausedAt) return false;
  const paused = now - auto.pausedAt;
  auto.pausedAt = null;
  auto.since += paused;
  auto.deadline += paused;
  const timer = room.timer;
  if (timer && timer.endsAt === null) room.timer = { ...timer, endsAt: now + timer.remainingMs };
  if (line) {
    auto.resumed = { phase: auto.phase, since: auto.since, deadline: auto.deadline };
    auto.phase = "say";
    auto.since = now;
    auto.beatCue = say(auto, [line]);
    auto.deadline = now + readingTime([line]);
  }
  return true;
}

// --- what players send ---

/** A player's choice on their turn. Returns false when it isn't theirs to make. */
export function answer(room: AutoRoom, playerId: string, action: Action, ctx: AutoContext): boolean {
  const { auto, game } = room;
  const beat = currentBeat(room, ctx.dict);
  if (auto.pausedAt || beat?.wait.kind !== "input" || auto.answer || !actorsOf(game.step).includes(playerId)) return false;
  if (game.step.kind === "wolves" || action.type === "continue") return false;
  // Checked now, so a bad choice is refused rather than silently skipped.
  try {
    applyAction(game, action);
  } catch {
    return false;
  }
  auto.answer = action;
  return true;
}

export function wolfPick(room: AutoRoom, playerId: string, targetId: string | null, ctx: AutoContext) {
  const { auto, game } = room;
  const step = game.step;
  if (auto.pausedAt || step.kind !== "wolves" || currentBeat(room, ctx.dict)?.wait.kind !== "input") return false;
  return setWolfPick(game, auto.wolfPicks, playerId, targetId);
}

/** "One more minute", once per turn, after the last call. */
export function moreTime(room: AutoRoom, playerId: string, ctx: AutoContext) {
  const { auto, game } = room;
  if (auto.reminded < 2 || auto.extended || !actorsOf(game.step).includes(playerId)) return false;
  auto.extended = true;
  auto.deadline = Math.max(auto.deadline, ctx.now + TIMING.extra);
  return true;
}

/**
 * Who must tap OK on what a beat shows (their card, a message, a result, a
 * group, the candidacy): once they all have, the beat ends early. Everyone
 * alive, for what everyone looks at together, so nobody can tell who had news.
 */
export function audience(room: AutoRoom, beat: Beat | null): string[] {
  const { game } = room;
  const step = game.step;
  if (!beat || beat.wait.kind !== "hold") return [];
  const living = game.players.filter((p) => p.alive).map((p) => p.id);
  switch (beat.show) {
    case "card":
    case "check":
    case "candidacy":
      return living;
    case "group":
      return (moduleOf(step).group?.(step).ids ?? []).filter((id) => living.includes(id));
    case "result": {
      const result = moduleOf(step).result?.(step);
      return result ? [result.playerId] : [];
    }
    case "turn":
    case undefined:
      return [];
    default:
      return unreachable(beat.show);
  }
}

/** A player is done with what the beat shows them. */
export function ack(room: AutoRoom, playerId: string, ctx: AutoContext) {
  const { auto } = room;
  if (auto.pausedAt || auto.phase !== "wait" || !audience(room, currentBeat(room, ctx.dict)).includes(playerId)) return false;
  if (auto.acks?.includes(playerId)) return false;
  auto.acks = [...(auto.acks ?? []), playerId];
  return true;
}

export function setReady(room: AutoRoom, playerId: string, value: boolean, ctx: AutoContext) {
  const { auto, game } = room;
  if (currentBeat(room, ctx.dict)?.wait.kind !== "debate" || !game.players.find((p) => p.id === playerId)?.alive) return false;
  auto.ready = value ? [...new Set([...auto.ready, playerId])] : auto.ready.filter((id) => id !== playerId);
  return true;
}

/** The narrator phone finished reading a cue. */
export function cueDone(room: AutoRoom, id: number, ctx: AutoContext) {
  const { auto } = room;
  if (auto.phase !== "say" || auto.beatCue !== id) return false;
  auto.deadline = Math.min(auto.deadline, ctx.now);
  return true;
}

// --- what phones see ---

/** The choice or the message on one phone right now, if any. */
export function phoneTurn(room: AutoRoom, playerId: string, dict: Dictionary): PhoneTurn | null {
  const { game, auto } = room;
  const beat = currentBeat(room, dict);
  // Nothing lights up before the narrator has finished calling it: a phone
  // showing a turn while the last one is still being put to sleep gives it away.
  if (!beat || auto.pausedAt || auto.phase !== "wait") return null;
  return turnFor(game, playerId, beat.show, !!auto.answer, auto.wolfPicks);
}

/**
 * With a game master, phones may play too, if players like (remote players,
 * or simply by choice): whoever's turn it is sees it on their phone, and the
 * game master validates. Never asked for: the narrator calls turns as usual.
 */
export function masterShow(step: Step): Show | undefined {
  const rules = moduleOf(step);
  if (rules.masterShow) return rules.masterShow(step);
  if (actorsOf(step).length) return "turn";
  if (rules.result) return "result";
  if (rules.group) return "group";
  return undefined;
}

/** What a phone shows for a step, given what the beat shows and whether its answer is in. */
export function turnFor(game: GameState, playerId: string, show: Show | undefined, answered: boolean, wolfPicks: Record<string, string>): PhoneTurn | null {
  const step = game.step;
  const rules = moduleOf(step);
  const me = game.players.find((p) => p.id === playerId);
  if (!me) return null;
  const living = game.players.filter((p) => p.alive);
  const ids = (keep: (player: Player) => boolean = () => true) => living.filter(keep).map((p) => p.id);
  const context = { game, me, ids, wolfPicks };
  switch (show) {
    case "check":
      if (!me.alive) return null;
      return rules.check?.(step, playerId) ?? { kind: "check", message: "nothing" };
    case "group": {
      const group = rules.group?.(step);
      return group?.ids.includes(playerId) ? { kind: "group", ...group } : null;
    }
    case "result": {
      const result = rules.result?.(step);
      return result?.playerId === playerId ? result.turn : null;
    }
    case "turn":
      if (answered || !actorsOf(step).includes(playerId)) return rules.bystander?.(step, context) ?? null;
      return rules.turn?.(step, context) ?? null;
    case "candidacy":
    case "card":
    case undefined:
      return null;
    default:
      return unreachable(show);
  }
}

/** What every phone may know about the auto game's progress. */
export type AutoPublic = {
  config: AutoConfig;
  /** The day's debate is on: who's ready to vote (count), and whether this player is. */
  debate: { ready: number; living: number; me: boolean } | null;
  /** Running for Mayor now (the election's first beat). */
  candidacy: boolean;
  /** This player's turn: the last call came, and whether "one more minute" is still possible. */
  clock: { lastCall: boolean; canExtend: boolean; endsAt: number } | null;
  /** Someone is answering a secret question by day: phones wait. */
  waiting: boolean;
  /** Something to look at (card, message, result, group, candidacy): until when, and whether this player tapped OK. */
  look: { endsAt: number; done: boolean; show: Show } | null;
};

export function autoPublic(room: AutoRoom, playerId: string | null, dict: Dictionary): AutoPublic {
  const { auto, game } = room;
  const beat = currentBeat(room, dict);
  const living = game.players.filter((p) => p.alive).length;
  const mine = !!playerId && beat?.wait.kind === "input" && auto.phase === "wait" && actorsOf(game.step).includes(playerId);
  return {
    config: auto.config,
    debate: beat?.wait.kind === "debate" && auto.phase === "wait" ? { ready: auto.ready.length, living, me: !!playerId && auto.ready.includes(playerId) } : null,
    candidacy: beat?.show === "candidacy" && auto.phase === "wait",
    clock: mine && auto.phase === "wait" ? { lastCall: auto.reminded >= 2, canExtend: auto.reminded >= 2 && !auto.extended, endsAt: auto.deadline } : null,
    waiting: game.phase.kind === "day" && beat?.wait.kind === "input" && auto.phase === "wait" && !mine,
    look:
      playerId && auto.phase === "wait" && audience(room, beat).includes(playerId)
        ? { endsAt: auto.deadline, done: !!auto.acks?.includes(playerId), show: beat!.show! }
        : null,
  };
}

/** When the room must wake up next to move the game on (null: it waits for players only). */
export function nextWake(room: AutoRoom, dict: Dictionary): number | null {
  const { auto } = room;
  if (auto.pausedAt) return null;
  const beat = currentBeat(room, dict);
  if (!beat || beat.wait.kind === "end") return null;
  if (auto.phase === "wait" && beat.wait.kind === "input" && !beat.wait.secret && auto.reminded < 2 && !auto.answer) {
    return Math.min(auto.deadline, auto.since + (auto.reminded === 0 ? TIMING.reminder : TIMING.lastCall));
  }
  if (auto.phase === "wait" && beat.wait.kind === "input" && auto.answer) return auto.since + TIMING.secretMin;
  if (auto.phase === "wait" && beat.wait.kind === "ballot" && auto.reminded === 0) return Math.min(auto.deadline, auto.since + TIMING.ballot / 2);
  return Number.isFinite(auto.deadline) ? auto.deadline : null;
}
