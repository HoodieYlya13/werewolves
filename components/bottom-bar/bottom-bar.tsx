"use client";

import { useEffect, useRef, useState } from "react";
import { CircleUserRound, Menu, X } from "lucide-react";
import { goToAuth } from "@/components/account-button";
import { AccountPanel } from "@/components/bottom-bar/account-panel";
import { BarIcon, BarTile } from "@/components/bottom-bar/bar-row";
import { MenuPanel } from "@/components/bottom-bar/menu-panel";
import { useI18n } from "@/components/i18n-provider";
import { Face } from "@/components/room-context";
import { SiteTitle } from "@/components/site-title";
import { useSignOut } from "@/components/sign-out";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";
import { useSession, type Session } from "@/lib/session";

type Panel = "menu" | "account";

/**
 * The app's navigation, floating at the bottom: the account on the left, the
 * app's name with the account's username (or an invitation to sign in) under
 * it, and the menu on the right. Either one opens a panel above the bar; the
 * other one swaps its content without closing it.
 */
export function BottomBar() {
  const { dict } = useI18n();
  const session = useSession();
  const isVisibleOnScroll = useHideOnScroll();
  const { signOut, confirmation } = useSignOut();
  const { openPanel, renderedPanel, panelHeight, panelContentRef, toggle, close, onPanelTransitionEnd } = usePanels();
  const isOpen = openPanel !== null;

  useCloseOnEscapeAndBack(close);
  const accountAction = accountActionFor(session, () => toggle("account"));

  function closeOnLinkClick(event: React.MouseEvent) {
    if ((event.target as HTMLElement).closest("a")) close();
  }

  return (
    <>
      {isOpen && <div aria-hidden className="fixed inset-0 z-30" onClick={close} />}
      <div
        data-bar-open={isOpen || undefined}
        onClick={closeOnLinkClick}
        className={`theme-dark fixed bottom-(--bar-gap) left-1/2 z-40 flex max-h-[calc(100dvh-env(safe-area-inset-top)-2*var(--bar-gap))] w-[95%] max-w-2xl flex-col overflow-hidden text-fg shadow-lg backdrop-blur-md transition-all duration-500 ease-in-out sm:rounded-xl md:rounded-2xl ${isOpen ? "rounded-t-concentric rounded-b-screen bg-bg/70" : "rounded-screen bg-(--bar-veil)"}`}
        style={{ transform: `translate(-50%, ${isVisibleOnScroll || isOpen ? "0" : "calc(100% + 2rem)"})` }}
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
            {renderedPanel === "account" && session?.account && <AccountPanel key="account" session={session} onSignOut={signOut} />}
          </div>
        </div>

        <div className={`relative flex shrink-0 items-center justify-between px-2 pb-2 transition-[padding] duration-500 ${isOpen ? "pt-4" : "pt-2"}`}>
          <span
            aria-hidden
            className={`absolute top-0 left-[2.5%] h-px w-[95%] origin-left bg-fg/20 transition-transform duration-250 ease-in-out ${isOpen ? "scale-x-100 delay-500" : "scale-x-0"}`}
          />
          <span className="flex min-w-0 flex-1 items-center gap-4">
            <AccountTile action={accountAction} isAccountOpen={openPanel === "account"} />
            <span className="flex min-w-0 flex-1 flex-col items-start justify-center gap-0.5">
              <SiteTitle className="w-fit font-bold tracking-wide uppercase md:text-lg" />
              <AccountLine action={accountAction} />
            </span>
          </span>
          <button
            type="button"
            onClick={() => toggle("menu")}
            aria-expanded={openPanel === "menu"}
            aria-label={openPanel === "menu" ? dict.bar.closeMenu : dict.bar.openMenu}
            className="p-3 transition-opacity duration-300 hover:opacity-70"
          >
            {openPanel === "menu" ? <X aria-hidden className="size-6 md:size-8" /> : <Menu aria-hidden className="size-6 md:size-8" />}
          </button>
        </div>
      </div>
      {confirmation}
    </>
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

/** The account's face, or a sign-in icon. */
function AccountTile({ action, isAccountOpen }: { action: AccountAction; isAccountOpen: boolean }) {
  const { dict } = useI18n();
  if (action.kind === "unknown" || action.kind === "none") return <BarTile>{null}</BarTile>;

  if (action.kind === "sign-in") {
    return (
      <button type="button" onClick={action.run} aria-label={dict.account.signIn} className="group rounded-full sm:rounded-lg md:rounded-xl">
        <BarTile>
          <BarIcon icon={CircleUserRound} />
        </BarTile>
      </button>
    );
  }

  const { account } = action;
  return (
    <button
      type="button"
      onClick={action.run}
      aria-expanded={isAccountOpen}
      aria-label={isAccountOpen ? dict.bar.closeAccount : dict.bar.openAccount}
      className="rounded-full sm:rounded-lg md:rounded-xl"
    >
      <BarTile>
        <Face name={account.name} src={account.picture} className="size-full rounded-none text-2xl" />
      </BarTile>
    </button>
  );
}

const ACCOUNT_LINE_TEXT = "text-xs font-medium md:text-sm";

/** Under the app's name: the account's username, or an invitation to sign in. Doing the same as the tile. */
function AccountLine({ action }: { action: AccountAction }) {
  // An empty line of the same height: the bar keeps its size until the session is known.
  if (action.kind === "unknown") return <span aria-hidden className={`invisible ${ACCOUNT_LINE_TEXT}`}>&nbsp;</span>;
  if (action.kind === "none") return null;

  return (
    <button type="button" onClick={action.run} className={`w-full truncate text-left opacity-70 ${ACCOUNT_LINE_TEXT}`}>
      {action.kind === "sign-in" ? <SignInInvitation /> : (action.account.username ?? action.account.name)}
    </button>
  );
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
