"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { generateRoomCode, identity } from "@/lib/room";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const hostPage = (locale: string, code: string) => `/${locale}/host/${code}` as const;

export function CreateRoomButton() {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const nextCode = useRef<string | null>(null);
  const [isOpening, startOpening] = useTransition();

  // Picked ahead, so the room's page is already loaded when the button is pressed.
  useEffect(() => {
    const code = generateRoomCode();
    nextCode.current = code;
    router.prefetch(hostPage(locale, code));
  }, [router, locale]);

  function create() {
    const code = nextCode.current ?? generateRoomCode();
    identity.setHost(code, { token: crypto.randomUUID(), isNew: true });
    startOpening(() => router.push(hostPage(locale, code)));
  }

  return (
    <Button type="button" className="mt-auto" aria-busy={isOpening} onClick={create}>
      {isOpening && <Spinner />}
      {dict.home.createRoom}
    </Button>
  );
}
