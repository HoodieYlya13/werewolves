"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Crown, Flame, Heart, HeartPulse, Landmark, Medal, MoveHorizontal, PieChart, Smartphone, Swords, Trophy, Zap } from "lucide-react";
import { AuthButton } from "@/components/account-button";
import { useI18n } from "@/components/i18n-provider";
import { Face } from "@/components/room-context";
import { StatsSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import type { DeathCause, RoleId, Team } from "@/lib/engine";
import { format } from "@/lib/i18n/config";
import { loadSession, useSession } from "@/lib/session";
import type { Person } from "@/lib/friends";
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
      // Through the session first, which refreshes the sign-in if needed (one request at a time).
      await loadSession();
      const res = await fetch("/api/auth/stats", { cache: "no-store" }).catch(() => null);
      const value: AccountStats | "failed" = res?.ok ? await res.json() : "failed";
      if (!cancelled) setStats({ sub, value });
    })();
    return () => {
      cancelled = true;
    };
  }, [sub, attempt]);

  if (!session) return <StatsSkeleton />;
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
  if (!stats || stats.sub !== sub) return <StatsSkeleton />;
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

/** Stats, of the signed-in account or (`them`) of someone else on their public profile. */
export function Stats({ stats, them = false }: { stats: AccountStats; them?: boolean }) {
  const { dict, locale } = useI18n();
  const copy = them ? { ...dict.stats, ...dict.stats.them } : dict.stats;
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  const rate = (part: number, whole: number) => (whole ? percent.format(part / whole) : "–");
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const roleName = (role: string) => dict.roles[role as RoleId]?.name ?? role;
  const teamName = (team: string | null) => (team ? (dict.teams[team as Team] ?? team) : "–");
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const causeName = (cause: string) => {
    const text = dict.game.causes[cause as DeathCause] ?? cause;
    return text.charAt(0).toUpperCase() + text.slice(1);
  };
  const deaths = stats.deaths.reduce((sum, d) => sum + d.count, 0);
  const sideGames = stats.master?.sides.reduce((sum, s) => sum + s.count, 0) ?? 0;
  /** A win rate with its "won out of played", or "Not yet" when it never happened. */
  const titleTile = (icon: React.ComponentType<{ className?: string }>, label: string, { played, won }: { played: number; won: number }) => (
    <Tile
      icon={icon}
      label={label}
      value={rate(won, played)}
      detail={played ? format(copy.wonOf, { won: String(won), played: String(played) }) : copy.notYet}
    />
  );

  if (stats.played === 0 && stats.mastered === 0 && !stats.organised?.total) return <Message>{copy.empty}</Message>;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile icon={Swords} label={copy.played} value={String(stats.played)} />
        <Tile
          icon={Trophy}
          label={copy.winRate}
          value={rate(stats.won, stats.played)}
          detail={
            // Games nobody won count as neither: the record then says so.
            stats.drawn
              ? format(copy.record, { won: String(stats.won), drawn: String(stats.drawn), lost: String(stats.played - stats.won - stats.drawn) })
              : format(copy.wonOf, { won: String(stats.won), played: String(stats.played) })
          }
        />
        <Tile
          icon={HeartPulse}
          label={copy.survival}
          value={rate(stats.survived, stats.played)}
          detail={format(copy.survivedOf, { survived: String(stats.survived), played: String(stats.played) })}
        />
        <Tile
          icon={Crown}
          label={copy.mastered}
          value={String(stats.mastered)}
          detail={format(copy.masteredShare, { share: rate(stats.mastered, stats.played + stats.mastered) })}
        />
      </div>

      {!!stats.organised?.total && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">{copy.organisedTitle}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile icon={Crown} label={copy.organised} value={String(stats.organised.total)} detail={copy.organisedDetail} />
            <Tile icon={Smartphone} label={copy.organisedAuto} value={String(stats.organised.auto)} detail={copy.organisedAutoDetail} />
          </div>
        </section>
      )}

      {stats.played > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">{copy.streaksTitle}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile icon={Flame} label={copy.currentStreak} value={String(stats.streaks.current)} detail={copy.currentStreakDetail} />
            <Tile icon={Medal} label={copy.bestStreak} value={String(stats.streaks.best)} detail={copy.bestStreakDetail} />
            {titleTile(Landmark, copy.asMayor, stats.mayor)}
            {titleTile(Heart, copy.asLover, stats.lover)}
          </div>
        </section>
      )}

      {stats.days && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-semibold">{copy.daysTitle}</h2>
            <p className="text-sm text-muted-foreground">{copy.daysHint}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile
              icon={CalendarDays}
              label={copy.meanDays}
              value={decimal.format(stats.days.mean)}
              detail={format(copy.gamesCounted, { count: String(stats.days.counted) })}
            />
            <Tile
              icon={PieChart}
              label={copy.shareDays}
              value={stats.days.share === null ? "–" : percent.format(stats.days.share)}
              detail={copy.shareDaysDetail}
            />
            <Tile
              icon={MoveHorizontal}
              label={copy.rangeDays}
              value={`${stats.days.min} – ${stats.days.max}`}
              detail={copy.rangeDaysDetail}
            />
            <Tile
              icon={Zap}
              label={copy.fastestWin}
              value={stats.days.fastestWin === null ? "–" : String(stats.days.fastestWin)}
              detail={copy.fastestWinDetail}
            />
          </div>
        </section>
      )}

      {stats.teams.length > 0 && (
        <section className="card flex flex-col gap-3 p-5">
          <h2 className="font-semibold">{copy.sides}</h2>
          <ul className="flex flex-col gap-3">
            {stats.teams.map((t) => (
              <li key={t.team} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <span className="truncate">{teamName(t.team)}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {format(copy.wonOf, { won: String(t.won), played: String(t.played) })}
                </span>
                <Bar value={t.won / t.played} label={rate(t.won, t.played)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {stats.byPlayers.length > 0 && (
        <section className="card flex flex-col gap-3 p-5">
          <h2 className="font-semibold">{copy.bySize}</h2>
          <ul className="flex flex-col gap-3">
            {stats.byPlayers.map((s) => (
              <li key={s.size} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <span className="truncate">{format(copy.size, { size: s.size.replace("-", "–") })}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {format(copy.wonOf, { won: String(s.won), played: String(s.played) })}
                </span>
                <Bar value={s.won / s.played} label={rate(s.won, s.played)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {stats.deaths.length > 0 && (
        <section className="card flex flex-col gap-3 p-5">
          <h2 className="font-semibold">{copy.deathsTitle}</h2>
          <ul className="flex flex-col gap-3">
            {stats.deaths.map((d) => (
              <li key={d.cause} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <span className="truncate">{causeName(d.cause)}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {format(copy.countOf, { count: String(d.count), total: String(deaths) })}
                </span>
                <Bar value={d.count / deaths} label={rate(d.count, deaths)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {stats.roles.length > 0 && (
        <section className="card flex flex-col gap-3 p-5">
          <h2 className="font-semibold">{copy.cards}</h2>
          {/* Card names wrap rather than truncate: the numbers are short, the names aren't. */}
          <table className="w-full text-sm">
            <thead className="text-left align-bottom text-xs text-muted-foreground">
              <tr>
                <th className="py-1.5 font-medium">{copy.card}</th>
                <th className="py-1.5 pl-3 text-right font-medium">{copy.timesPlayed}</th>
                <th className="py-1.5 pl-3 text-right font-medium">{copy.use}</th>
                <th className="py-1.5 pl-3 text-right font-medium">{copy.winRate}</th>
                {stats.days && <th className="py-1.5 pl-3 text-right font-medium">{copy.cardDays}</th>}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {stats.roles.map((r) => (
                <tr key={r.role} className="border-t">
                  <td className="py-2 break-words">{roleName(r.role)}</td>
                  <td className="py-2 pl-3 text-right whitespace-nowrap">{r.played}</td>
                  <td className="py-2 pl-3 text-right whitespace-nowrap">{rate(r.played, stats.played)}</td>
                  <td className="py-2 pl-3 text-right whitespace-nowrap">{rate(r.won, r.played)}</td>
                  {/* Mean days alive with the card: short for an Angel who did their job. */}
                  {stats.days && (
                    <td className="py-2 pl-3 text-right whitespace-nowrap">{r.meanDays === null ? "–" : decimal.format(r.meanDays)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {stats.master && (
        <section className="card flex flex-col gap-3 p-5">
          <div>
            <h2 className="font-semibold">{copy.masterTitle}</h2>
            <p className="text-sm text-muted-foreground">
              {stats.master.meanDays === null
                ? format(copy.masterAveragePlayers, { players: decimal.format(stats.master.meanPlayers) })
                : format(copy.masterAverage, {
                    players: decimal.format(stats.master.meanPlayers),
                    days: decimal.format(stats.master.meanDays),
                  })}
            </p>
          </div>
          <h3 className="text-sm font-medium text-muted-foreground">{copy.masterSides}</h3>
          <ul className="flex flex-col gap-3">
            {stats.master.sides.map((s) => (
              <li key={s.team ?? "none"} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <span className="truncate">{s.team ? teamName(s.team) : copy.nobodyWon}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {format(copy.countOf, { count: String(s.count), total: String(sideGames) })}
                </span>
                <Bar value={s.count / sideGames} label={rate(s.count, sideGames)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(stats.partners.length > 0 || stats.nemeses.length > 0) && (
        <div className="grid gap-6 md:grid-cols-2">
          {stats.partners.length > 0 && (
            <PeopleCard title={copy.partners}>
              {stats.partners.map((p) => (
                <PersonLine key={p.code} person={p} detail={format(copy.partnersDetail, { won: String(p.won), played: String(p.played) })} />
              ))}
            </PeopleCard>
          )}
          {stats.nemeses.length > 0 && (
            <PeopleCard title={copy.nemeses}>
              {stats.nemeses.map((p) => (
                <PersonLine key={p.code} person={p} detail={format(copy.times, { count: String(p.count) })} />
              ))}
            </PeopleCard>
          )}
        </div>
      )}

      {stats.recent.length > 0 && (
        <section className="card flex flex-col gap-3 p-5">
          <h2 className="font-semibold">{copy.recent}</h2>
          <ul className="flex flex-col divide-y">
            {stats.recent.map((g) => (
              <li key={g.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{roleName(g.role)}</p>
                  <p className="text-sm text-muted-foreground">
                    {date.format(new Date(g.endedAt))} · {format(copy.players, { count: String(g.playerCount) })} ·{" "}
                    {g.survived ? copy.survived : copy.died}
                    {g.daysAlive !== null && g.days !== null && (
                      <> · {format(copy.daysAlive, { alive: String(g.daysAlive), days: String(g.days) })}</>
                    )}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${g.won ? "bg-ok/15 text-ok" : g.winnerTeam === null ? "bg-surface-2 text-muted-foreground" : "bg-primary/15 text-primary"}`}
                >
                  {g.won ? copy.won : g.winnerTeam === null ? copy.drawn : copy.lost}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PeopleCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card flex flex-col gap-3 p-5">
      <h2 className="font-semibold">{title}</h2>
      <ul className="flex flex-col divide-y">{children}</ul>
    </section>
  );
}

/** Someone met in games, linked to their public profile. */
function PersonLine({ person, detail }: { person: Person; detail: string }) {
  const { locale } = useI18n();
  return (
    <li className="py-2 first:pt-0 last:pb-0">
      <Link href={`/${locale}/players/${person.code}`} className="flex items-center gap-3 hover:opacity-80">
        <Face name={person.name} src={person.picture} className="size-8 text-xs" />
        <span className="min-w-0 flex-1 truncate font-medium">{person.name}</span>
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{detail}</span>
      </Link>
    </li>
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

export function Message({ children }: { children: React.ReactNode }) {
  return <div className="card flex flex-col items-center gap-4 p-8 text-center text-muted-foreground">{children}</div>;
}
