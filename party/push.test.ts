import { createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { vapid } from "./push";

describe("vapid", () => {
  it("signs a JWT for the push service's origin that its public key verifies", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const pub = publicKey.export({ format: "jwk" });
    const point = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x!, "base64url"), Buffer.from(pub.y!, "base64url")]).toString("base64url");
    const keys = { NEXT_PUBLIC_VAPID_PUBLIC_KEY: point, VAPID_PRIVATE_KEY: privateKey.export({ format: "jwk" }).d! };

    const header = await vapid("https://fcm.googleapis.com/fcm/send/abc", keys, "https://example.com");
    const [, jwt, k] = header.match(/^vapid t=([^,]+), k=(.+)$/)!;
    expect(k).toBe(point);
    const [head, body, signature] = jwt.split(".");
    const claims = JSON.parse(Buffer.from(body, "base64url").toString());
    expect(JSON.parse(Buffer.from(head, "base64url").toString())).toEqual({ typ: "JWT", alg: "ES256" });
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(claims.sub).toBe("https://example.com");
    expect(claims.exp).toBeGreaterThan(Date.now() / 1000);
    const ok = verify("sha256", Buffer.from(`${head}.${body}`), { key: createPublicKey({ key: pub, format: "jwk" }), dsaEncoding: "ieee-p1363" }, Buffer.from(signature, "base64url"));
    expect(ok).toBe(true);
  });
});
