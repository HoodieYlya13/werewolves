"use client";

import { useI18n } from "@/components/i18n-provider";
import { useAccountStats } from "@/lib/account-stats";
import type { RoleId } from "@/lib/engine";
import { format } from "@/lib/i18n/config";
import type { Session } from "@/lib/session";
import type { AccountStats } from "@/lib/stats";

type Dictionary = ReturnType<typeof useI18n>["dict"];

const MIN_ITEMS_PER_LOOP = 4;

/** Who is signed in and their stats, scrolling under the app's name; an invitation to sign in when signed out. */
export function AccountMarquee({ session }: { session: Session | null }) {
  const { dict, locale } = useI18n();
  const account = session?.account ?? null;
  const stats = useAccountStats(session?.stats ? account?.sub : undefined);

  const items = !session?.enabled
    ? []
    : account
      ? [...accountItems(account, dict), ...statsItems(stats, dict, locale)]
      : [dict.bar.signInInvite, dict.bar.tapToSignIn];
  if (items.length === 0) return null;

  const loop = repeatToFill(items);
  return (
    <span className="marquee-mask block w-full overflow-hidden whitespace-nowrap">
      {/* Two copies of the loop: the track slides by one copy, then starts again where it began. */}
      <span className="marquee-track items-center gap-2" aria-hidden>
        {[...loop, ...loop].map((text, index) => (
          <span key={index} className="flex shrink-0 items-center gap-2 text-xs font-medium opacity-70 md:text-sm">
            {text}
            <span>•</span>
          </span>
        ))}
      </span>
      <span className="sr-only">{items.join(", ")}</span>
    </span>
  );
}

function accountItems(account: NonNullable<Session["account"]>, dict: Dictionary): string[] {
  const username = account.username ? [format(dict.bar.username, { username: account.username })] : [];
  return [account.name, ...username];
}

function statsItems(stats: AccountStats | null, dict: Dictionary, locale: string): string[] {
  if (!stats) return [];
  if (stats.played === 0 && stats.mastered === 0) return [dict.bar.firstGame];

  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  const favouriteRole = mostPlayedRole(stats);
  const counted = (template: string, count: number) => (count > 0 ? [format(template, { count })] : []);
  return [
    ...counted(dict.bar.played, stats.played),
    ...(stats.played > 0 ? [format(dict.bar.winRate, { rate: percent.format(stats.won / stats.played) })] : []),
    ...counted(dict.bar.won, stats.won),
    ...counted(dict.bar.survived, stats.survived),
    ...counted(dict.bar.currentStreak, stats.streaks.current),
    ...counted(dict.bar.bestStreak, stats.streaks.best),
    ...counted(dict.bar.mastered, stats.mastered),
    ...(favouriteRole ? [format(dict.bar.favouriteRole, { role: dict.roles[favouriteRole as RoleId]?.name ?? favouriteRole })] : []),
  ];
}

function mostPlayedRole(stats: AccountStats): string | null {
  const [mostPlayed] = [...stats.roles].sort((a, b) => b.played - a.played);
  return mostPlayed?.role ?? null;
}

/** Short lists are repeated so one loop is wider than the bar, with no gap before it starts again. */
function repeatToFill(items: string[]): string[] {
  const copies = Math.ceil(MIN_ITEMS_PER_LOOP / items.length);
  return Array.from({ length: copies }, () => items).flat();
}
