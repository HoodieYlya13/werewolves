"use client";

import { useState } from "react";
import { Check, DoorOpen, Undo2, UserRoundPlus, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Avatar, useRoomContext } from "@/components/room-context";
import { format } from "@/lib/i18n/config";
import type { JoinRequest } from "@/lib/protocol";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

/**
 * People asking to come in: players who left, and new phones at a locked room
 * or during a game. Only the game master can let them in. While cards are
 * being picked (`onLobby`), they're let in from the lobby, or refused here.
 */
export function JoinRequests({ inGame, onLobby }: { inGame: boolean; onLobby?: () => void }) {
  const { requests, send } = useRoomContext();
  if (!send || !requests?.length) return null;

  return (
    <ul className="flex flex-col gap-2">
      {requests.map((request) => (
        <Request key={request.id} request={request} inGame={inGame} onLobby={onLobby} />
      ))}
    </ul>
  );
}

function Request({ request, inGame, onLobby }: { request: JoinRequest; inGame: boolean; onLobby?: () => void }) {
  const { dict } = useI18n();
  const { players, send } = useRoomContext();
  const [seatId, setSeatId] = useState("");
  const answer = (allow: boolean, seat?: string) => send?.({ type: "answer-request", requestId: request.id, allow, seatId: seat });
  const isNew = request.kind === "new";
  // During a game, a new phone can only play instead of someone (a lost phone,
  // another browser), never an account: that seat only goes back to its account.
  // In the lobby it's let in like anyone, and seated with the arrows.
  const seats = isNew && inGame ? players.filter((p) => !p.account) : [];
  const text = isNew ? dict.host.joinRequest : dict.host.rejoinRequest;

  return (
    <li role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-moon/40 bg-moon/10 px-4 py-3">
      <DoorOpen aria-hidden className="size-5 text-moon" />
      <Avatar playerId={request.id} name={request.name} />
      {/* Next to the seat list, the text keeps room to read; the controls wrap instead. */}
      <span className={`${seats.length > 0 ? "min-w-40" : "min-w-0"} flex-1 font-medium`}>{format(text, { name: request.name })}</span>
      {onLobby ? (
        <Button type="button" className="h-10 px-4" onClick={onLobby}>
          <Undo2 aria-hidden className="size-4" />
          {dict.host.answerInLobby}
        </Button>
      ) : (
        // During a game, a new phone can only take over a seat.
        !(isNew && inGame) && (
          <Button type="button" className="h-10 px-4" onClick={() => answer(true)}>
            <Check aria-hidden className="size-4" />
            {dict.host.letIn}
          </Button>
        )
      )}
      {seats.length > 0 && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (seatId) answer(true, seatId);
          }}
        >
          <NativeSelect aria-label={dict.host.pickSeat} value={seatId} onChange={(e) => setSeatId(e.target.value)}>
            <NativeSelectOption value="" disabled>
              {dict.host.pickSeat}
            </NativeSelectOption>
            {seats.map((p) => (
              <NativeSelectOption key={p.id} value={p.id}>
                {p.manual || p.connected ? p.name : `${p.name} (${dict.host.offline})`}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button type="submit" className="h-10 px-4" disabled={!seatId}>
            <UserRoundPlus aria-hidden className="size-4" />
            {dict.host.giveSeat}
          </Button>
        </form>
      )}
      <Button type="button" variant="outline" className="h-10 px-4" onClick={() => answer(false)}>
        <X aria-hidden className="size-4" />
        {dict.host.refuse}
      </Button>
    </li>
  );
}
