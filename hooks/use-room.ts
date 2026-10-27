"use client";

import { useState } from "react";
import usePartySocket from "partysocket/react";
import type { ClientMessage, ConnectQuery, ErrorCode, RoomView, ServerMessage } from "@/lib/protocol";
import { identity, partyHost } from "@/lib/room";

/** Errors after which reconnecting is pointless. */
const FATAL: ErrorCode[] = ["room-not-found", "room-taken", "not-host", "room-closed"];

export type RoomStatus = "connecting" | "open" | "reconnecting";

/** Server clock minus this device's clock, measured when a view arrives. */
function offsetFrom(serverNow: number) {
  return serverNow - Date.now();
}

/**
 * Connects to a room as the game master or as a phone. Must only render on the
 * client (it reads localStorage and window.location).
 */
export function useRoom<V extends RoomView>(code: string, as: V["kind"]) {
  const [view, setView] = useState<V | null>(null);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [clockOffset, setClockOffset] = useState(0);
  // The account has a seat in another room; set until the phone answers.
  const [otherRoom, setOtherRoom] = useState<{ room: string; inGame: boolean } | null>(null);

  const socket = usePartySocket({
    host: partyHost(),
    room: code,
    // A function, so each reconnect picks up an identity saved since the last one.
    query: (): ConnectQuery => {
      if (as === "host") return { as, token: identity.getHost(code)?.token ?? "", create: "1" };
      // A seat saved for this room, or else this device's id so a player who
      // left is recognised when they come back.
      const player = identity.getPlayer(code) ?? identity.device();
      return { as, id: player.id, token: player.token };
    },
    onOpen: () => setStatus("open"),
    onClose: () => setStatus((s) => (s === "open" ? "reconnecting" : s)),
    onMessage: (event) => {
      const msg = JSON.parse(event.data as string) as ServerMessage;
      switch (msg.type) {
        case "view":
          // Stored identity that the room no longer knows (removed, room reset).
          if (msg.view.kind === "player" && !msg.view.me && !msg.view.rejoin) identity.setPlayer(code, null);
          setView(msg.view as V);
          setClockOffset(offsetFrom(msg.view.serverNow));
          setError(null);
          break;
        case "joined":
          identity.setPlayer(code, { id: msg.playerId, token: msg.token });
          break;
        case "other-room":
          setOtherRoom({ room: msg.room, inGame: msg.inGame });
          break;
        case "error":
          if (["removed", "signed-in-elsewhere", "left-elsewhere", "moved-room"].includes(msg.code)) identity.setPlayer(code, null);
          if (msg.code === "room-closed") {
            identity.setPlayer(code, null);
            identity.setHost(code, null);
          }
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

  /** Stops reconnecting, e.g. after leaving the room. */
  function close() {
    socket.close();
  }

  /** Resolves once sent messages have left the browser, before navigating away. */
  function flushed() {
    return new Promise<void>((resolve) => {
      const started = Date.now();
      const check = () => (socket.bufferedAmount === 0 || Date.now() - started > 1000 ? resolve() : setTimeout(check, 20));
      check();
    });
  }

  return { view, error, status, send, clockOffset, close, flushed, otherRoom, clearOtherRoom: () => setOtherRoom(null) };
}
