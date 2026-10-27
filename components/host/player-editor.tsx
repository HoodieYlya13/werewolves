"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { PhotoPicker } from "@/components/photo-picker";
import { Avatar, useRoomContext } from "@/components/room-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "@/lib/i18n/config";
import { MAX_NAME_LENGTH } from "@/lib/protocol";

/** The game master renames a player or sets their photo, in the lobby or mid-game. */
export function PlayerEditor({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const { dict } = useI18n();
  const { players, send } = useRoomContext();
  const player = players.find((p) => p.id === playerId);
  const [name, setName] = useState(player?.name ?? "");

  if (!player || !send) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={dict.host.close} className="max-w-[min(26rem,calc(100vw-2rem))] sm:max-w-[26rem]">
        <DialogHeader>
          <DialogTitle>{format(dict.host.editPlayer, { name: player.name })}</DialogTitle>
          <DialogDescription className="sr-only">{dict.host.name}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col items-center gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && name.trim() !== player.name) send({ type: "rename-player", playerId, name });
            onClose();
          }}
        >
          <Avatar playerId={player.id} name={player.name} className="size-28 text-4xl" />
          <PhotoPicker hasPhoto={player.photo !== null} onChange={(data) => send({ type: "set-photo", playerId, data })} />
          <div className="flex w-full flex-col gap-1.5">
            <Label htmlFor="player-name">{dict.host.name}</Label>
            <Input id="player-name" maxLength={MAX_NAME_LENGTH} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={!name.trim()}>
            {dict.host.save}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
