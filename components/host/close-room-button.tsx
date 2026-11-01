"use client";

import { useRouter } from "next/navigation";
import { DoorClosed } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { useI18n } from "@/components/i18n-provider";
import { useRoomContext } from "@/components/room-context";
import { identity } from "@/lib/room";
import { cn } from "@/lib/utils";

/** Disconnects every phone, deletes the room and goes home (null for phones). */
export function useCloseRoom() {
  const { locale } = useI18n();
  const { code, send } = useRoomContext();
  const router = useRouter();
  if (!send) return null;
  return () => {
    send({ type: "close-room" });
    identity.setHost(code, null);
    router.push(`/${locale}`);
  };
}

/** Disconnects every phone and deletes the room, after a confirmation. */
export function CloseRoomButton({ className = "" }: { className?: string }) {
  const { dict } = useI18n();
  const closeRoom = useCloseRoom();
  if (!closeRoom) return null;

  return (
    <ConfirmButton
      type="button"
      variant="outline"
      className={cn("text-primary", className)}
      title={dict.host.closeRoomConfirm.title}
      description={dict.host.closeRoomConfirm.body}
      action={dict.host.closeRoom}
      onConfirm={closeRoom}
    >
      <DoorClosed aria-hidden className="size-4" />
      {dict.host.closeRoom}
    </ConfirmButton>
  );
}
