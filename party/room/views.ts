import { playerInfo, publicGame, hasLeadLine, type GameState } from "../../lib/engine";
import * as auto from "../../lib/auto";
import type { WitchAsk } from "../../lib/auto";
import { sceneFor } from "../../lib/soundtrack";
import type { PlayerView, PublicPlayer, RoomView } from "../../lib/protocol";
import type { ConnState, Conn } from "./state";
import { hostSeat } from "./seats";
import { claimFor } from "./stats";
import { autoRoom, mayorRaceOpen, narration, speakerId } from "./auto-runner";
import { masterAwayFor } from "./lead";
import type { RoomServer } from "../server";

export function viewFor(room: RoomServer, conn: Conn, speakerConnId = speakerId(room)): RoomView {
  const s = room.state!;
  const players = s.players
    .map(
      ({ id, name, seat, connected, manual, photo, left, sub, picture }): PublicPlayer => ({
        id,
        name,
        seat,
        connected,
        manual,
        photo: photo ?? null,
        left: !!left,
        account: !!sub,
        picture: sub ? (picture ?? null) : null,
      }),
    )
    .sort((a, b) => a.seat - b.seat);
  const phase = !room.game ? "lobby" : room.game.winner ? "ended" : "playing";
  const base = {
    code: s.code,
    phase,
    locked: s.locked,
    players,
    timer: s.timer ?? null,
    serverNow: Date.now(),
    mode: s.mode ?? "master",
    candidates: room.game && !room.game.mayorElected ? (s.candidates ?? []) : [],
  } as const;
  if (conn.state?.kind === "host") {
    const seatId = hostSeat(room)?.id ?? null;
    // Without a game master the creator plays: once the game is on, they see only their own seat.
    const playing = !!seatId && !!room.game && !!s.auto;
    return {
      ...base,
      kind: "host",
      game: playing ? null : room.game,
      seatId,
      seat: seatId && room.game ? phoneView(room, base, players, seatId, conn.id === speakerConnId) : null,
      actionCount: s.game?.log.length ?? 0,
      canResume: !!s.endedGame,
      ballot: playing ? null : (s.ballot ?? null),
      phonePlays:
        !s.auto && s.phonePlays && s.phonePlays.at === s.game?.log.length
          ? { actions: s.phonePlays.actions, wolfPicks: s.phonePlays.wolfPicks, asked: s.phonePlays.asked ?? {} }
          : null,
      paused: !!s.paused,
      lostLeader: s.lostLeader && !s.lostLeader.settled ? { name: s.lostLeader.name } : null,
      requests: (s.requests ?? []).map(({ id, name, kind, account }) => ({ id, name, kind: kind ?? "rejoin", account: !!account })),
      handover: s.handover
        ? { name: s.players.find((p) => p.id === s.handover!.before.id)?.name ?? "", seatName: s.handover.before.name }
        : null,
    };
  }
  const state = conn.state;
  const view = phoneView(room, base, players, state?.kind === "player" ? state.playerId : null, conn.id === speakerConnId, state?.kind === "guest" && !!state.spectator);
  view.masterAway = masterAwayFor(room, state);
  let rejoin: PlayerView["rejoin"] = null;
  if (state?.kind === "returning") {
    const request = s.requests?.find((r) => r.id === state.playerId);
    const known = [...s.players, ...(s.formerPlayers ?? [])].find((p) => p.id === state.playerId);
    rejoin = {
      name: request?.name ?? known?.name ?? "",
      account: !!known?.sub,
      status: request ? "pending" : s.deniedIds?.includes(state.playerId) ? "denied" : "idle",
    };
  }
  let knock: PlayerView["knock"] = null;
  if (state?.kind === "guest" && state.deviceId) {
    const request = s.requests?.find((r) => r.kind === "new" && r.id === state.deviceId);
    if (request) knock = { name: request.name, status: "pending" };
    else if (s.deniedIds?.includes(state.deviceId)) knock = { name: "", status: "denied" };
  }
  const seat = state?.kind === "locked" ? s.players.find((p) => p.id === state.playerId) : null;
  return { ...view, rejoin, knock, lockedSeat: seat ? { name: seat.name, picture: seat.picture ?? null } : null };
}

