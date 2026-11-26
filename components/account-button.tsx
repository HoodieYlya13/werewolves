"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { forgetPasskeyReminder } from "@/components/passkey-reminder";
import { forgetPushPrompt } from "@/components/friends/push-reminder";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { signInUrl, signOutUrl } from "@/lib/session";
import { cn } from "@/lib/utils";

export type AuthDirection = "in" | "out";

/** The auth server can take a while to wake up, but past this it isn't coming. */
const SIGN_IN_TIMEOUT_MS = 20_000;

let redirecting: AuthDirection | null = null;
const redirectListeners = new Set<() => void>();
const signInFailureListeners = new Set<(returnTo: string) => void>();

function setRedirecting(direction: AuthDirection | null) {
  redirecting = direction;
  redirectListeners.forEach((listener) => listener());
}

function subscribeToRedirect(listener: () => void) {
  redirectListeners.add(listener);
  return () => redirectListeners.delete(listener);
}

// Back from the auth server with the Back button: the page comes from memory, still spinning.
if (typeof window !== "undefined") {
  window.addEventListener("pageshow", (event) => event.persisted && setRedirecting(null));
}

/** Where the page is on its way to: signing in, signing out, or nowhere. */
export function useAuthRedirect(): AuthDirection | null {
  return useSyncExternalStore(subscribeToRedirect, () => redirecting, () => null);
}

const currentPage = () => window.location.pathname + window.location.search;

/** The auth server's sign-in page, or null when it doesn't answer. */
async function signInPageUrl(returnTo: string): Promise<string | null> {
  const response = await fetch(`${signInUrl(returnTo)}&respond=json`, { cache: "no-store", signal: AbortSignal.timeout(SIGN_IN_TIMEOUT_MS) }).catch(() => null);
  if (!response?.ok) return null;
  const answer = (await response.json().catch(() => null)) as { url?: string } | null;
  return answer?.url ?? null;
}

/** Signs in or out through the auth server, then back to `returnTo` (this page by default). A failed sign-in says so in a toast. */
export async function goToAuth(to: AuthDirection, returnTo = currentPage()) {
  if (redirecting) return;
  setRedirecting(to);
  if (to === "out") {
    forgetPasskeyReminder();
    forgetPushPrompt();
    window.location.assign(signOutUrl(returnTo));
    return;
  }
  const url = await signInPageUrl(returnTo);
  if (url) {
    window.location.assign(url);
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
