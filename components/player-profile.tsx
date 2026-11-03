"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Clock, Crosshair, ShieldHalf, Skull, Swords, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";
import { Face } from "@/components/room-context";
import { StatsSkeleton } from "@/components/skeletons";
import { Message, Stats } from "@/components/stats-view";
import { Button } from "@/components/ui/button";
import { friendsApi } from "@/lib/friends-client";
import { format } from "@/lib/i18n/config";
import { loadSession, useSession } from "@/lib/session";
import type { ProfilePeek } from "@/lib/friends";
import type { AccountStats, HeadToHead } from "@/lib/stats";

type Profile = {
  person: { name: string; username: string | null; picture: string | null; code: string };
  self: boolean;
  /** Where the viewer stands with them (signed in, someone else). */
  friendship: ProfilePeek["friendship"] | null;
  stats: AccountStats;
  headToHead: HeadToHead | null;
};

/** A player's public profile: their stats, and how the viewer fares against them. */
export function PlayerProfile() {
  const { dict } = useI18n();
  const t = dict.profile;
  const { code } = useParams<{ code: string }>();
  const session = useSession();
  // Refetched once the session is known: signed in, the answer adds the head to head.
  const viewer = session === null ? null : (session.account?.sub ?? "");
  const [profile, setProfile] = useState<{ key: string; value: Profile | "missing" | "failed" } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${code}|${viewer}|${attempt}`;

  useEffect(() => {
    if (viewer === null) return;
    let cancelled = false;
    void (async () => {
      await loadSession();
      const res = await fetch(`/api/auth/players/${encodeURIComponent(code)}`, { cache: "no-store" }).catch(() => null);
      const value = res?.ok ? ((await res.json()) as Profile) : res?.status === 404 ? "missing" : "failed";
      if (!cancelled) setProfile({ key, value });
    })();
    return () => {
      cancelled = true;
    };
  }, [code, viewer, key]);

  if (!profile || profile.key !== key) return <StatsSkeleton />;
  if (profile.value === "missing") return <Message>{t.notFound}</Message>;
  if (profile.value === "failed") {
    return (
      <Message>
        {t.failed}
        <Button type="button" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
          {dict.stats.retry}
        </Button>
      </Message>
    );
  }
  const { person, self, friendship, stats, headToHead } = profile.value;
  // Already friends, or asked: says so instead of offering to add them.
  const canAdd = !!session?.account && !self && (friendship === "none" || friendship === "received" || friendship === null);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        <Face name={person.name} src={person.picture} className="size-16 text-xl" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-bold tracking-wide break-words">{person.name}</h1>
          {person.username && <p className="text-muted-foreground">@{person.username}</p>}
        </div>
        {canAdd && (
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={() =>
              void friendsApi.request({ code: person.code }).then((a) => {
                toast(a ? dict.friends.results[a.result] : dict.friends.failed);
                if (a) setAttempt((n) => n + 1);
              })
            }
          >
            <UserPlus aria-hidden />
            <span className="max-sm:sr-only">{friendship === "received" ? dict.friends.peek.accept : t.addFriend}</span>
          </Button>
        )}
        {friendship === "friends" && (
          <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-ok">
            <UserCheck aria-hidden className="size-4" />
            <span className="max-sm:sr-only">{dict.friends.peek.friends}</span>
          </span>
        )}
        {friendship === "sent" && (
          <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
            <Clock aria-hidden className="size-4" />
            <span className="max-sm:sr-only">{dict.friends.peek.sent}</span>
          </span>
        )}
      </header>
      {self && <p className="text-sm text-muted-foreground">{t.yours}</p>}
      {headToHead && <Versus name={person.name} versus={headToHead} />}
      <Stats stats={stats} them={!self} />
    </div>
  );
}

/** How the viewer fares with and against this player. */
function Versus({ name, versus }: { name: string; versus: HeadToHead }) {
  const { dict, locale } = useI18n();
  const t = dict.profile;
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  const rate = (part: number, whole: number) => (whole ? percent.format(part / whole) : "–");
  const wonOf = (won: number, played: number) => format(dict.stats.wonOf, { won: String(won), played: String(played) });
  return (
    <section className="card flex flex-col gap-4 p-5">
      <h2 className="font-semibold">{format(t.versus, { name })}</h2>
      {versus.together === 0 ? (
        <p className="text-sm text-muted-foreground">{t.versusNone}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-4">
            <Stat icon={Swords} label={t.together} value={String(versus.together)} />
            <Stat icon={ShieldHalf} label={t.sameSide} value={rate(versus.wonTogether, versus.sameSide)} detail={wonOf(versus.wonTogether, versus.sameSide)} />
            <Stat
              icon={Crosshair}
              label={t.opposed}
              value={rate(versus.wonAgainst, versus.opposed)}
              detail={format(t.opposedDetail, { won: String(versus.wonAgainst), lost: String(versus.lostAgainst) })}
            />
            <Stat
              icon={Skull}
              label={t.eliminations}
              value={`${versus.eliminated} – ${versus.eliminatedBy}`}
              detail={format(t.eliminationsDetail, { mine: String(versus.eliminated), theirs: String(versus.eliminatedBy) })}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t.eliminatedHint}</p>
        </>
      )}
    </section>
  );
}

function Stat({ icon: Icon, label, value, detail }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; detail?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Icon aria-hidden className="mb-1 size-4 text-moon" />
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
      {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}
