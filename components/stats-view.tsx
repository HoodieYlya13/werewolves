"use client";

import { useEffect, useState } from "react";
import { Crown, HeartPulse, Swords, Trophy } from "lucide-react";
import { AuthButton } from "@/components/account-button";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import type { RoleId, Team } from "@/lib/engine";
import { format } from "@/lib/i18n/config";
import { freshIdToken, useSession } from "@/lib/session";
import type { AccountStats } from "@/lib/stats";

/** The signed-in account's stats, from the games it played or ran. */
export function StatsView() {
  const { dict } = useI18n();
  const session = useSession();
  const sub = session?.account?.sub;
  const [stats, setStats] = useState<{ sub: string; value: AccountStats | "failed" } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!sub) return;
    let cancelled = false;
    void (async () => {
      const idToken = await freshIdToken();
      const res = idToken ? await fetch("/api/stats", { headers: { Authorization: `Bearer ${idToken}` }, cache: "no-store" }).catch(() => null) : null;
      const value: AccountStats | "failed" = res?.ok ? await res.json() : "failed";
      if (!cancelled) setStats({ sub, value });
    })();
    return () => {
      cancelled = true;
    };
  }, [sub, attempt]);

  if (!session) return null;
  if (!session.stats) return <Message>{dict.stats.unavailable}</Message>;
  if (!session.account) {
    return (
      <Message>
        {dict.stats.signIn}
        <AuthButton to="in">{dict.account.signIn}</AuthButton>
      </Message>
    );
  }
  // Still loading, or loaded for an account that has since changed.
  if (!stats || stats.sub !== sub) return <Message>…</Message>;
  if (stats.value === "failed") {
    return (
      <Message>
        {dict.stats.failed}
        <Button type="button" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
          {dict.stats.retry}
        </Button>
      </Message>
    );
  }
  return <Stats stats={stats.value} />;
}

function Stats({ stats }: { stats: AccountStats }) {
  const { dict, locale } = useI18n();
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  const rate = (part: number, whole: number) => (whole ? percent.format(part / whole) : "–");
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const roleName = (role: string) => dict.roles[role as RoleId]?.name ?? role;
  const teamName = (team: string | null) => (team ? (dict.teams[team as Team] ?? team) : "–");

  if (stats.played === 0 && stats.mastered === 0) return <Message>{dict.stats.empty}</Message>;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile icon={Swords} label={dict.stats.played} value={String(stats.played)} />
        <Tile
          icon={Trophy}
          label={dict.stats.winRate}
          value={rate(stats.won, stats.played)}
          detail={format(dict.stats.wonOf, { won: String(stats.won), played: String(stats.played) })}
        />
        <Tile
          icon={HeartPulse}
          label={dict.stats.survival}
          value={rate(stats.survived, stats.played)}
          detail={format(dict.stats.survivedOf, { survived: String(stats.survived), played: String(stats.played) })}
        />
        <Tile
          icon={Crown}
          label={dict.stats.mastered}
          value={String(stats.mastered)}
          detail={format(dict.stats.masteredShare, { share: rate(stats.mastered, stats.played + stats.mastered) })}
        />
      </div>

      {stats.teams.length > 0 && (
        <section className="card flex flex-col gap-3 p-5">
          <h2 className="font-semibold">{dict.stats.sides}</h2>
          <ul className="flex flex-col gap-3">
            {stats.teams.map((t) => (
              <li key={t.team} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <span className="truncate">{teamName(t.team)}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {format(dict.stats.wonOf, { won: String(t.won), played: String(t.played) })}
                </span>
                <Bar value={t.won / t.played} label={rate(t.won, t.played)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {stats.roles.length > 0 && (
        <section className="card flex flex-col gap-3 p-5">
          <h2 className="font-semibold">{dict.stats.cards}</h2>
          {/* Card names wrap rather than truncate: the numbers are short, the names aren't. */}
          <table className="w-full text-sm">
            <thead className="text-left align-bottom text-xs text-muted-foreground">
              <tr>
                <th className="py-1.5 font-medium">{dict.stats.card}</th>
                <th className="py-1.5 pl-3 text-right font-medium">{dict.stats.timesPlayed}</th>
                <th className="py-1.5 pl-3 text-right font-medium">{dict.stats.use}</th>
                <th className="py-1.5 pl-3 text-right font-medium">{dict.stats.winRate}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {stats.roles.map((r) => (
                <tr key={r.role} className="border-t">
                  <td className="py-2 break-words">{roleName(r.role)}</td>
                  <td className="py-2 pl-3 text-right whitespace-nowrap">{r.played}</td>
                  <td className="py-2 pl-3 text-right whitespace-nowrap">{rate(r.played, stats.played)}</td>
                  <td className="py-2 pl-3 text-right whitespace-nowrap">{rate(r.won, r.played)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {stats.recent.length > 0 && (
        <section className="card flex flex-col gap-3 p-5">
          <h2 className="font-semibold">{dict.stats.recent}</h2>
          <ul className="flex flex-col divide-y">
            {stats.recent.map((g) => (
              <li key={g.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{roleName(g.role)}</p>
                  <p className="text-sm text-muted-foreground">
                    {date.format(new Date(g.endedAt))} · {format(dict.stats.players, { count: String(g.playerCount) })} ·{" "}
                    {g.survived ? dict.stats.survived : dict.stats.died}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${g.won ? "bg-ok/15 text-ok" : "bg-primary/15 text-primary"}`}
                >
                  {g.won ? dict.stats.won : dict.stats.lost}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Tile({ icon: Icon, label, value, detail }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; detail?: string }) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <Icon aria-hidden className="mb-1 size-5 text-moon" />
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-display text-3xl font-bold tabular-nums">{value}</p>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div className="col-span-2 flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="w-10 text-right text-sm font-medium tabular-nums">{label}</span>
    </div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <div className="card flex flex-col items-center gap-4 p-8 text-center text-muted-foreground">{children}</div>;
}
