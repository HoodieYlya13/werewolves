"use client";

import { forgetPasskeyReminder } from "@/components/passkey-reminder";
import { forgetPushPrompt } from "@/components/friends/push-reminder";
import { Button } from "@/components/ui/button";
import { signInUrl, signOutUrl } from "@/lib/session";

/** Full-page redirect to sign in or out through the auth server, then back to `returnTo` (this page by default). */
export function goToAuth(to: "in" | "out", returnTo = window.location.pathname + window.location.search) {
  if (to === "out") {
    forgetPasskeyReminder();
    forgetPushPrompt();
  }
  window.location.assign((to === "in" ? signInUrl : signOutUrl)(returnTo));
}

/** A button that signs in or out. */
export function AuthButton({ to, ...props }: { to: "in" | "out" } & Omit<React.ComponentProps<typeof Button>, "onClick">) {
  return <Button type="button" onClick={() => goToAuth(to)} {...props} />;
}
