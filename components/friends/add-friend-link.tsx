"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthButton } from "@/components/account-button";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import type { RequestResult } from "@/lib/friends";
import { friendsApi } from "@/lib/friends-client";
import { useSession } from "@/lib/session";

/** Someone's friend link: once signed in, asks them to be friends. */
export function AddFriendLink() {
  const { code } = useParams<{ code: string }>();
  const { dict, locale } = useI18n();
  const t = dict.friends;
  const session = useSession();
  const sub = session?.account?.sub;
  const [result, setResult] = useState<RequestResult | "failed" | null>(null);

  useEffect(() => {
    if (!sub) return;
    void friendsApi.request({ code }).then((answer) => setResult(answer?.result ?? "failed"));
  }, [sub, code]);

  let body: React.ReactNode;
  if (!session) body = <p>{t.sending}</p>;
  else if (!session.stats) body = <p>{t.unavailable}</p>;
  else if (!session.account)
    body = (
      <>
        <p>{t.addLinkSignIn}</p>
        <AuthButton to="in">{dict.account.signIn}</AuthButton>
      </>
    );
  else if (!result) body = <p>{t.sending}</p>;
  else
    body = (
      <>
        <p className="text-fg">{result === "failed" ? t.failed : t.results[result]}</p>
        <Button asChild variant="outline">
          <Link href={`/${locale}/friends`}>{t.seeFriends}</Link>
        </Button>
      </>
    );
  return <div className="card flex flex-col items-center gap-4 p-8 text-center text-muted-foreground">{body}</div>;
}
