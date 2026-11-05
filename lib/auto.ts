import { applyAction, elderCostsPowers, isWolf, roles, type Action, type DeckStyle, type GameState, type RoleId, type Step } from "./engine";
import { tallyBallot, type Ballot, type Timer } from "./ballot";
import { format } from "./i18n/config";
import type { Dictionary } from "./i18n/dictionaries/en";
import type { Stinger } from "./sound-types";

/**
 * Games without a game master: everyone plays on their phone, and the room
 * runs the game. Each engine step becomes a few beats: lines the narrator
 * phone reads out, then a wait (a fixed hold, a player's choice, the debate,
 * a ballot). Pure: the room server calls it on every message and alarm, with
 * the clock, and keeps what it returns.
 */

/** Chosen in the lobby. */
export type AutoConfig = {
  /** "open": the creator picks the cards and everyone sees them. "hidden": nobody picks, nobody knows. */
  deck: "open" | "hidden";
  /** The hidden deck's kind. */
  style: DeckStyle;
  /** The day's debate, before the vote. */
  discussionSeconds: number;
  /** Roles the hidden deck never deals (taken out in the card picker). */
  exclude?: RoleId[];
};

export const DISCUSSION_CHOICES = [120, 180, 300, 420, 600];
export const defaultAutoConfig: AutoConfig = { deck: "hidden", style: "classic", discussionSeconds: 300 };

export function cleanAutoConfig(input: unknown): AutoConfig {
  const value = (input ?? {}) as Partial<AutoConfig>;
  return {
    deck: value.deck === "open" ? "open" : "hidden",
    style: value.style === "no-villagers" ? "no-villagers" : "classic",
    discussionSeconds: DISCUSSION_CHOICES.includes(value.discussionSeconds as number) ? value.discussionSeconds! : defaultAutoConfig.discussionSeconds,
    exclude: Array.isArray(value.exclude) ? value.exclude.filter((r): r is RoleId => r in roles && r !== "werewolf" && r !== "villager") : [],
  };
}

/** Milliseconds. */
export const TIMING = {
  /** First reminder, second reminder (with "one more minute"), then the turn is skipped. */
  reminder: 30_000,
  lastCall: 60_000,
  skip: 90_000,
  extra: 60_000,
  /** Secret choices by day (Devoted Servant, Stuttering Judge): short, the same length whatever the answer. */
  secretMin: 8_000,
  secretSkip: 20_000,
  /** Between a role going back to sleep and the next call. */
  sleep: 3_000,
  /** Reading a result or a message on the phone. */
  look: 7_000,
  check: 8_000,
  candidacy: 30_000,
  ballot: 90_000,
  secondDebate: 60_000,
  card: 10_000,
};

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

type Wait =
  | { kind: "hold"; ms: number }
  | { kind: "input"; secret?: boolean }
  | { kind: "debate" }
  | { kind: "ballot" }
  | { kind: "end" };

/** What phones show during a beat, besides the sleeping screen. */
export type Show = "turn" | "check" | "group" | "result" | "candidacy" | "card";

type Beat = { say: string[]; sound?: Stinger; wait: Wait; show?: Show };

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

// --- who plays ---

/** Steps a player answers on their phone (votes aside), and who. */
export function actorsOf(step: Step): string[] {
  switch (step.kind) {
    case "wolves":
      return step.playerIds;
    case "thief":
    case "actor":
    case "wolf-hound":
    case "cupid":
    case "wild-child":
    case "defender":
    case "seer":
    case "fox":
    case "infect":
    case "big-bad-wolf":
    case "white-werewolf":
    case "witch":
    case "piper":
    case "raven":
    case "hunter":
    case "mayor-succession":
    case "scapegoat":
    case "servant":
    case "judge":
    case "tie-break":
      return [step.playerId];
    default:
      return [];
  }
}

/** The role a turn calls, as the narrator names it. */
function turnRole(step: Step): RoleId | "wolves" | "mayor" {
  switch (step.kind) {
    case "wolves":
      return "wolves";
    case "piper":
      return "pied-piper";
    case "infect":
      return "accursed-wolf-father";
    case "mayor-succession":
    case "tie-break":
      return "mayor";
    case "servant":
      return "devoted-servant";
    case "judge":
      return "stuttering-judge";
    case "bluff":
      return step.turn === "wolves" ? "wolves" : step.role;
    default:
      return step.kind as RoleId;
  }
}

