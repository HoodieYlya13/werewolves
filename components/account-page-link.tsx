"use client";

import { ImagePlus, UserCog } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { accountPageUrl, currentPath, markAccountVisit, useSession } from "@/lib/session";

/** A link to the account page, which brings the player back here afterwards. */
function AccountPageLink({ icon: Icon, label }: { icon: typeof ImagePlus; label: string }) {
  const { locale } = useI18n();
  const session = useSession();
  const href = session?.account && accountPageUrl(session, locale);
  if (!session || !href) return null;
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
      <Icon aria-hidden className="size-4" />
      {label}
    </a>
  );
}

/** For an account without a photo: the photo is the account's, so it's added on the account page. */
export function AddAccountPhoto() {
  const { dict } = useI18n();
  const session = useSession();
  if (!session?.account || session.account.picture) return null;
  return <AccountPageLink icon={ImagePlus} label={dict.account.addPhoto} />;
}

/** A signed-in player's name and photo come from the account: both change there. */
export function AccountLinks() {
  const { dict } = useI18n();
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
      <AddAccountPhoto />
      <AccountPageLink icon={UserCog} label={dict.account.manage} />
    </div>
  );
}
