"use client";

import { useState } from "react";
import Link from "next/link";
import { ChartColumn, LogIn, LogOut, UserCog } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Face } from "@/components/room-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  accountPageUrl,
  currentPath,
  getSignOutGuard,
  signInUrl,
  signOutUrl,
  useSession,
  type SignOutGuard,
} from "@/lib/session";

/** Full-page redirect to sign in or out through the auth server, then back to `returnTo` (this page by default). */
export function goToAuth(to: "in" | "out", returnTo = window.location.pathname + window.location.search) {
  window.location.assign((to === "in" ? signInUrl : signOutUrl)(returnTo));
}

/** A button that signs in or out. */
export function AuthButton({ to, ...props }: { to: "in" | "out" } & Omit<React.ComponentProps<typeof Button>, "onClick">) {
  return <Button type="button" onClick={() => goToAuth(to)} {...props} />;
}

/** Signing in from the header. Hidden when accounts aren't set up (e.g. previews). */
export function AccountButton() {
  const { dict, locale } = useI18n();
  const session = useSession();
  // Set while asking a player whose seat is the account's to confirm.
  const [leaving, setLeaving] = useState<SignOutGuard | null>(null);
  // The page the account page links back to, read when the menu opens (it can change without remounting).
  const [returnPath, setReturnPath] = useState("/");
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

  function signOut() {
    const guard = getSignOutGuard();
    if (guard) setLeaving(guard);
    else goToAuth("out");
  }

  const { name, picture } = session.account;
  const accountPage = accountPageUrl(session, locale, returnPath);
  return (
    <>
      {/* Not modal, so the confirmation can take over focus once the menu closes. */}
      <DropdownMenu modal={false} onOpenChange={(open) => open && setReturnPath(currentPath())}>
        <DropdownMenuTrigger className="rounded-full" aria-label={format(dict.account.signedInAs, { name })}>
          <Face name={name} src={picture} className="size-8 text-sm" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
            {format(dict.account.signedInAs, { name })}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {session.stats && (
            <DropdownMenuItem asChild>
              <Link href={`/${locale}/stats`}>
                <ChartColumn aria-hidden />
                {dict.account.stats}
              </Link>
            </DropdownMenuItem>
          )}
          {accountPage && (
            <DropdownMenuItem asChild>
              {/* Same tab: the account page links back to the app. */}
              <a href={accountPage}>
                <UserCog aria-hidden />
                {dict.account.manage}
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={signOut}>
            <LogOut aria-hidden />
            {dict.account.signOut}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={leaving !== null} onOpenChange={(open) => !open && setLeaving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dict.account.signOutLeave.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {leaving?.inGame ? dict.account.signOutLeave.bodyInGame : dict.account.signOutLeave.body}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{dict.host.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // Out of the room first, then signed out, back on the home page.
                void leaving?.leave().then(() => goToAuth("out", `/${locale}`));
              }}
            >
              {dict.account.signOut}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
