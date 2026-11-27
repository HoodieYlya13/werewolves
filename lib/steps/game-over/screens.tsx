"use client";

import { CircleUserRound, Trophy } from "lucide-react";
import { AuthButton } from "@/components/account-button";
import { useI18n } from "@/components/i18n-provider";
import { RoleName } from "@/components/host/role-chip";
import { useSession } from "@/lib/session";
import { Say, type StepProps, type StepScreens } from "@/components/host/step-parts";

function GameOverStep({ game, step }: StepProps<"game-over">) {
  const { dict } = useI18n();
  const session = useSession();
  const t = dict.game.steps["game-over"];
  const { team, playerIds } = step.winner;
  return (
    <>
      <Say>{dict.game.story.epilogue[team ?? "draw"]}</Say>
      <div className="card flex flex-col items-center gap-5 px-6 py-10 text-center">
        <Trophy aria-hidden className="size-12 text-moon" />
        <p className="font-display text-3xl font-bold sm:text-4xl">{team ? t.wins[team] : t.draw}</p>
        {playerIds.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium tracking-wide text-muted-foreground uppercase">{t.winners}</p>
            <ul className="flex flex-wrap justify-center gap-2">
              {playerIds.map((id) => {
                const p = game.players.find((pl) => pl.id === id)!;
                return (
                  <li key={id} className="rounded-full bg-surface-2 px-3 py-1">
                    {p.name} · <RoleName role={p.role} className="text-sm" />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {/* Signing in now still counts it: the room saves the result again with the master's account. */}
        {session?.stats && !session.account && (
          <AuthButton
            to="in"
            variant="link"
            className="h-auto p-0 text-sm font-normal whitespace-normal text-muted-foreground underline"
          >
            <CircleUserRound aria-hidden className="size-4 shrink-0" />
            {dict.account.keepMastered}
          </AuthButton>
        )}
      </div>
    </>
  );
}

export const gameOverScreens: StepScreens<"game-over"> = {
  "game-over": { Screen: GameOverStep },
};
