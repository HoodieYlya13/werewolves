"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";

/** A plain way back to the home page: the title in the header isn't obviously one. */
export function BackHome({ className }: { className?: string }) {
  const { dict, locale } = useI18n();
  return (
    <Link
      href={`/${locale}`}
      className={cn("inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-fg", className)}
    >
      <ArrowLeft aria-hidden className="size-4" />
      {dict.nav.home}
    </Link>
  );
}
