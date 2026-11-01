"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Chrome and Edge's install prompt; not in the DOM types yet. */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function isInstalled() {
  return matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** iPads ask for the desktop site, so they look like a Mac with a touch screen. */
function isIos() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

const noSubscribe = () => () => {};

/**
 * "Install the app": the browser's own prompt where it has one (Android,
 * Chrome and Edge), a short guide to Share → Add to Home Screen on iPhone and
 * iPad, where a page can't install itself. Hidden once installed.
 */
export function InstallApp() {
  const { dict } = useI18n();
  const t = dict.install;
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  // Only known in the browser: the server renders no button.
  const ios = useSyncExternalStore(noSubscribe, () => isIos() && !isInstalled(), () => false);
  const [guide, setGuide] = useState(false);

  useEffect(() => {
    if (isInstalled()) return;
    const onPrompt = (e: Event) => {
      // Keep the browser's mini bar away; the button offers it instead.
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!prompt && !ios) return null;

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <Button
        variant="outline"
        onClick={async () => {
          if (!prompt) return setGuide(true);
          await prompt.prompt();
          // A prompt works once; the browser sends a new one if it's dismissed.
          setPrompt(null);
        }}
      >
        <Download aria-hidden />
        {t.button}
      </Button>
      <p className="max-w-sm text-sm text-pretty text-muted-foreground">{t.hint}</p>

      <Dialog open={guide} onOpenChange={setGuide}>
        <DialogContent closeLabel={dict.host.close} className="max-w-[min(26rem,calc(100vw-2rem))] sm:max-w-[26rem]">
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
            <DialogDescription>{t.description}</DialogDescription>
          </DialogHeader>
          <ol className="flex flex-col gap-4">
            <li className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-moon">
                <Share aria-hidden className="size-5" />
              </span>
              <span>{t.stepShare}</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-moon">
                <SquarePlus aria-hidden className="size-5" />
              </span>
              <span>{t.stepAdd}</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </div>
  );
}
