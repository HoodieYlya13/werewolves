import { assignRoles, dealRoles, EngineError, suggestedDeck, type GameSetup } from "../../lib/engine";
import * as auto from "../../lib/auto";
import type { ErrorCode, StartGame } from "../../lib/protocol";
import { type Conn, secureRandom } from "./state";
import type { RoomServer } from "../server";

export function buildSetup(room: RoomServer, start: StartGame, config?: auto.AutoConfig): GameSetup {
  const players = room.state!.players.map(({ id, name, seat }) => ({ id, name, seat }));
  const options = { actorCards: start.actorCards, groups: start.groups };
  if (config) {
    // Without a game master nobody may know who got what: always dealt at random.
    if (start.mode !== "random") throw new EngineError("invalid-setup", "Cards are dealt at random without a game master");
    const deck = config.deck === "hidden" ? suggestedDeck(players.length, config.style, secureRandom, config.exclude) : start.deck;
    return dealRoles(players, deck, start.settings, config.deck === "hidden" ? {} : options, secureRandom);
  }
  return start.mode === "random"
    ? dealRoles(players, start.deck, start.settings, options, secureRandom)
    : assignRoles(players, start.assignment, start.extraCards, start.settings, options);
}

export function sendEngineError(room: RoomServer, conn: Conn, error: unknown, code: ErrorCode) {
  if (!(error instanceof EngineError)) throw error;
  room.send(conn, { type: "error", code, detail: error.message });
}