function roleName(dict: Dictionary, role: RoleId | "wolves" | "mayor") {
  if (role === "wolves") return dict.auto.wolvesName;
  if (role === "mayor") return dict.game.mayor;
  return dict.roles[role].name;
}

// --- beats ---

const nameOf = (game: GameState, id: string) => game.players.find((p) => p.id === id)?.name ?? "?";

function hash(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** One of a few lines, the same one for the same moment. */
const pick = (lines: string[], seed: string, offset = 0) => lines[(hash(seed) + offset) % lines.length];

/** The night's wake-up lines, by the turn they call (bluffs included). */
function wakeLine(dict: Dictionary, game: GameState, turn: string) {
  const piper = game.setup.settings.piperCharms;
  const lines = dict.auto.wake as Record<string, string>;
  const fallback = (dict.game.steps as Record<string, { say?: string }>)[turn]?.say ?? "";
  return format(lines[turn] ?? fallback, { count: piper === "choice" ? dict.auto.oneOrTwo : piper });
}

const turnOf = (step: Step) => (step.kind === "piper" ? "pied-piper" : step.kind === "infect" ? "accursed-wolf-father" : step.kind);

type Group = "lovers" | "charmed" | "two-sisters" | "three-brothers";

function groupBeats(dict: Dictionary, group: Group, check: boolean): Beat[] {
  const t = dict.auto;
  return [
    ...(check
      ? [
          { say: [t.everyoneCheck], show: "check", wait: { kind: "hold", ms: TIMING.check } } satisfies Beat,
          { say: [t.everyoneSleep], wait: { kind: "hold", ms: TIMING.sleep } } satisfies Beat,
        ]
      : []),
    { say: [t.groupWake[group]], show: "group", wait: { kind: "hold", ms: TIMING.look } },
    { say: [t.groupSleep[group]], wait: { kind: "hold", ms: TIMING.sleep } },
  ];
}

/** Every line a death announcement reads, in order. */
function deathLines(dict: Dictionary, game: GameState, step: Extract<Step, { kind: "deaths" }>) {
  const t = dict.game.steps.deaths;
  const dawn = step.context === "dawn";
  const seed = `${game.phase.kind}${game.phase.number}`;
  const seat = (id: string, grief: boolean) => game.players.findIndex((p) => p.id === id) + (grief ? game.players.length : 0);
  const deaths = dawn ? [...step.deaths].sort((a, b) => seat(a.playerId, a.cause === "grief") - seat(b.playerId, b.cause === "grief")) : step.deaths;
  const lines = [t[step.context]];
  if (deaths.length === 0) lines.push(pick(t.nobody, seed));
  deaths.forEach((d, i) => {
    const name = nameOf(game, d.playerId);
    lines.push(
      d.cause === "grief" ? format(t.grief, { name }) : dawn ? format(pick(t.found, seed, i), { name }) : format(t.died, { name, cause: dict.game.causes[d.cause] }),
    );
    const role = game.players.find((p) => p.id === d.playerId)!.role;
    if (game.setup.settings.revealRoleOnDeath) lines.push(format(dict.auto.wasRole, { name, role: dict.roles[role].name }));
  });
  if (!dawn && elderCostsPowers(game, step.deaths)) lines.push(t.powersLost);
  return lines;
}

/** The beats of the current step, from the state alone (the same on every call). */
export function beatsOf(room: AutoRoom, dict: Dictionary): Beat[] {
  const { game, auto } = room;
  const step = game.step;
  const t = dict.auto;
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

  const input = (say: string[], secret = false): Beat => ({ say, show: "turn", wait: { kind: "input", secret } });
  const seed = `${auto.seed}:${room.log.length}`;

  switch (step.kind) {
    case "prologue":
      beats.push({ say: [t.lookAtCard], show: "card", wait: { kind: "hold", ms: TIMING.card } });
      beats.push({ say: dict.game.story.prologue.say, wait: { kind: "hold", ms: 1_000 } });
      break;
    case "phase-end": {
      const story = dict.game.story;
      // Only when the cards are shown: otherwise the line would tell the village a wolf fell.
      const wolfDown =
        game.setup.settings.revealRoleOnDeath &&
        game.players.some((p) => p.death && p.death.phase.kind === game.phase.kind && p.death.phase.number === game.phase.number && isWolf(p));
      const lines = step.next.kind === "day" ? story.nightEnds : wolfDown ? story.dayEndsWolfDown : story.dayEnds;
      beats.push({ say: [pick(lines, `${game.phase.kind}${game.phase.number}`)], wait: { kind: "hold", ms: 2_000 } });
      break;
    }
    case "deaths": {
      const sound: Stinger =
        step.context === "dawn"
          ? { kind: "dawn", theme: game.setup.settings.theme ?? "werewolves", count: step.deaths.length }
          : { kind: "deaths", count: step.deaths.length };
      beats.push({ say: deathLines(dict, game, step), sound: step.deaths.length || step.context === "dawn" ? sound : undefined, wait: { kind: "hold", ms: 2_000 } });
      break;
    }
    case "lovers":
      beats.push(...groupBeats(dict, "lovers", true));
      break;
    case "charmed":
      beats.push(...groupBeats(dict, "charmed", true));
      break;
    case "siblings":
      beats.push(...groupBeats(dict, step.role, false));
      break;
    case "seer-result":
    case "fox-result":
      beats.push({ say: [], show: "result", wait: { kind: "hold", ms: TIMING.look } });
      beats.push({ say: [dict.game.steps[step.kind].say], wait: { kind: "hold", ms: TIMING.sleep } });
      break;
    case "bluff": {
      // Exactly like the real turn, with nobody playing it.
      if (step.turn === "lovers" || step.turn === "charmed") beats.push(...groupBeats(dict, step.turn, true));
      else if (step.turn === "two-sisters" || step.turn === "three-brothers") beats.push(...groupBeats(dict, step.turn, false));
      else {
        // Some bluffs drag on like a slow player's turn, reminders included.
        const h = hash(seed);
        const reminders = h % 10 < 2 ? 2 : h % 10 < 5 ? 1 : 0;
        const tail = 3_000 + (h % 22_000);
        beats.push({ say: [wakeLine(dict, game, step.turn)], wait: { kind: "hold", ms: reminders ? TIMING.reminder : 9_000 + tail } });
        const role = roleName(dict, turnRole(step));
        if (reminders) beats.push({ say: [format(reminderLine(dict, step, "reminder"), { role })], wait: { kind: "hold", ms: reminders > 1 ? TIMING.lastCall - TIMING.reminder : tail } });
        if (reminders > 1) beats.push({ say: [format(reminderLine(dict, step, "lastCall"), { role })], wait: { kind: "hold", ms: tail } });
      }
      break;
    }
    case "bear":
      beats.push({ say: [step.growls ? dict.game.steps.bear.growls : dict.game.steps.bear.quiet], wait: { kind: "hold", ms: 2_000 } });
      break;
    case "idiot":
      beats.push({ say: [format(dict.game.steps.idiot.say, { name: nameOf(game, step.playerId) })], wait: { kind: "hold", ms: 2_000 } });
      break;
    case "hunter":
      beats.push(input([format(t.hunter, { name: nameOf(game, step.playerId) })]));
      break;
    case "mayor-succession":
      beats.push(input([format(t.succession, { name: nameOf(game, step.playerId) })]));
      break;
    case "scapegoat":
      beats.push(input([format(t.scapegoat, { name: nameOf(game, step.playerId) })]));
      break;
    case "tie-break": {
      const tied = step.tiedIds.map((id) => nameOf(game, id)).join(", ");
      beats.push(input([format(t.tieBreak, { name: nameOf(game, step.playerId), names: tied })]));
      break;
    }
    case "servant":
      beats.push(input([format(t.servant, { name: nameOf(game, step.victimId) })], true));
      break;
    case "judge":
      // The Judge's call stays secret: a short silence either way.
      beats.push(input([], true));
      break;
    case "mayor-election":
      beats.push({ say: [t.mayorStand], show: "candidacy", wait: { kind: "hold", ms: TIMING.candidacy } });
      beats.push({ say: [t.mayorVote], wait: { kind: "ballot" } });
      break;
    case "vote": {
      // The Scapegoat let nobody vote: the village still talks, and the empty ballot eliminates nobody.
      const noVoters = game.players.every((p) => !p.alive || step.cannotVote.includes(p.id));
      // The second vote after a tie follows straight on, without a new debate.
      if (step.runoff) {
        const runoff = dict.game.steps.vote;
        beats.push({ say: [step.runoff.length ? format(runoff.runoff, { names: step.runoff.map((id) => nameOf(game, id)).join(", ") }) : runoff.runoffAll, t.vote], wait: { kind: "ballot" } });
        break;
      }
      beats.push({
        say: [step.second ? dict.game.steps.vote.second : "", noVoters ? dict.game.steps.vote.noVoters : "", format(t.discussion, { minutes: debateMinutes(room, step.second) })].filter(Boolean),
        wait: { kind: "debate" },
      });
      beats.push({ say: noVoters ? [] : [t.vote], wait: { kind: "ballot" } });
      break;
    }
    case "game-over": {
      const team = step.winner.team;
      const wins = dict.game.steps["game-over"];
      beats.push({
        say: [dict.game.story.epilogue[team ?? "draw"], team ? wins.wins[team] : wins.draw],
        sound: { kind: "win", team: team === "village" || team === "wolves" ? team : "other", howl: (game.setup.settings.theme ?? "werewolves") === "werewolves" },
        wait: { kind: "end" },
      });
      break;
    }
    default:
      // Night turns played on a phone.
      beats.push(input([wakeLine(dict, game, turnOf(step))]));
  }
  return beats;
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
    case "hold":
      return late ? null : undefined;
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
      if (step.kind === "wolves") {
        const target = agreedVictim(step, auto.wolfPicks);
        if (target) return { type: "wolves", targetId: target };
      }
      if (late) return timeoutAction(game, ctx.random);
      if (!wait.secret) remind(room, ctx);
      return undefined;
    }
  }
}

