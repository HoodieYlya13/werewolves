"use client";

import { ImagePlus } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { accountPageUrl, currentPath, markAccountVisit, useSession } from "@/lib/session";

/**
 * For an account without a photo: the photo is the account's, so it's added on
 * the account page, which brings the player back here with the new photo.
 */
export function AddAccountPhoto() {
  const { dict, locale } = useI18n();
  const session = useSession();
  if (!session?.account || session.account.picture) return null;
  const href = accountPageUrl(session, locale);
  if (!href) return null;
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-moon underline-offset-4 hover:underline"
      onClick={(e) => {
        // The page to come back to is read at the click: it can change without a re-render.
        e.preventDefault();
        markAccountVisit();
        window.location.assign(accountPageUrl(session, locale, currentPath()) ?? href);
      }}
    >
      <ImagePlus aria-hidden className="size-4" />
      {dict.account.addPhoto}
    </a>
  );
}
