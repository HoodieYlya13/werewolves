// Push notifications for invites (see party/push.ts). A push carries nothing:
// this asks the site for the latest invite and shows it. Nothing is cached.

const TEXT = {
  en: { title: "{name} invites you to play", body: "Room {code}. Tap to join.", generic: "A friend invites you to play", genericBody: "Open the app to join." },
  fr: { title: "{name} vous invite à jouer", body: "Partie {code}. Touchez pour rejoindre.", generic: "Un ami vous invite à jouer", genericBody: "Ouvrez l'application pour rejoindre." },
};

const lang = () => ((self.navigator.language || "en").toLowerCase().startsWith("fr") ? "fr" : "en");

self.addEventListener("push", (event) => {
  event.waitUntil(showInvite());
});

async function showInvite() {
  const locale = lang();
  const t = TEXT[locale];
  let invite = null;
  try {
    const res = await fetch("/api/auth/invites", { credentials: "include", cache: "no-store" });
    if (res.ok) invite = (await res.json()).invites[0] ?? null;
  } catch {}
  // Browsers expect a notification for every push, even when the invite can't be read (signed out).
  const options = invite
    ? { body: t.body.replace("{code}", invite.room), tag: `invite-${invite.room}`, data: { url: `/${locale}/play/${invite.room}` } }
    : { body: t.genericBody, tag: "invite", data: { url: `/${locale}` } };
  const title = invite ? t.title.replace("{name}", invite.from.name) : t.generic;
  return self.registration.showNotification(title, { ...options, icon: "/icons/icon-192.png", renotify: true });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(openPage(url));
});

/** Into an open window of the app if there is one, else a new one. */
async function openPage(url) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    if ("navigate" in client) {
      await client.focus();
      return client.navigate(url);
    }
  }
  return self.clients.openWindow(url);
}