/** The pack's victim, once every wolf points at the same one. */
export function agreedVictim(step: Extract<Step, { kind: "wolves" }>, picks: Record<string, string>) {
  const chosen = step.playerIds.map((id) => picks[id]);
  return chosen.length > 0 && chosen.every((id) => id && id === chosen[0]) ? chosen[0] : null;
}

/** The pack is always spoken to as many, however many are left. */
function reminderLine(dict: Dictionary, step: Step, kind: "reminder" | "lastCall") {
  const pack = turnRole(step) === "wolves";
  return kind === "reminder" ? (pack ? dict.auto.reminderPack : dict.auto.reminder) : pack ? dict.auto.lastCallPack : dict.auto.lastCall;
}

function remind(room: AutoRoom, ctx: AutoContext) {
  const { auto, game } = room;
  const elapsed = ctx.now - auto.since;
  const role = roleName(ctx.dict, turnRole(game.step));
  if (auto.reminded === 0 && elapsed >= TIMING.reminder) {
    auto.reminded = 1;
    say(auto, [format(reminderLine(ctx.dict, game.step, "reminder"), { role })]);
  } else if (auto.reminded === 1 && elapsed >= TIMING.lastCall) {
    auto.reminded = 2;
    say(auto, [format(reminderLine(ctx.dict, game.step, "lastCall"), { role })]);
  }
}

