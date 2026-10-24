"use client";

import { useState } from "react";
import usePartySocket from "partysocket/react";
import type { ClientMessage, ConnectQuery, ErrorCode, RoomView, ServerMessage } from "@/lib/protocol";
import { identity, partyHost } from "@/lib/room";

/** Errors after which reconnecting is pointless. */
const FATAL: ErrorCode[] = ["room-not-found", "room-taken", "not-host"];

export type RoomStatus = "connecting" | "open" | "reconnecting";

/**
 * Connects to a room as the game master or as a phone. Must only render on the
 * client (it reads localStorage and window.location).
 */
export function useRoom<V extends RoomView>(code: string, as: V["kind"]) {
  const [view, setView] = useState<V | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [status, setStatus] = useState<RoomStatus>("connecting");

  const socket = usePartySocket({
    host: partyHost(),
    room: code,
    // A function, so each reconnect picks up an identity saved since the last one.
    query: (): ConnectQuery => {
      if (as === "host") return { as, token: identity.getHost(code)?.token ?? "", create: "1" };
      const player = identity.getPlayer(code);
      return player ? { as, id: player.id, token: player.token } : { as };
    },
    onOpen: () => setStatus("open"),
    onClose: () => setStatus((s) => (s === "open" ? "reconnecting" : s)),
    onMessage: (event) => {
      const msg = JSON.parse(event.data as string) as ServerMessage;
      switch (msg.type) {
        case "view":
          // Stored identity that the room no longer knows (removed, room reset).
          if (msg.view.kind === "player" && !msg.view.me) identity.setPlayer(code, null);
          setView(msg.view as V);
          setError(null);
          break;
        case "joined":
          identity.setPlayer(code, { id: msg.playerId, token: msg.token });
          break;
        case "error":
          if (msg.code === "removed") identity.setPlayer(code, null);
          if (FATAL.includes(msg.code)) socket.close();
          setError(msg.code);
          break;
      }
    },
  });

  function send(message: ClientMessage) {
    setError(null);
    socket.send(JSON.stringify(message));
  }

  return { view, error, status, send };
}
