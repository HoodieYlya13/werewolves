"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { CODE_LENGTH, isRoomCode, normalizeRoomCode } from "@/lib/room";

export function JoinForm() {
  const { dict, locale } = useI18n();
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <form
      className="mt-auto flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (isRoomCode(code)) router.push(`/${locale}/play/${code}`);
      }}
    >
      <input
        className="input text-center font-mono text-lg tracking-[0.4em] uppercase"
        aria-label={dict.home.roomCode}
        placeholder={"•".repeat(CODE_LENGTH)}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        value={code}
        onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
      />
      <button type="submit" className="btn btn-ghost" disabled={!isRoomCode(code)}>
        {dict.home.join}
      </button>
    </form>
  );
}
