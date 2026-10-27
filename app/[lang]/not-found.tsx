"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const { dict, locale } = useI18n();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="font-display text-5xl font-bold">404</p>
      <p className="text-lg">{dict.pages.notFound}</p>
      <Button asChild variant="outline">
        <Link href={`/${locale}`}>{dict.errors.backHome}</Link>
      </Button>
    </main>
  );
}
