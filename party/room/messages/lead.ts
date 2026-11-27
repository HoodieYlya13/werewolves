import * as auto from "../../../lib/auto";
import { isLocale } from "../../../lib/i18n/config";
import { refuse, type MessageHandlerGroup } from "./handler";
import { autoRoom, keepAuto, resumeAuto, suddenDeath, speakerId } from "../auto-runner";
import { reclaimMaster, transferLead } from "../lead";

export const leadMessages = {
  "reclaim-master": async ({ room, sender }, msg) => {
    // Saves and tells everyone itself.
    await reclaimMaster(room, sender, msg.ticket);
    return "unchanged";
  },
  "give-lead": async ({ room, sender, isHost }, msg) => {
    if (!isHost) return refuse(room, sender, "not-host");
    if (!(await transferLead(room, msg.playerId))) return refuse(room, sender, "invalid-action");
    return "changed";
  },
  pause: async ({ room, isHost, state }, msg) => {
    const autoGame = autoRoom(room);
    if (!isHost || !autoGame || room.game!.winner) return "unchanged";
    const now = Date.now();
    if (msg.value) {
      // By day only: a night stopped halfway would leave everyone with their eyes closed.
      if (state.paused || (room.game!.phase.kind === "night" && room.game!.step.kind !== "prologue")) return "unchanged";
      auto.pause(autoGame, now);
      state.paused = "manual";
    } else {
      if (!state.paused) return "unchanged";
      // Resumed without them: the leader whose device went silent comes back as a player.
      if (state.lostLeader) state.lostLeader.settled = true;
      resumeAuto(room);
      await room.done();
      return "unchanged";
    }
    keepAuto(room, autoGame);
    return "changed";
  },
  "sudden-death": async ({ room, isHost }, msg) => {
    if (!isHost || !autoRoom(room) || !room.game?.players.find((p) => p.id === msg.playerId)?.alive) return "unchanged";
    suddenDeath(room, msg.playerId);
    return "changed";
  },
  succession: async ({ room, isHost, state }, msg) => {
    // The new leader's call about the one whose device went silent: out for good, announced like any sudden death.
    const lost = state.lostLeader;
    if (!isHost || !lost || lost.settled || !msg.dead) return "unchanged";
    lost.settled = true;
    if (room.game?.players.find((p) => p.id === lost.seatId)?.alive) suddenDeath(room, lost.seatId);
    else resumeAuto(room);
    return "changed";
  },
  "set-locale": async ({ room, sender, isHost, state }, msg) => {
    // The leader or the narrator device picks the narration's language.
    if (!autoRoom(room) || !isLocale(msg.locale) || (!isHost && sender.id !== speakerId(room))) return "unchanged";
    state.locale = msg.locale;
    return "changed";
  },
} satisfies MessageHandlerGroup;
