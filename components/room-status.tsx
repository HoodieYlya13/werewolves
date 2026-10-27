"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import type { RoomStatus } from "@/hooks/use-room";
import type { ErrorCode } from "@/lib/protocol";

/** Connecting / reconnecting banner. Shown above the room screens. */
export function ConnectionBanner({ status }: { status: RoomStatus }) {
  const { dict } = useI18n();
  if (status === "open") return null;
  return (
    <p role="status" className="mx-auto mb-4 w-fit rounded-full bg-surface-2 px-4 py-1.5 text-sm text-muted-foreground">
      {status === "connecting" ? dict.connection.connecting : dict.connection.reconnecting}
    </p>
  );
}

/** Full-screen message for errors that end the session (wrong code, kicked…). */
export function FatalError({ code }: { code: ErrorCode }) {
  const { dict, locale } = useI18n();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="text-lg">{dict.errors[code]}</p>
      <Button asChild variant="outline">
        <Link href={`/${locale}`}>{dict.errors.backHome}</Link>
      </Button>
    </main>
  );
}
