"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Search, Share2, UserMinus, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { AuthButton } from "@/components/account-button";
import { ConfirmButton } from "@/components/confirm-button";
import { PushToggle } from "@/components/friends/push-toggle";
import { useI18n } from "@/components/i18n-provider";
import { Face } from "@/components/room-context";
import { StatsSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FriendsList, Person } from "@/lib/friends";
import { friendsApi } from "@/lib/friends-client";
import { format } from "@/lib/i18n/config";
import { useSession } from "@/lib/session";

/** The signed-in account's friends: its link, requests, search, and notifications. */
export function FriendsView() {
  const { dict } = useI18n();
  const t = dict.friends;
  const session = useSession();
  const sub = session?.account?.sub;
  const [list, setList] = useState<{ sub: string; value: FriendsList | "failed" } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!sub) return;
    let cancelled = false;
    void friendsApi.list().then((value) => {
      if (!cancelled) setList({ sub, value: value ?? "failed" });
    });
    return () => {
      cancelled = true;
    };
  }, [sub, attempt]);

  if (!session) return <StatsSkeleton />;
  // Friends live in the same database as the stats.
  if (!session.stats) return <Message>{t.unavailable}</Message>;
  if (!session.account) {
    return (
      <Message>
        {t.signIn}
        <AuthButton to="in">{dict.account.signIn}</AuthButton>
      </Message>
    );
  }
  if (!list || list.sub !== sub) return <StatsSkeleton />;
  if (list.value === "failed") {
    return (
      <Message>
        {t.failed}
        <Button type="button" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
          {t.retry}
        </Button>
      </Message>
    );
  }
  return <Friends list={list.value} onChange={(value) => setList({ sub: sub!, value })} />;
}

function Friends({ list, onChange }: { list: FriendsList; onChange: (list: FriendsList) => void }) {
  const { dict } = useI18n();
  const t = dict.friends;

  /** Runs a change, then shows the list the server answers with. */
  async function change(run: Promise<{ list: FriendsList; result?: keyof typeof t.results } | null>) {
    const answer = await run;
    if (!answer) return void toast.error(t.failed);
    onChange(answer.list);
    if (answer.result) toast(t.results[answer.result]);
  }

  return (
    <div className="flex flex-col gap-6">
      {list.code && <FriendLink code={list.code} />}
      <PushToggle />
      <SearchPeople list={list} onRequest={(sub) => void change(friendsApi.request({ sub }))} onAccept={(sub) => void change(friendsApi.answer(sub, true))} />

      {list.incoming.length > 0 && (
        <People title={t.incoming} people={list.incoming}>
          {(p) => (
            <>
              <Button type="button" size="sm" onClick={() => void change(friendsApi.answer(p.sub, true))}>
                <Check aria-hidden />
                {t.accept}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => void change(friendsApi.answer(p.sub, false))}>
                {t.decline}
              </Button>
            </>
          )}
        </People>
      )}

      <People title={`${t.list} (${list.friends.length})`} people={list.friends} empty={t.empty}>
        {(p) => (
          <ConfirmButton
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t.remove}
            title={format(t.removeConfirm.title, { name: p.name })}
            description={t.removeConfirm.body}
            action={t.remove}
            onConfirm={() => void change(friendsApi.remove(p.sub))}
          >
            <UserMinus aria-hidden />
          </ConfirmButton>
        )}
      </People>

      {list.outgoing.length > 0 && (
        <People title={t.outgoing} people={list.outgoing}>
          {(p) => (
            <Button type="button" size="sm" variant="ghost" onClick={() => void change(friendsApi.remove(p.sub))}>
              <X aria-hidden />
              {t.cancel}
            </Button>
          )}
        </People>
      )}
    </div>
  );
}

/** The account's friend link: opening it asks to be friends. */
function FriendLink({ code }: { code: string }) {
  const { dict, locale } = useI18n();
  const t = dict.friends;
  const url = `${window.location.origin}/${locale}/friends/add/${code}`;
  const canShare = typeof navigator.share === "function";
  return (
    <section className="card flex flex-col gap-3 p-5">
      <div>
        <h2 className="font-semibold">{t.yourLink}</h2>
        <p className="text-sm text-muted-foreground">{t.yourLinkHint}</p>
      </div>
      <p className="selectable font-mono text-sm break-all">{url.replace(/^https?:\/\//, "")}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void navigator.clipboard
              .writeText(url)
              .then(() => toast.success(t.linkCopied, { id: "copied" }))
              .catch(() => {})
          }
        >
          <Copy aria-hidden />
          {t.copyLink}
        </Button>
        {canShare && (
          <Button type="button" variant="outline" onClick={() => void navigator.share({ text: t.shareText, url }).catch(() => {})}>
            <Share2 aria-hidden />
            {t.share}
          </Button>
        )}
      </div>
    </section>
  );
}

/** Finds accounts by username, with what can be done for each. */
function SearchPeople({ list, onRequest, onAccept }: { list: FriendsList; onRequest: (sub: string) => void; onAccept: (sub: string) => void }) {
  const { dict } = useI18n();
  const t = dict.friends;
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ query: string; people: Person[] } | null>(null);
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) return;
    const timer = setTimeout(() => {
      void friendsApi.search(trimmed).then((answer) => setFound({ query: trimmed, people: answer?.people ?? [] }));
    }, 300);
    return () => clearTimeout(timer);
  }, [trimmed]);

  const has = (people: Person[], sub: string) => people.some((p) => p.sub === sub);
  const results = trimmed.length >= 2 && found?.query === trimmed ? found.people : null;

  return (
    <section className="card flex flex-col gap-3 p-5">
      <label htmlFor="friend-search" className="font-semibold">
        {t.search}
      </label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="friend-search"
          className="pl-9"
          placeholder={t.searchPlaceholder}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {results && results.length === 0 && <p className="text-sm text-muted-foreground">{t.noResults}</p>}
      {results && results.length > 0 && (
        <ul className="flex flex-col divide-y">
          {results.map((p) => (
            <PersonRow key={p.sub} person={p}>
              {has(list.friends, p.sub) ? (
                <span className="text-sm text-muted-foreground">{t.isFriend}</span>
              ) : has(list.outgoing, p.sub) ? (
                <span className="text-sm text-muted-foreground">{t.pending}</span>
              ) : has(list.incoming, p.sub) ? (
                <Button type="button" size="sm" onClick={() => onAccept(p.sub)}>
                  <Check aria-hidden />
                  {t.accept}
                </Button>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={() => onRequest(p.sub)}>
                  <UserPlus aria-hidden />
                  {t.add}
                </Button>
              )}
            </PersonRow>
          ))}
        </ul>
      )}
    </section>
  );
}

function People({ title, people, empty, children }: { title: string; people: Person[]; empty?: string; children: (person: Person) => React.ReactNode }) {
  return (
    <section className="card flex flex-col gap-3 p-5">
      <h2 className="font-semibold">{title}</h2>
      {people.length === 0 && empty && <p className="text-sm text-muted-foreground">{empty}</p>}
      {people.length > 0 && (
        <ul className="flex flex-col divide-y">
          {people.map((p) => (
            <PersonRow key={p.sub} person={p}>
              {children(p)}
            </PersonRow>
          ))}
        </ul>
      )}
    </section>
  );
}

function PersonRow({ person, children }: { person: Person; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <Face name={person.name} src={person.picture} className="size-9 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{person.name}</p>
        {person.username && <p className="truncate text-sm text-muted-foreground">@{person.username}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">{children}</div>
    </li>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <div className="card flex flex-col items-center gap-4 p-8 text-center text-muted-foreground">{children}</div>;
}
