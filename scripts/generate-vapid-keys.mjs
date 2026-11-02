// Prints a new key pair for push notifications (Web Push / VAPID).
// Run with: node scripts/generate-vapid-keys.mjs
// Then add both lines to Vercel (Settings → Environment Variables, production
// and preview) and to .env.local. Changing the keys later drops every device's
// subscription: they turn notifications on again.
import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const pub = publicKey.export({ format: "jwk" });
const priv = privateKey.export({ format: "jwk" });
const point = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, "base64url"), Buffer.from(pub.y, "base64url")]);
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${point.toString("base64url")}`);
console.log(`VAPID_PRIVATE_KEY=${priv.d}`);
