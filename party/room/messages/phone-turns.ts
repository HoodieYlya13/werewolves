import { applyAction, type Action } from "../../../lib/engine";
import * as auto from "../../../lib/auto";
import { refuse, type MessageContext, type MessageHandlerGroup, type Outcome } from "./handler";
import { autoContext, autoRoom, speakerId } from "../auto-runner";
import { seatOf } from "../seats";
import { witchAsk } from "../views";

type PhoneAnswer = { kind: "play"; action: Action } | { kind: "wolf-pick"; targetId: string | null };

/** With a game master, phones may play too: kept for the game master to validate. */
function playForGameMaster({ room, sender, state }: MessageContext, answer: PhoneAnswer): Outcome {
  const game = room.game!;
  const id = seatOf(room, sender);
  if (!id || !auto.actorsOf(game.step).includes(id)) return "unchanged";
  const at = state.game!.log.length;
  const plays = state.phonePlays?.at === at ? state.phonePlays : (state.phonePlays = { at, actions: {}, wolfPicks: {} });
  if (answer.kind === "wolf-pick") return auto.setWolfPick(game, plays.wolfPicks, id, answer.targetId) ? "changed" : "unchanged";
  if (game.step.kind === "wolves" || answer.action.type === "continue") return "unchanged";
  try {
    applyAction(game, answer.action);
  } catch {
    return refuse(room, sender, "invalid-action");
  }
  plays.actions[id] = answer.action;
  // The Witch answers one question at a time: which one this answer was for.
  if (game.step.kind === "witch") (plays.asked ??= {})[id] = witchAsk(room) ?? "poison";
  return "changed";
}

const hasGameMaster = ({ room, state }: MessageContext) => !state.auto && !!room.game && !!state.game;

type AutoAnswer = (game: auto.AutoRoom, seatId: string, ctx: auto.AutoContext) => boolean;

/** Without a game master, the room plays the seat's answer itself. */
function answerAutoGame({ room, sender }: MessageContext, answer: AutoAnswer): Outcome {
  const game = autoRoom(room);
  const id = seatOf(room, sender);
  if (!game || !id) return "unchanged";
  return answer(game, id, autoContext(room)) ? "changed" : "unchanged";
}

export const phoneTurnMessages = {
  play: async (context, msg) => {
    if (hasGameMaster(context)) return playForGameMaster(context, { kind: "play", action: msg.action });
    const { room, sender } = context;
    const game = autoRoom(room);
    const id = seatOf(room, sender);
    if (!game || !id) return "unchanged";
    return auto.answer(game, id, msg.action, autoContext(room)) ? "changed" : refuse(room, sender, "invalid-action");
  },
  "wolf-pick": async (context, msg) => {
    if (hasGameMaster(context)) return playForGameMaster(context, { kind: "wolf-pick", targetId: msg.targetId });
    return answerAutoGame(context, (game, id, ctx) => auto.wolfPick(game, id, msg.targetId, ctx));
  },
  "more-time": async (context) => answerAutoGame(context, (game, id, ctx) => auto.moreTime(game, id, ctx)),
  ack: async (context) => answerAutoGame(context, (game, id, ctx) => auto.ack(game, id, ctx)),
  ready: async (context, msg) => answerAutoGame(context, (game, id, ctx) => auto.setReady(game, id, msg.value === true, ctx)),
  /** The narrator device finished reading a cue (it has no seat of its own, perhaps). */
  "cue-done": async ({ room, sender }, msg) => {
    const game = autoRoom(room);
    if (!game || sender.id !== speakerId(room)) return "unchanged";
    return auto.cueDone(game, msg.id, autoContext(room)) ? "changed" : "unchanged";
  },
} satisfies MessageHandlerGroup;
