"use client";

import { Check, DoorOpen, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Avatar, useRoomContext } from "@/components/room-context";
import { format } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";

/** Players who left and ask to come back. Only the game master can let them in. */
export function RejoinRequests() {
  const { dict } = useI18n();
  const { requests, send } = useRoomContext();
  if (!send || !requests?.length) return null;

  return (
    <ul className="flex flex-col gap-2">
      {requests.map((request) => (
        <li
          key={request.id}
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-moon/40 bg-moon/10 px-4 py-3"
        >
          <DoorOpen aria-hidden className="size-5 text-moon" />
          <Avatar playerId={request.id} name={request.name} />
          <span className="min-w-0 flex-1 font-medium">{format(dict.host.rejoinRequest, { name: request.name })}</span>
          <Button
            type="button"
            className="h-10 px-4"
            onClick={() => send({ type: "answer-rejoin", playerId: request.id, allow: true })}
          >
            <Check aria-hidden className="size-4" />
            {dict.host.letIn}
          </Button>
          <Button
            type="button"
            variant="outline" className="h-10 px-4"
            onClick={() => send({ type: "answer-rejoin", playerId: request.id, allow: false })}
          >
            <X aria-hidden className="size-4" />
            {dict.host.refuse}
          </Button>
        </li>
      ))}
    </ul>
  );
}