/** A turn nobody played in time: nothing happens when the rules allow it, chance decides when they don't. */
export function timeoutAction(game: GameState, random: () => number): Action {
  const step = game.step;
  const living = game.players.filter((p) => p.alive);
  const any = (exclude: string[] = []) => {
    const pool = living.filter((p) => !exclude.includes(p.id));
    return pool[Math.floor(random() * pool.length)]?.id ?? living[0].id;
  };
  switch (step.kind) {
    case "thief":
      return { type: "thief", pick: step.mustTakeWolf ? 0 : null };
    case "actor":
      return { type: "choose", value: null };
    case "wolf-hound":
      return { type: "choose", value: "village" };
    case "cupid":
      return { type: "cupid", lovers: null };
    case "seer":
      return { type: "seer", targetId: null };
    case "wolves":
      return { type: "wolves", targetId: null };
    case "hunter":
      return { type: "hunter", targetId: null };
    case "witch":
      return { type: "witch", heal: false, poisonId: null };
    case "infect":
    case "servant":
    case "judge":
      return { type: "choose", value: false };
    case "mayor-succession":
      return { type: "mayor", targetId: any([step.playerId]) };
    case "scapegoat":
      // Nobody chosen: everyone may vote.
      return { type: "pick", targetIds: living.map((p) => p.id) };
    default:
      return { type: "pick", targetIds: [] };
  }
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

/** A wolf's pick for the pack, with or without a game master. */
export function setWolfPick(game: GameState, picks: Record<string, string>, playerId: string, targetId: string | null) {
  const step = game.step;
  if (step.kind !== "wolves" || !step.playerIds.includes(playerId)) return false;
  if (targetId === null) {
    delete picks[playerId];
    return true;
  }
  const target = game.players.find((p) => p.id === targetId);
  if (!target?.alive || isWolf(target)) return false;
  picks[playerId] = targetId;
  return true;
}

/** "One more minute", once per turn, after the last call. */
export function moreTime(room: AutoRoom, playerId: string, ctx: AutoContext) {
  const { auto, game } = room;
  if (auto.reminded < 2 || auto.extended || !actorsOf(game.step).includes(playerId)) return false;
  auto.extended = true;
  auto.deadline = Math.max(auto.deadline, ctx.now + TIMING.extra);
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

export type PhoneTurn =
  | {
      kind: "pick";
      step: "cupid" | "wild-child" | "defender" | "seer" | "fox" | "big-bad-wolf" | "white-werewolf" | "piper" | "raven" | "hunter" | "mayor-succession" | "scapegoat" | "tie-break";
      min: number;
      max: number;
      targets: string[];
      /** May confirm with nobody. */
      skip: boolean;
      /** Defender: protected last night. */
      lastId?: string | null;
    }
  | { kind: "wolves"; targets: string[]; wolves: string[]; picks: Record<string, string> }
  | { kind: "witch"; victimId: string | null; canHeal: boolean; canPoison: boolean; targets: string[] }
  | { kind: "cards"; step: "thief" | "actor"; cards: RoleId[]; canKeep: boolean }
  | { kind: "choice"; step: "wolf-hound" | "infect" | "servant" | "judge"; victimId?: string }
  | { kind: "seer-result"; targetId: string; role: RoleId }
  | { kind: "fox-result"; playerIds: string[]; hasWolf: boolean }
  | { kind: "check"; message: "lover" | "charmed" | "nothing"; partnerId?: string }
  | { kind: "group"; group: Group; ids: string[] };

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
  if (actorsOf(step).length) return "turn";
  if (step.kind === "seer-result" || step.kind === "fox-result") return "result";
  if (step.kind === "lovers" || step.kind === "charmed" || step.kind === "siblings") return "group";
  return undefined;
}

/** What a phone shows for a step, given what the beat shows and whether its answer is in. */
export function turnFor(game: GameState, playerId: string, show: Show | undefined, answered: boolean, wolfPicks: Record<string, string>): PhoneTurn | null {
  const step = game.step;
  const me = game.players.find((p) => p.id === playerId);
  if (!me) return null;
  const beat = { show };
  const living = game.players.filter((p) => p.alive);
  const ids = (filter: (p: (typeof living)[number]) => boolean = () => true) => living.filter(filter).map((p) => p.id);

  if (beat.show === "check" && me.alive) {
    if (step.kind === "lovers" && step.lovers.includes(playerId)) {
      return { kind: "check", message: "lover", partnerId: step.lovers.find((id) => id !== playerId) };
    }
    if (step.kind === "charmed" && step.newIds.includes(playerId)) return { kind: "check", message: "charmed" };
    return { kind: "check", message: "nothing" };
  }
  if (beat.show === "group") {
    const members = step.kind === "lovers" ? step.lovers : step.kind === "charmed" || step.kind === "siblings" ? step.playerIds : [];
    const group = step.kind === "siblings" ? step.role : step.kind === "lovers" || step.kind === "charmed" ? step.kind : null;
    return group && members.includes(playerId) ? { kind: "group", group, ids: members } : null;
  }
  if (beat.show === "result") {
    if (step.kind === "seer-result" && step.playerId === playerId) return { kind: "seer-result", targetId: step.targetId, role: step.role };
    if (step.kind === "fox-result" && step.playerId === playerId) return { kind: "fox-result", playerIds: step.playerIds, hasWolf: step.hasWolf };
    return null;
  }
  if (beat.show !== "turn" || answered || !actorsOf(step).includes(playerId)) return null;

  switch (step.kind) {
    case "wolves":
      return { kind: "wolves", targets: ids((p) => !isWolf(p)), wolves: step.playerIds, picks: wolfPicks };
    case "witch":
      return { kind: "witch", victimId: step.victimId, canHeal: step.canHeal, canPoison: step.canPoison, targets: ids((p) => p.id !== step.victimId) };
    case "thief":
      return { kind: "cards", step: "thief", cards: step.cards, canKeep: !step.mustTakeWolf };
    case "actor":
      return { kind: "cards", step: "actor", cards: step.cards, canKeep: true };
    case "wolf-hound":
    case "judge":
      return { kind: "choice", step: step.kind };
    case "infect":
      return { kind: "choice", step: "infect", victimId: step.victimId };
    case "servant":
      return { kind: "choice", step: "servant", victimId: step.victimId };
    case "cupid":
      return { kind: "pick", step: "cupid", min: 2, max: 2, targets: ids(), skip: false };
    case "wild-child":
      return { kind: "pick", step: "wild-child", min: 1, max: 1, targets: ids((p) => p.id !== playerId), skip: false };
    case "defender":
      return { kind: "pick", step: "defender", min: 1, max: 1, targets: ids((p) => p.id !== step.lastProtectedId), skip: true, lastId: step.lastProtectedId };
    case "seer":
      return { kind: "pick", step: "seer", min: 1, max: 1, targets: ids((p) => p.id !== playerId), skip: false };
    case "fox":
      return { kind: "pick", step: "fox", min: 1, max: 1, targets: ids(), skip: false };
    case "big-bad-wolf":
      return { kind: "pick", step: "big-bad-wolf", min: 1, max: 1, targets: ids((p) => !isWolf(p) && p.id !== step.wolvesTargetId), skip: true };
    case "white-werewolf":
      return { kind: "pick", step: "white-werewolf", min: 1, max: 1, targets: ids((p) => isWolf(p) && p.id !== playerId), skip: true };
    case "piper":
      return { kind: "pick", step: "piper", min: step.min, max: step.count, targets: ids((p) => p.id !== playerId && !p.flags.charmed), skip: false };
    case "raven":
      return { kind: "pick", step: "raven", min: 1, max: 1, targets: ids(), skip: true };
    case "hunter":
      return { kind: "pick", step: "hunter", min: 1, max: 1, targets: ids(), skip: false };
    case "mayor-succession":
      return { kind: "pick", step: "mayor-succession", min: 1, max: 1, targets: ids(), skip: false };
    case "scapegoat":
      return { kind: "pick", step: "scapegoat", min: 1, max: living.length, targets: ids(), skip: false };
    case "tie-break":
      return { kind: "pick", step: "tie-break", min: 1, max: 1, targets: step.tiedIds.length ? ids((p) => step.tiedIds.includes(p.id)) : ids(), skip: false };
    default:
      return null;
  }
}

/** The action a phone's "pick" turn sends. */
export function pickAction(turn: Extract<PhoneTurn, { kind: "pick" }>, targetIds: string[]): Action {
  switch (turn.step) {
    case "cupid":
      return { type: "cupid", lovers: [targetIds[0], targetIds[1]] };
    case "seer":
      return { type: "seer", targetId: targetIds[0] ?? null };
    case "hunter":
      return { type: "hunter", targetId: targetIds[0] ?? null };
    case "mayor-succession":
      return { type: "mayor", targetId: targetIds[0] };
    default:
      return { type: "pick", targetIds };
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
