import * as z from "zod/mini";
import type { AccountClientMessage, ClientMessage } from "./protocol";
import { roleIds, type RoleId } from "./engine";
import { locales } from "./i18n/config";
import { WITCH_ASKS } from "./auto/phone";

const id = z.string();
const optionalId = z.nullable(id);
const ids = z.array(id);
const flag = z.boolean();
const roleId = z.enum(roleIds as [RoleId, ...RoleId[]]);
const photo = z.optional(z.nullable(z.string()));
const locale = z.enum(locales);

const action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("continue") }),
  z.object({ type: z.literal("thief"), pick: z.nullable(z.number()) }),
  z.object({ type: z.literal("cupid"), lovers: z.nullable(z.tuple([id, id])) }),
  z.object({ type: z.literal("seer"), targetId: optionalId }),
  z.object({ type: z.literal("wolves"), targetId: optionalId }),
  z.object({ type: z.literal("witch"), heal: flag, poisonId: optionalId }),
  z.object({ type: z.literal("hunter"), targetId: optionalId }),
  z.object({ type: z.literal("mayor"), targetId: id }),
  z.object({ type: z.literal("vote"), targetId: optionalId, tie: z.optional(flag), tiedIds: z.optional(ids) }),
  z.object({ type: z.literal("pick"), targetIds: ids }),
  z.object({ type: z.literal("choose"), value: z.nullable(z.union([z.number(), z.string(), flag])) }),
  z.object({ type: z.literal("sudden-death"), playerId: id }),
]);

const settings = z.object({
  mayor: flag,
  revealRoleOnDeath: flag,
  witchCanSelfHeal: flag,
  wolvesWinAtParity: flag,
  piperCharms: z.union([z.literal(1), z.literal(2), z.literal("choice")]),
  angelRule: z.enum(["opening-vote", "first-vote"]),
  theme: z.string(),
});

const autoConfig = z.object({
  deck: z.enum(["open", "hidden"]),
  style: z.enum(["classic", "no-villagers"]),
  discussionSeconds: z.number(),
  exclude: z.optional(z.array(roleId)),
});

const setupOptions = {
  actorCards: z.optional(z.array(roleId)),
  groups: z.optional(z.record(id, z.enum(["a", "b"]))),
  auto: z.optional(autoConfig),
};

const startGame = z.discriminatedUnion("mode", [
  z.object({ type: z.literal("start-game"), ...setupOptions, mode: z.literal("random"), deck: z.array(roleId), settings }),
  z.object({ type: z.literal("start-game"), ...setupOptions, mode: z.literal("manual"), assignment: z.record(id, roleId), extraCards: z.array(roleId), settings }),
]);

const message = <Type extends string, Shape extends z.core.$ZodShape>(type: Type, shape: Shape) => z.object({ type: z.literal(type), ...shape });

/** A message with nothing but its type. */
const signal = <Type extends string>(type: Type) => z.object({ type: z.literal(type) });

