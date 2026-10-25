"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { PhotoPicker } from "@/components/photo-picker";
import { Avatar, useRoomContext } from "@/components/room-context";
import { format } from "@/lib/i18n/config";
import { MAX_NAME_LENGTH } from "@/lib/protocol";

/** The game master renames a player or sets their photo, in the lobby or mid-game. */
export function PlayerEditor({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const { dict } = useI18n();
  const { players, send } = useRoomContext();
  const player = players.find((p) => p.id === playerId);
  const [name, setName] = useState(player?.name ?? "");
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  if (!player || !send) return null;

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-fg backdrop:bg-black/60"
    >
      <form
        method="dialog"
        className="flex flex-col items-center gap-4 p-6"
        onSubmit={(e) => {
          if (name.trim() && name.trim() !== player.name) {
            e.preventDefault();
            send({ type: "rename-player", playerId, name });
            dialog.current?.close();
          }
        }}
      >
        <div className="flex w-full items-center justify-between">
          <h2 className="text-lg font-semibold">{format(dict.host.editPlayer, { name: player.name })}</h2>
          <button type="button" aria-label={dict.host.close} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2" onClick={() => dialog.current?.close()}>
            <X className="size-4" />
          </button>
        </div>
        <Avatar playerId={player.id} name={player.name} className="size-28 text-4xl" />
        <PhotoPicker hasPhoto={player.photo !== null} onChange={(data) => send({ type: "set-photo", playerId, data })} />
        <label className="flex w-full flex-col gap-1 text-sm font-medium">
          {dict.host.name}
          <input
            className="input text-base"
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button type="submit" className="btn w-full" disabled={!name.trim()}>
          {dict.host.save}
        </button>
      </form>
    </dialog>
  );
}