/** How one seat sees the room: public info, its own card, its turn. */
export function phoneView(room: RoomServer, base: Pick<PlayerView, "code" | "phase" | "locked" | "players" | "timer" | "serverNow" | "mode" | "candidates">, players: PublicPlayer[], playerId: string | null, speaking: boolean, spectator = false): PlayerView {
  const s = room.state!;
  const me = playerId ? players.find((p) => p.id === playerId) : undefined;
  const game = room.game;
  const info = me && game ? playerInfo(game, me.id) : null;
  const ballot = s.ballot;
  const phoneBallot =
    ballot && me
      ? {
          kind: ballot.kind ?? "vote",
          candidateIds: ballot.candidateIds,
          canVote: ballot.voterIds.includes(me.id),
          voted: me.id in ballot.votes,
          targetId: ballot.votes[me.id] ?? null,
          answered: ballot.voterIds.filter((id) => id in ballot.votes).length,
          voters: ballot.voterIds.length,
        }
      : null;
  const autoGame = autoRoom(room);
  const dict = autoGame ? narration(room) : null;
  const config = s.game?.auto;
  return {
    ...base,
    kind: "player",
    me: me ?? null,
    lockedSeat: null,
    info,
    game: game ? publicGame(game) : null,
    ballot: phoneBallot,
    rejoin: null,
    knock: null,
    renamed: !!(me && s.players.find((p) => p.id === me.id)?.renamed),
    claim: me ? claimFor(room, me.id) : null,
    host: s.hostSub && !s.hostSeatId ? (s.hostFace ?? null) : null,
    turn: me && game ? (autoGame && dict ? auto.phoneTurn(autoGame, me.id, dict) : masterTurn(room, game, me.id)) : null,
    pause: autoGame && s.paused ? { reason: s.paused, leader: (s.paused === "leader" && s.lostLeader?.name) || (hostSeat(room)?.name ?? ""), next: hostSeat(room)?.name ?? "" } : null,
    masterGone: !autoGame && !!s.masterGone && !!game && !game.winner,
    masterAway: null,
    auto: autoGame && dict ? auto.autoPublic(autoGame, me?.id ?? null, dict) : null,
    speaker: autoGame && speaking ? { cue: autoGame.auto.cue, scene: game!.winner ? null : sceneFor(game!), locale: s.locale ?? "en", game: s.game?.id ?? "" } : null,
    // The dead see everything, without a game master: there's nobody else to watch the game with.
    spectate: (autoGame && info && !info.alive) || (spectator && game) ? game : null,
    canStand: !!info?.alive && mayorRaceOpen(room),
    deck: game && config?.deck === "open" ? [...game.setup.players.map((p) => game.setup.roles[p.id]), ...game.setup.extraCards].sort() : null,
  };
}

/** With a game master: what a phone may play for the current step, if its player likes. */
export function masterTurn(room: RoomServer, game: GameState, playerId: string) {
  const s = room.state!;
  // Not while the game master still reads the last turn's "go back to sleep": that phone would light up too soon.
  if (hasLeadLine(game) && s.leadReadAt !== s.game?.log.length) return null;
  const plays = s.phonePlays?.at === s.game?.log.length ? s.phonePlays : null;
  const action = plays?.actions[playerId];
  const ask = witchAsk(room);
  if (game.step.kind === "witch" && ask) {
    // The Witch's phone asks what the game master asks, when they ask it.
    const asked = plays?.asked?.[playerId];
    const turn = auto.turnFor(game, playerId, "turn", asked === "poison", {});
    if (turn?.kind !== "witch") return turn;
    return { ...turn, ask, healed: asked && action?.type === "witch" ? action.heal : null };
  }
  return auto.turnFor(game, playerId, auto.masterShow(game.step), !!action, plays?.wolfPicks ?? {});
}

/** The Witch's question the game master is on, if they said (older screens don't). */
export function witchAsk(room: RoomServer): WitchAsk | null {
  const s = room.state!;
  return room.game?.step.kind === "witch" && s.masterStage && s.masterStage.at === s.game?.log.length ? s.masterStage.stage : null;
}

/** Every socket gets its own filtered view, so secrets never reach the wrong phone. */
export function broadcastViews(room: RoomServer) {
  const speakerConnId = speakerId(room);
  for (const conn of room.getConnections<ConnState>()) {
    room.send(conn, { type: "view", view: viewFor(room, conn, speakerConnId) });
  }
}
