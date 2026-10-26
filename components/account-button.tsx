"use client";

import { LogIn, LogOut } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Face } from "@/components/room-context";
import { format } from "@/lib/i18n/config";
import { signInUrl, signOutUrl, useSession } from "@/lib/session";

/** Signs in or out through the auth server (a full-page redirect), then comes back to this page. */
export function AuthButton({ to, className, children }: { to: "in" | "out"; className?: string; children: React.ReactNode }) {
  const url = to === "in" ? signInUrl : signOutUrl;
  return (
    <button type="button" className={className} onClick={() => window.location.assign(url(window.location.pathname + window.location.search))}>
      {children}
    </button>
  );
}

/** Signing in from the header. Hidden when accounts aren't set up (e.g. previews). */
export function AccountButton() {
  const { dict } = useI18n();
  const session = useSession();
  if (!session?.enabled) return null;

  if (!session.account) {
    return (
      <AuthButton to="in" className="btn btn-ghost px-3 py-1.5 text-sm">
        <LogIn aria-hidden className="size-4" />
        {dict.account.signIn}
      </AuthButton>
    );
  }

  const { name, picture } = session.account;
  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none rounded-full" aria-label={format(dict.account.signedInAs, { name })}>
        <Face name={name} src={picture} className="size-8 text-sm" />
      </summary>
      <div className="card absolute right-0 z-20 mt-2 flex w-56 flex-col gap-2 p-3 text-sm">
        <p className="truncate text-muted">{format(dict.account.signedInAs, { name })}</p>
        <AuthButton to="out" className="btn btn-ghost justify-start">
          <LogOut aria-hidden className="size-4" />
          {dict.account.signOut}
        </AuthButton>
      </div>
    </details>
  );
}

