"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { ConnectionBanner, FatalError } from "@/components/room-status";
import { useRoom } from "@/hooks/use-room";
import { format } from "@/lib/i18n/config";
import { MAX_NAME_LENGTH, type PlayerView } from "@/lib/protocol";

export function PlayerRoom() {
  const { code } = useParams<{ code: string }>();
  return <PlayerScreen key={code} code={code} />;
}

function PlayerScreen({ code }: { code: string }) {
  const { dict } = useI18n();
  const { view, error, status, send } = useRoom<PlayerView>(code, "player");
  const [name, setName] = useState("");

  if (error === "room-not-found") return <FatalError code={error} />;

  const me = view?.me;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pb-10">
      <ConnectionBanner status={status} />
      <p className="text-center font-mono text-sm tracking-[0.3em] text-muted">{code}</p>

      {error === "removed" && (
        <p role="alert" className="text-center text-accent">
          {dict.errors.removed}
        </p>
      )}

      {view && !me && (
        <form
          className="card flex flex-col gap-3 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) send({ type: "join", name });
          }}
        >
          <label htmlFor="name" className="font-medium">
            {dict.play.yourName}
          </label>
          <input
            id="name"
            className="input text-lg"
            autoComplete="nickname"
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="btn" disabled={!name.trim()}>
            {dict.play.join}
          </button>
          {(error === "name-taken" || error === "invalid-name" || error === "room-locked") && (
            <p role="alert" className="text-sm text-accent">
              {dict.errors[error]}
            </p>
          )}
        </form>
      )}

      {me && (
        <section className="card flex flex-col items-center gap-2 p-6 text-center">
          <p className="text-xl font-semibold">{format(dict.play.joinedAs, { name: me.name })}</p>
          <p className="text-muted">{dict.play.waiting}</p>
        </section>
      )}

      {view && view.players.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted">{dict.play.roomPlayers}</h2>
          <ul className="flex flex-wrap gap-2">
            {view.players.map((p) => (
              <li
                key={p.id}
                className={`rounded-full px-3 py-1 text-sm ${p.id === me?.id ? "bg-accent text-accent-fg" : "bg-surface-2"}`}
              >
                {p.name}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
