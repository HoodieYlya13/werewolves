"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { currentPush, disablePush, enablePush, pushSupport, type PushSupport } from "@/lib/friends-client";

/** Notifications for friends' invites on this device. */
export function PushToggle() {
  const { dict } = useI18n();
  const t = dict.friends;
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<"denied" | "failed" | null>(null);

  useEffect(() => {
    const support = pushSupport();
    void (async () => {
      const subscribed = support === "ok" && !!(await currentPush());
      setSupport(support);
      setOn(subscribed);
      if (support === "ok" && Notification.permission === "denied") setProblem("denied");
    })();
  }, []);

  if (!support) return null;

  async function toggle() {
    setBusy(true);
    setProblem(null);
    if (on) {
      await disablePush();
      setOn(false);
    } else {
      const result = await enablePush();
      setOn(result === "on");
      if (result !== "on") setProblem(result);
    }
    setBusy(false);
  }

  const message =
    support === "install"
      ? t.notificationsInstall
      : support === "unsupported"
        ? t.notificationsUnsupported
        : problem === "denied"
          ? t.notificationsDenied
          : problem === "failed"
            ? t.notificationsFailed
            : on
              ? t.notificationsEnabled
              : t.notificationsHint;

  return (
    <section className="card flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{t.notifications}</h2>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        {support === "ok" && problem !== "denied" && (
          <Button type="button" variant={on ? "outline" : "default"} size="sm" disabled={busy} onClick={() => void toggle()} className="shrink-0">
            {on ? <BellOff aria-hidden /> : <Bell aria-hidden />}
            {on ? t.notificationsOff : t.notificationsOn}
          </Button>
        )}
      </div>
    </section>
  );
}
