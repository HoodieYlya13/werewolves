"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { format } from "@/lib/i18n/config";

/**
 * A button that opens a full-screen panel to hand the device to one player.
 * The panel covers everything else (players, roles, timeline), so the player
 * only sees what they are allowed to see.
 */
export function Reveal({ to, children }: { to: string; children: React.ReactNode }) {
  const { dict } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="btn h-12 self-start px-6 text-base" onClick={() => setOpen(true)}>
        <Eye aria-hidden className="size-5" />
        {format(dict.game.showTo, { name: to })}
      </button>
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 overflow-y-auto bg-bg p-6 pt-[max(1.5rem,env(safe-area-inset-top))] text-center"
          >
            <div className="flex w-full max-w-xl flex-col items-center gap-6">{children}</div>
            <button type="button" className="btn btn-ghost h-12 px-6" onClick={() => setOpen(false)}>
              <EyeOff aria-hidden className="size-5" />
              {dict.game.hide}
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
