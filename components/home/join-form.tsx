"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { CODE_LENGTH, isRoomCode, normalizeRoomCode } from "@/lib/room";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function JoinForm() {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const [code, setCode] = useState("");
  const isComplete = isRoomCode(code);
  const roomPage = `/${locale}/play/${code}` as const;
  const [isOpening, startOpening] = useTransition();

  // A whole code typed: its page loads while the finger moves to the button.
  useEffect(() => {
    if (isComplete) router.prefetch(roomPage);
  }, [isComplete, router, roomPage]);

  return (
    <form
      className="mt-auto flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (isComplete) startOpening(() => router.push(roomPage));
      }}
    >
      <Input
        className="text-center font-mono text-lg tracking-[0.4em] uppercase"
        aria-label={dict.home.roomCode}
        placeholder={"•".repeat(CODE_LENGTH)}
        autoComplete="off"
        autoCapitalize="characters"
        // iOS would "correct" a code like HNPQ into a word.
        autoCorrect="off"
        spellCheck={false}
        value={code}
        onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
      />
      <Button type="submit" variant="outline" aria-busy={isOpening} disabled={!isComplete}>
        {isOpening && <Spinner />}
        {dict.home.join}
      </Button>
    </form>
  );
}
