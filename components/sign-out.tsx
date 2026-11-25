"use client";

import { useState } from "react";
import { goToAuth } from "@/components/account-button";
import { useI18n } from "@/components/i18n-provider";
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
import { getSignOutGuard, type SignOutGuard } from "@/lib/session";

/** Signs out, first asking a player whose seat is the account's to confirm leaving the room. */
export function useSignOut() {
  const { dict, locale } = useI18n();
  const [leaving, setLeaving] = useState<SignOutGuard | null>(null);

  function signOut() {
    const guard = getSignOutGuard();
    if (guard) setLeaving(guard);
    else goToAuth("out");
  }

  const confirmation = (
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
  );

  return { signOut, confirmation };
}
