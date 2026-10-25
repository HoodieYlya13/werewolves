"use client";

import { useRouter } from "next/navigation";
import { DoorClosed } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useRoomContext } from "@/components/room-context";
import { identity } from "@/lib/room";

/** Disconnects every phone and deletes the room, after a confirmation. */
export function CloseRoomButton({ className = "" }: { className?: string }) {
  const { dict, locale } = useI18n();
  const { code, send } = useRoomContext();
  const router = useRouter();
  if (!send) return null;

  function closeRoom() {
    if (!window.confirm(dict.host.closeRoomConfirm)) return;
    send!({ type: "close-room" });
    identity.setHost(code, null);
    router.push(`/${locale}`);
  }

  return (
    <button type="button" className={`btn btn-ghost text-accent ${className}`} onClick={closeRoom}>
      <DoorClosed aria-hidden className="size-4" />
      {dict.host.closeRoom}
    </button>
  );
}
