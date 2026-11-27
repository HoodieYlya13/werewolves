import { describe, expect, expectTypeOf, test } from "vitest";
import type * as z from "zod/mini";
import type { AccountClientMessage, ClientMessage } from "./protocol";
import { accountMessageSchemas, clientMessageSchemas, parseAccountMessage, parseClientMessage } from "./protocol-schemas";

type Flat<T> = T extends unknown ? { [K in keyof T]: T[K] } : never;
type Exact<A, B> = (<T>() => T extends Flat<A> ? 1 : 2) extends <T>() => T extends Flat<B> ? 1 : 2 ? true : false;
type Drifted<Message extends { type: string }, Schemas extends Record<Message["type"], z.ZodMiniType>> = {
  [Type in Message["type"]]: Exact<z.output<Schemas[Type]>, Extract<Message, { type: Type }>> extends true ? never : Type;
}[Message["type"]];

describe("message schemas", () => {
  test("describe exactly the protocol's messages", () => {
    expectTypeOf<Drifted<ClientMessage, typeof clientMessageSchemas>>().toEqualTypeOf<never>();
    expectTypeOf<Drifted<AccountClientMessage, typeof accountMessageSchemas>>().toEqualTypeOf<never>();
  });

  test("let well-formed messages through", () => {
    expect(parseClientMessage(JSON.stringify({ type: "join", name: "Ana" }))).toEqual({ type: "join", name: "Ana" });
    expect(parseClientMessage(JSON.stringify({ type: "play", action: { type: "witch", heal: true, poisonId: null } }))).not.toBeNull();
    expect(parseAccountMessage(JSON.stringify({ type: "resolve", takeOver: true }))).toEqual({ type: "resolve", takeOver: true });
  });

  test("turn away malformed and unknown messages", () => {
    expect(parseClientMessage("not json")).toBeNull();
    expect(parseClientMessage("null")).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "toString" }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "join", name: 42 }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "play", action: { type: "seer", targetId: ["x"] } }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "invite", subs: "everyone" }))).toBeNull();
    expect(parseAccountMessage(JSON.stringify({ type: "hello" }))).toBeNull();
  });

  test("drop fields a message doesn't have", () => {
    expect(parseClientMessage(JSON.stringify({ type: "undo", extra: "x" }))).toEqual({ type: "undo" });
  });
});
