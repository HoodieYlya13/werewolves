"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { generateRoomCode, identity } from "@/lib/room";

export function CreateRoomButton() {
  const { dict, locale } = useI18n();
  const router = useRouter();

  function create() {
    const code = generateRoomCode();
    identity.setHost(code, { token: crypto.randomUUID() });
    router.push(`/${locale}/host/${code}`);
  }

  return (
    <button type="button" className="btn mt-auto" onClick={create}>
      {dict.home.createRoom}
    </button>
  );
}
