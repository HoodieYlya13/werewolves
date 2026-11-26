"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { forgetPasskeyReminder } from "@/components/passkey-reminder";
import { forgetPushPrompt } from "@/components/friends/push-reminder";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { currentRedirect, setRedirecting, useAuthRedirect } from "@/lib/auth-redirect";
import { showSignedOut, signInUrl, signOutUrl } from "@/lib/session";
import { cn } from "@/lib/utils";

export type AuthDirection = "in" | "out";

/** The auth server can take a while to wake up, but past this it isn't coming. */
const SIGN_IN_TIMEOUT_MS = 20_000;

const signInFailureListeners = new Set<(returnTo: string) => void>();

const currentPage = () => window.location.pathname + window.location.search;

/** Whether the auth server answers, asked in the background so the page can say so if it doesn't. */
async function isSignInReachable(returnTo: string): Promise<boolean> {
  const response = await fetch(`${signInUrl(returnTo)}&respond=json`, { cache: "no-store", signal: AbortSignal.timeout(SIGN_IN_TIMEOUT_MS) }).catch(() => null);
  return !!response?.ok;
}

/** Ends the sign-in from this site's server; false when the auth server has to be visited instead. */
async function endSignInInBackground(): Promise<boolean> {
  const response = await fetch("/api/auth/sign-out", { method: "POST", cache: "no-store" }).catch(() => null);
  if (!response?.ok) return false;
  const answer = (await response.json().catch(() => null)) as { endedOnAuthServer?: boolean } | null;
  return !!answer?.endedOnAuthServer;
}

/** Signed out on the page at once; through the auth server only when it can't be done from here. */
async function signOut(returnTo: string) {
  forgetPasskeyReminder();
  forgetPushPrompt();
  showSignedOut();
  if (!(await endSignInInBackground())) {
    setRedirecting("out");
    window.location.assign(signOutUrl(returnTo));
    return;
  }
  if (returnTo !== currentPage()) window.location.assign(returnTo);
}

/** Signs in through the auth server, or out, then back to `returnTo` (this page by default). A failed sign-in says so in a toast. */
export async function goToAuth(to: AuthDirection, returnTo = currentPage()) {
  if (currentRedirect()) return;
  if (to === "out") return signOut(returnTo);
  setRedirecting(to);
  if (await isSignInReachable(returnTo)) {
    // Through this site's own route, which redirects there: an installed iPhone app keeps a redirect
    // it started in the app, but opens a script's jump to another site in a separate browser sheet.
    window.location.assign(signInUrl(returnTo));
    return;
  }
  setRedirecting(null);
  signInFailureListeners.forEach((listener) => listener(returnTo));
}

/** Mounted once: says when the auth server didn't answer, with a button to try again. */
export function SignInFailureToast() {
  const { dict } = useI18n();
  useEffect(() => {
    const showFailure = (returnTo: string) =>
      toast.error(dict.account.signInFailed, {
        id: "sign-in-failed",
        duration: 10_000,
        action: { label: dict.account.tryAgain, onClick: () => void goToAuth("in", returnTo) },
      });
    signInFailureListeners.add(showFailure);
    return () => void signInFailureListeners.delete(showFailure);
  }, [dict]);
  return null;
}

/** Its own icon gives way to the spinner while the page is on its way. */
const HIDE_OWN_ICONS = "[&>svg:not([data-slot=spinner])]:hidden";

/** A button that signs in or out, spinning from the click until the auth server's page opens. */
export function AuthButton({ to, children, className, ...props }: { to: AuthDirection } & Omit<React.ComponentProps<typeof Button>, "onClick">) {
  const redirect = useAuthRedirect();
  const [wasPressed, setWasPressed] = useState(false);
  const isOnItsWay = wasPressed && redirect === to;

  function press() {
    setWasPressed(true);
    void goToAuth(to);
  }

  return (
    <Button type="button" onClick={press} aria-busy={isOnItsWay} className={cn(className, isOnItsWay && HIDE_OWN_ICONS)} {...props}>
      {isOnItsWay && <Spinner />}
      {children}
    </Button>
  );
}
