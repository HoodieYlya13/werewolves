"use client";

import { LogIn, LogOut } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Face } from "@/components/room-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "@/lib/i18n/config";
import { signInUrl, signOutUrl, useSession } from "@/lib/session";

/** Full-page redirect to sign in or out through the auth server, then back to this page. */
function goToAuth(to: "in" | "out") {
  const url = to === "in" ? signInUrl : signOutUrl;
  window.location.assign(url(window.location.pathname + window.location.search));
}

/** A button that signs in or out. */
export function AuthButton({ to, ...props }: { to: "in" | "out" } & Omit<React.ComponentProps<typeof Button>, "onClick">) {
  return <Button type="button" onClick={() => goToAuth(to)} {...props} />;
}

/** Signing in from the header. Hidden when accounts aren't set up (e.g. previews). */
export function AccountButton() {
  const { dict } = useI18n();
  const session = useSession();
  if (!session?.enabled) return null;

  if (!session.account) {
    return (
      // Icon only on phones; the label stays for screen readers.
      <AuthButton to="in" variant="outline" size="sm" className="rounded-full max-sm:size-9 max-sm:px-0" title={dict.account.signIn}>
        <LogIn aria-hidden />
        <span className="max-sm:sr-only">{dict.account.signIn}</span>
      </AuthButton>
    );
  }

  const { name, picture } = session.account;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full" aria-label={format(dict.account.signedInAs, { name })}>
        <Face name={name} src={picture} className="size-8 text-sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
          {format(dict.account.signedInAs, { name })}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => goToAuth("out")}>
          <LogOut aria-hidden />
          {dict.account.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
