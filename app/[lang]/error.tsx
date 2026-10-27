"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";

/** A screen crashed while rendering. The room lives on the server, so reloading picks the game back up. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const { dict, locale } = useI18n();
  useEffect(() => console.error(error), [error]);
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-lg font-semibold">{dict.pages.crashed}</p>
      <p className="text-muted-foreground">{dict.pages.crashedBody}</p>
      <div className="mt-2 flex gap-2">
        <Button type="button" onClick={retry}>
          {dict.pages.retry}
        </Button>
        <Button asChild variant="outline">
          <Link href={`/${locale}`}>{dict.errors.backHome}</Link>
        </Button>
      </div>
    </main>
  );
}
