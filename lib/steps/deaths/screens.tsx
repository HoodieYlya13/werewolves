"use client";

import { useI18n } from "@/components/i18n-provider";
import { RoleName } from "@/components/game/role-chip";
import { format } from "@/lib/i18n/config";
import { shownCard } from "@/lib/engine";
import { announcedDeaths, announcesPowersLost, nobodyDiedLine } from "./steps";
import { Say, ContinueButton, type StepProps, type StepScreens } from "@/components/host/step-parts";

function DeathsStep({ game, step, act }: StepProps<"deaths">) {
  const { dict } = useI18n();
  const t = dict.game.steps.deaths;
  const reveal = game.setup.settings.revealRoleOnDeath;
  const deaths = announcedDeaths(dict, game, step);

  return (
    <>
      <Say>{t[step.context]}</Say>
      {deaths.length === 0 ? (
        <Say>{nobodyDiedLine(dict, game)}</Say>
      ) : (
        <ul className="flex flex-col gap-3">
          {deaths.map((d) => {
            const player = game.players.find((p) => p.id === d.playerId)!;
            return (
              <li key={d.playerId} className="card flex flex-col gap-1 px-5 py-4">
                <p className="text-xl text-balance">{d.line}</p>
                <p className="text-muted-foreground">
                  {reveal ? (
                    <>
                      {t.reveal}{" "}
                      <RoleName role={shownCard(player)} className="font-semibold" />
                    </>
                  ) : (
                    t.hidden
                  )}
                </p>
                {step.context === "dawn" && d.cause !== "grief" && (
                  <p className="secret-role secret-text text-sm text-muted-foreground">
                    {format(t.secret, { cause: dict.game.causes[d.cause] })}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {announcesPowersLost(game, step) && <Say>{t.powersLost}</Say>}
      <ContinueButton act={act} />
    </>
  );
}

export const deathsScreens: StepScreens<"deaths"> = {
  deaths: { Screen: DeathsStep },
};
