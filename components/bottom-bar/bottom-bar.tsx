"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CircleUserRound } from "lucide-react";
import { goToAuth } from "@/components/account-button";
import { AccountPanel } from "@/components/bottom-bar/account-panel";
import { BarIcon, BarSpinner, BarTile, NotificationBadge } from "@/components/bottom-bar/bar-row";
import { MenuIcon } from "@/components/bottom-bar/menu-icon";
import { MenuPanel } from "@/components/bottom-bar/menu-panel";
import { useBubble } from "@/components/bottom-bar/use-bubble";
import { useI18n } from "@/components/i18n-provider";
import { Face } from "@/components/room-context";
import { SiteTitle } from "@/components/site-title";
import { useSignOut } from "@/components/sign-out";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";
import { useIncomingFriendRequests } from "@/lib/friend-requests";
import { format } from "@/lib/i18n/config";
import { useAuthRedirect, type AuthDestination } from "@/lib/auth-redirect";
import { isRoomPath } from "@/lib/room";
import { useSession, type Session } from "@/lib/session";

type Panel = "menu" | "account";

/**
 * The app's navigation, floating at the bottom: the account on the left, the
 * app's name with the account's username (or an invitation to sign in) under
 * it, and the menu on the right. Either one opens a panel above the bar; the
 * other one swaps its content without closing it. In a room, it rests as a
 * bubble around the menu button.
 */
export function BottomBar() {
  // usePathname is request-time on dynamic routes: their static shell has no bar until the page runs.
  return (
    <Suspense fallback={null}>
      <BottomBarForPath />
    </Suspense>
  );
}

function BottomBarForPath() {
  return <Bar isInRoom={isRoomPath(usePathname())} />;
}

function Bar({ isInRoom }: { isInRoom: boolean }) {
  const { dict } = useI18n();
  const session = useSession();
  const redirect = useAuthRedirect();
  const isVisibleOnScroll = useHideOnScroll();
  const { signOut, confirmation } = useSignOut();
  const { openPanel, renderedPanel, panelHeight, panelContentRef, toggle, close, onPanelTransitionEnd } = usePanels();
  const isOpen = openPanel !== null;
  useCloseAccountPanelOnSignOut(session?.account?.sub ?? null, openPanel, close);

  useCloseOnEscapeAndBack(close);
  const accountAction = accountActionFor(session, () => toggle("account"));
  const incomingFriendRequests = useIncomingFriendRequests(session?.stats ? session.account?.sub : undefined);
  const pending = pendingCount(accountAction, session, incomingFriendRequests);
  const barRef = useRef<HTMLDivElement>(null);
  const { isBubble, unfold, keepUnfolded } = useBubble({ isInRoom, isOpen, isVisible: isVisibleOnScroll, barRef });

  function closeOnLinkClick(event: React.MouseEvent) {
    if ((event.target as HTMLElement).closest("a")) close();
  }

  return (
    <>
      <MenuBackdrop isOpen={isOpen} onClose={close} />
      {/* The bar's full width: the bubble shrinks toward its right end, where the menu button stays. */}
      <div
        className="@container pointer-events-none fixed bottom-(--bar-gap) left-1/2 z-40 flex w-[95%] max-w-2xl justify-end transition-transform duration-500 ease-in-out"
        style={{ transform: `translate(-50%, ${isVisibleOnScroll || isOpen ? "0" : "calc(100% + 2rem)"})` }}
      >
        <div
          ref={barRef}
          data-bar-open={isOpen || undefined}
          onClick={closeOnLinkClick}
          onPointerDown={keepUnfolded}
          className={`theme-dark pointer-events-auto flex max-h-[calc(100dvh-env(safe-area-inset-top)-2*var(--bar-gap))] flex-col overflow-hidden text-fg shadow-lg backdrop-blur-md transition-all duration-500 ease-in-out rounded-concentric sm:rounded-xl md:rounded-2xl ${isBubble ? "w-20 md:w-24" : "w-full"} ${isOpen ? "bg-bg/70" : "bg-(--bar-veil)"}`}
        >
          {/* Shrinks and scrolls when the screen is too short for the whole panel above the bar. */}
          <div
            className="min-h-0 overflow-y-auto overscroll-contain transition-[height] duration-500 ease-in-out"
            style={{ height: isOpen ? panelHeight : 0 }}
            onTransitionEnd={onPanelTransitionEnd}
          >
            <div ref={panelContentRef}>
              {/* Keyed: switching panels replays the rows' entrance while the height follows. */}
              {renderedPanel === "menu" && <MenuPanel key="menu" />}
              {renderedPanel === "account" && session?.account && <AccountPanel key="account" session={session} incomingFriendRequests={incomingFriendRequests} onSignOut={signOut} />}
            </div>
          </div>

          {/* As wide as the whole bar even in the bubble, which clips it from the left. */}
          <div className={`relative flex w-[100cqw] shrink-0 items-center justify-between self-end px-2 pb-2 transition-[padding] duration-500 ${isOpen ? "pt-4" : "pt-2"}`}>
            <span
              aria-hidden
              className={`absolute top-0 left-[2.5%] h-px w-[95%] origin-left bg-fg/20 transition-transform duration-250 ease-in-out ${isOpen ? "scale-x-100 delay-500" : "scale-x-0"}`}
            />
            <span inert={isBubble} className="flex min-w-0 flex-1 items-center gap-4">
              <AccountTile action={accountAction} redirect={redirect} pending={pending} isAccountOpen={openPanel === "account"} isBarOpen={isOpen} />
              <span className="flex min-w-0 flex-1 flex-col items-start justify-center gap-0.5">
                <SiteTitle className="w-fit font-bold tracking-wide uppercase md:text-lg" />
                <AccountLine action={accountAction} redirect={redirect} />
              </span>
            </span>
            <button
              type="button"
              onClick={isBubble ? unfold : () => toggle("menu")}
              aria-expanded={openPanel === "menu"}
              aria-label={isBubble ? withPendingLabel(dict.bar.showBar, pending, dict.bar.pending) : openPanel === "menu" ? dict.bar.closeMenu : dict.bar.openMenu}
              className="relative grid size-16 shrink-0 place-items-center transition-[opacity,scale] duration-300 hover:opacity-70 active:scale-90 md:size-20"
            >
              <MenuIcon shape={openPanel === "menu" ? "cross" : isBubble ? "dots" : "lines"} className="size-6 md:size-8" />
              {isBubble && <NotificationBadge count={pending} className="absolute top-0.5 right-0.5" />}
            </button>
          </div>
        </div>
      </div>
      {confirmation}
    </>
  );
}

