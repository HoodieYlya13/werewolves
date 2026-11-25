"use client";

import { useEffect, useRef, useState } from "react";
import { CircleUserRound, Menu, X } from "lucide-react";
import { goToAuth } from "@/components/account-button";
import { AccountMarquee } from "@/components/bottom-bar/account-marquee";
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
 * app's name with the account's stats scrolling under it, and the menu on the
 * right. Either one opens a panel above the bar; the other one swaps its
 * content without closing it.
 */
export function BottomBar() {
  const { dict } = useI18n();
  const session = useSession();
  const isVisibleOnScroll = useHideOnScroll();
  const { signOut, confirmation } = useSignOut();
  const { openPanel, renderedPanel, panelHeight, panelContentRef, toggle, close, onPanelTransitionEnd } = usePanels();
  const isOpen = openPanel !== null;

  useCloseOnEscapeAndBack(close);

  function closeOnLinkClick(event: React.MouseEvent) {
    if ((event.target as HTMLElement).closest("a")) close();
  }

  return (
    <>
      {isOpen && <div aria-hidden className="fixed inset-0 z-30" onClick={close} />}
      <div
        data-bar-open={isOpen || undefined}
        onClick={closeOnLinkClick}
        className={`theme-dark fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex w-[95%] max-w-2xl flex-col overflow-hidden rounded-xl text-fg shadow-lg backdrop-blur-md transition-all duration-500 ease-in-out md:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] md:rounded-2xl ${isOpen ? "bg-bg/70" : "bg-(--bar-veil)"}`}
        style={{ transform: `translate(-50%, ${isVisibleOnScroll || isOpen ? "0" : "calc(100% + 2rem + env(safe-area-inset-bottom))"})` }}
      >
        <div
          className="overflow-hidden transition-[height] duration-500 ease-in-out"
          style={{ height: isOpen ? panelHeight : 0 }}
          onTransitionEnd={onPanelTransitionEnd}
        >
          <div ref={panelContentRef} className="max-h-[70dvh] overflow-y-auto overscroll-contain">
            {/* Keyed: switching panels replays the rows' entrance while the height follows. */}
            {renderedPanel === "menu" && <MenuPanel key="menu" />}
            {renderedPanel === "account" && session?.account && <AccountPanel key="account" session={session} onSignOut={signOut} />}
          </div>
        </div>

        <div className={`relative flex items-center justify-between px-2 pb-2 transition-[padding] duration-500 ${isOpen ? "pt-4" : "pt-2"}`}>
          <span
            aria-hidden
            className={`absolute top-0 left-[2.5%] h-px w-[95%] origin-left bg-fg/20 transition-transform duration-250 ease-in-out ${isOpen ? "scale-x-100 delay-500" : "scale-x-0"}`}
          />
          <span className="flex min-w-0 flex-1 items-center gap-4">
            <AccountTile session={session} isAccountOpen={openPanel === "account"} onToggle={() => toggle("account")} />
            <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
              <SiteTitle className="w-fit font-bold tracking-wide uppercase md:text-lg" />
              <AccountMarquee session={session} />
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

/** The account's face: opens its panel, or starts signing in. Until the session is known, an empty tile. */
function AccountTile({ session, isAccountOpen, onToggle }: { session: Session | null; isAccountOpen: boolean; onToggle: () => void }) {
  const { dict } = useI18n();
  if (!session || !session.enabled) return <BarTile>{null}</BarTile>;

  if (!session.account) {
    return (
      <button type="button" onClick={() => goToAuth("in")} aria-label={dict.account.signIn} className="group rounded-lg md:rounded-xl">
        <BarTile>
          <BarIcon icon={CircleUserRound} />
        </BarTile>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isAccountOpen}
      aria-label={isAccountOpen ? dict.bar.closeAccount : dict.bar.openAccount}
      className="rounded-lg md:rounded-xl"
    >
      <BarTile>
        <Face name={session.account.name} src={session.account.picture} className="size-full rounded-none text-2xl" />
      </BarTile>
    </button>
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