/** The shape of every message a phone or the game master's screen may send, by type. */
export const clientMessageSchemas = {
  join: message("join", { name: z.string(), photo, ticket: z.optional(z.string()), leaveOther: z.optional(flag), showUsername: z.optional(flag) }),
  "link-account": message("link-account", { ticket: z.string(), leaveOther: z.optional(flag) }),
  unlock: message("unlock", { ticket: z.string() }),
  "show-username": message("show-username", { value: flag }),
  "rename-self": message("rename-self", { name: z.string() }),
  leave: signal("leave"),
  "request-rejoin": message("request-rejoin", { name: z.string(), ticket: z.optional(z.string()), leaveOther: z.optional(flag) }),
  "cast-vote": message("cast-vote", { targetId: optionalId }),
  stand: message("stand", { value: flag }),
  play: message("play", { action }),
  "wolf-pick": message("wolf-pick", { targetId: optionalId }),
  "more-time": signal("more-time"),
  ack: signal("ack"),
  ready: message("ready", { value: flag }),
  "cue-done": message("cue-done", { id: z.number() }),
  "set-locale": message("set-locale", { locale }),
  "set-photo": message("set-photo", { playerId: z.optional(id), data: z.nullable(z.string()) }),
  "host-account": message("host-account", { ticket: z.nullable(z.string()) }),
  "give-lead": message("give-lead", { playerId: id }),
  "reclaim-master": message("reclaim-master", { ticket: z.optional(z.string()) }),
  pause: message("pause", { value: flag }),
  "sudden-death": message("sudden-death", { playerId: id }),
  succession: message("succession", { dead: flag }),
  "set-mode": message("set-mode", { mode: z.enum(["master", "auto"]), name: z.optional(z.string()), photo, locale: z.optional(locale) }),
  "add-player": message("add-player", { name: z.string() }),
  "remove-player": message("remove-player", { playerId: id }),
  "move-player": message("move-player", { playerId: id, seat: z.number() }),
  "set-locked": message("set-locked", { locked: flag }),
  "start-game": startGame,
  "game-action": message("game-action", { action }),
  undo: signal("undo"),
  "master-stage": message("master-stage", { stage: z.enum(WITCH_ASKS) }),
  "lead-read": message("lead-read", { at: z.number() }),
  "end-game": signal("end-game"),
  "resume-game": signal("resume-game"),
  "rename-player": message("rename-player", { playerId: id, name: z.string() }),
  "close-room": signal("close-room"),
  "answer-request": message("answer-request", { requestId: id, allow: flag, seatId: z.optional(id) }),
  "undo-handover": signal("undo-handover"),
  "keep-handover": signal("keep-handover"),
  "cancel-request": signal("cancel-request"),
  "open-ballot": message("open-ballot", { candidateIds: z.optional(ids) }),
  "close-ballot": signal("close-ballot"),
  "set-vote": message("set-vote", { voterId: id, targetId: optionalId, clear: z.optional(flag) }),
  "set-timer": message("set-timer", { seconds: z.nullable(z.number()) }),
  "pause-timer": signal("pause-timer"),
  "resume-timer": signal("resume-timer"),
  "add-friend": message("add-friend", { playerId: optionalId }),
  invite: message("invite", { subs: ids }),
  "friends-here": signal("friends-here"),
  profile: message("profile", { playerId: optionalId }),
} satisfies { [Type in ClientMessage["type"]]: z.ZodMiniType<Extract<ClientMessage, { type: Type }>> };

/** The shape of every message a signed-in page sends its account's server, by type. */
export const accountMessageSchemas = {
  hello: message("hello", { ticket: z.string() }),
  resolve: message("resolve", { takeOver: flag, here: z.optional(flag) }),
  "friend-requested": message("friend-requested", { to: id, accepted: flag }),
} satisfies { [Type in AccountClientMessage["type"]]: z.ZodMiniType<Extract<AccountClientMessage, { type: Type }>> };

function parseWith<Schemas extends Record<string, z.ZodMiniType>>(schemas: Schemas, raw: string): z.output<Schemas[keyof Schemas]> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const type = (parsed as { type?: unknown } | null)?.type;
  // Own keys only: a made-up type such as "toString" finds nothing.
  if (typeof type !== "string" || !Object.hasOwn(schemas, type)) return null;
  const result = schemas[type].safeParse(parsed);
  return result.success ? (result.data as z.output<Schemas[keyof Schemas]>) : null;
}

/** The message a room received, or null when it isn't one the room knows, in the shape its type requires. */
export const parseClientMessage = (raw: string): ClientMessage | null => parseWith(clientMessageSchemas, raw);

/** The message an account's server received, or null when it isn't one it knows, in the shape its type requires. */
export const parseAccountMessage = (raw: string): AccountClientMessage | null => parseWith(accountMessageSchemas, raw);
