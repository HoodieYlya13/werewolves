import { createHmac } from "node:crypto";
import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { signTicket, ticketKey, verifyTicket } from "./ticket";

const sam = { sub: "sub-sam", name: "Sam", picture: null, username: "sam_w" };

describe("tickets", () => {
  it("stand for the account, for the server they name", async () => {
    const key = await ticketKey({ clientSecret: "secret" });
    const ticket = await signTicket(key!, { room: "ABCD" }, sam);
    expect(await verifyTicket(key, ticket, { room: "ABCD" })).toMatchObject(sam);
    expect(await verifyTicket(key, ticket, { room: "WXYZ" })).toBeNull();
    expect(await verifyTicket(key, ticket, "account")).toBeNull();
  });

  it("carry the device's sign-in for the account server", async () => {
    const key = await ticketKey({ clientSecret: "secret" });
    const ticket = await signTicket(key!, "account", sam, "session-1");
    expect(await verifyTicket(key, ticket, "account")).toMatchObject({ sub: "sub-sam", sid: "session-1" });
  });

  it("are refused when signed with another key, expired, or not tickets", async () => {
    const key = await ticketKey({ clientSecret: "secret" });
    const other = await ticketKey({ clientSecret: "other" });
    expect(await verifyTicket(key, await signTicket(other!, "account", sam), "account")).toBeNull();
    const expired = await new SignJWT({ name: "Sam", picture: null })
      .setProtectedHeader({ alg: "HS256", typ: "ww-ticket" })
      .setIssuer("werewolves").setAudience("account").setSubject("sub-sam").setJti("j")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120).setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(key!);
    expect(await verifyTicket(key, expired, "account")).toBeNull();
    expect(await verifyTicket(key, "not-a-ticket", "account")).toBeNull();
    expect(await verifyTicket(null, await signTicket(key!, "account", sam), "account")).toBeNull();
  });

  it("use the same key on the Worker as on the site (deploy script derivation)", async () => {
    const deployed = createHmac("sha256", "secret").update("werewolves-ticket-v1").digest("base64url");
    expect(await ticketKey({ key: deployed })).toEqual(await ticketKey({ clientSecret: "secret" }));
  });
});