/** Behind an open panel: blurs the page, lightened in dark mode so the dark panel stands out, and closes the panel on click. */
function MenuBackdrop({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <div
      aria-hidden
      onClick={onClose}
      className={`fixed inset-0 z-30 backdrop-blur-sm transition-opacity duration-500 dark:bg-white/10 ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
    />
  );
}

type Account = NonNullable<Session["account"]>;
type AccountAction =
  | { kind: "unknown" }
  | { kind: "none" }
  | { kind: "sign-in"; run: () => void }
  | { kind: "panel"; run: () => void; account: Account };

/** What the account's tile and line do: nothing until the session is known (or without accounts), sign in, or open the account panel. */
function accountActionFor(session: Session | null, toggleAccountPanel: () => void): AccountAction {
  if (!session) return { kind: "unknown" };
  if (!session.enabled) return { kind: "none" };
  if (!session.account) return { kind: "sign-in", run: () => goToAuth("in") };
  return { kind: "panel", run: toggleAccountPanel, account: session.account };
}

/** What waits for the account: signing in when signed out, else its friend requests and a passkey to add. */
function pendingCount(action: AccountAction, session: Session | null, incomingFriendRequests: number): number {
  if (action.kind === "sign-in") return 1;
  if (action.kind !== "panel") return 0;
  return incomingFriendRequests + (session?.noPasskey ? 1 : 0);
}

/** A button's label, with how many things wait for the account when any do. */
function withPendingLabel(label: string, pending: number, pendingTemplate: string) {
  return pending > 0 ? `${label}, ${format(pendingTemplate, { count: pending })}` : label;
}

const TILE_BUTTON = "relative cursor-pointer rounded-lg transition-transform active:scale-95 md:rounded-xl";

/** The account's face, or a sign-in icon, with a count of what waits for it; a spinner while either is on its way. */
function AccountTile({
  action,
  redirect,
  pending,
  isAccountOpen,
  isBarOpen,
}: {
  action: AccountAction;
  redirect: AuthDestination | null;
  pending: number;
  isAccountOpen: boolean;
  isBarOpen: boolean;
}) {
  const { dict } = useI18n();
  // A circle in the closed capsule; opening, it unfolds, keeping only the corner by the bar's bottom-left.
  const roundCorner = isBarOpen ? "bottom-left" : "all";
  if (action.kind === "none") return <BarTile roundCorner={roundCorner}>{null}</BarTile>;
  if (action.kind === "unknown") {
    return (
      <BarTile roundCorner={roundCorner}>
        <BarSpinner />
      </BarTile>
    );
  }

  const withPending = (label: string) => withPendingLabel(label, pending, dict.bar.pending);
  const badge = <NotificationBadge count={pending} className="absolute -top-1 -right-1" />;

  if (action.kind === "sign-in") {
    return (
      <button type="button" onClick={action.run} aria-label={withPending(dict.account.signIn)} aria-busy={!!redirect} className={`group ${TILE_BUTTON}`}>
        <BarTile roundCorner={roundCorner}>
          {redirect ? <BarSpinner /> : <BarIcon icon={CircleUserRound} />}
        </BarTile>
        {badge}
      </button>
    );
  }

  const { account } = action;
  return (
    <button
      type="button"
      onClick={action.run}
      aria-expanded={isAccountOpen}
      aria-label={withPending(isAccountOpen ? dict.bar.closeAccount : dict.bar.openAccount)}
      aria-busy={!!redirect}
      className={TILE_BUTTON}
    >
      <BarTile roundCorner={roundCorner}>
        {redirect ? <BarSpinner /> : <Face name={account.name} src={account.picture} className="size-full rounded-none text-2xl" />}
      </BarTile>
      {badge}
    </button>
  );
}

const ACCOUNT_LINE_TEXT = "text-xs font-medium md:text-sm";

/** Under the app's name: the account's username, or an invitation to sign in, or what is on its way. Doing the same as the tile. */
function AccountLine({ action, redirect }: { action: AccountAction; redirect: AuthDestination | null }) {
  // An empty line of the same height: the bar keeps its size until the session is known.
  if (action.kind === "unknown") return <span aria-hidden className={`invisible ${ACCOUNT_LINE_TEXT}`}>&nbsp;</span>;
  if (action.kind === "none") return null;

  return (
    <button type="button" onClick={action.run} className={`w-full cursor-pointer truncate text-left opacity-70 ${ACCOUNT_LINE_TEXT}`}>
      <AccountLineLabel action={action} redirect={redirect} />
    </button>
  );
}

const REDIRECT_LABEL = { in: "signingIn", out: "signingOut", account: "openingAccount" } as const satisfies Record<AuthDestination, string>;

function AccountLineLabel({ action, redirect }: { action: Exclude<AccountAction, { kind: "unknown" | "none" }>; redirect: AuthDestination | null }) {
  const { dict } = useI18n();
  if (redirect) return dict.account[REDIRECT_LABEL[redirect]];
  if (action.kind === "sign-in") return <SignInInvitation />;
  return action.account.username ?? action.account.name;
}

/** "Sign in" on phones, where the bar is narrow; the whole invitation on wider screens. */
function SignInInvitation() {
  const { dict } = useI18n();
  return (
    <>
      <span className="sm:hidden">{dict.account.signIn}</span>
      <span className="hidden sm:inline">{dict.bar.signInInvite}</span>
    </>
  );
}

/**
 * Which panel is open, and its height: animated from the measured content, so
 * opening, closing and switching all slide. The closing panel stays rendered
 * until the height reaches zero.
 */
function usePanels() {
  const [openPanel, setOpenPanel] = useState<Panel | null>(null);
  const [renderedPanel, setRenderedPanel] = useState<Panel | null>(null);
  const [panelHeight, setPanelHeight] = useState(0);
  const panelContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const content = panelContentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => setPanelHeight(content.offsetHeight));
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  function toggle(panel: Panel) {
    if (openPanel === panel) return close();
    setRenderedPanel(panel);
    setOpenPanel(panel);
  }

  function close() {
    setOpenPanel(null);
  }

  function onPanelTransitionEnd(event: React.TransitionEvent) {
    if (event.target === event.currentTarget && openPanel === null) setRenderedPanel(null);
  }

  return { openPanel, renderedPanel, panelHeight, panelContentRef, toggle, close, onPanelTransitionEnd };
}

/** Signed out while the account's panel is open (from another device, say): nothing is left to show in it. */
function useCloseAccountPanelOnSignOut(accountSub: string | null, openPanel: Panel | null, close: () => void) {
  const [shownAccountSub, setShownAccountSub] = useState(accountSub);
  if (accountSub === shownAccountSub) return;
  setShownAccountSub(accountSub);
  if (!accountSub && openPanel === "account") close();
}

function useCloseOnEscapeAndBack(close: () => void) {
  const latestClose = useRef(close);
  useEffect(() => {
    latestClose.current = close;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") latestClose.current();
    };
    const onPopState = () => latestClose.current();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);
}
