import { describe, it, expect } from "vitest";
import { reviveBuffers } from "./control-client.js";

describe("reviveBuffers", () => {
  it("returns null unchanged", () => {
    expect(reviveBuffers(null)).toBe(null);
  });

  it("returns undefined unchanged", () => {
    expect(reviveBuffers(undefined)).toBe(undefined);
  });

  it("returns string unchanged", () => {
    expect(reviveBuffers("hello")).toBe("hello");
  });

  it("returns number unchanged", () => {
    expect(reviveBuffers(42)).toBe(42);
  });

  it("returns boolean unchanged", () => {
    expect(reviveBuffers(true)).toBe(true);
    expect(reviveBuffers(false)).toBe(false);
  });

  it("revives a serialised Buffer", () => {
    const serialised = { type: "Buffer", data: [72, 101, 108, 108, 111] };
    const result = reviveBuffers(serialised);

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toEqual(Buffer.from([72, 101, 108, 108, 111]));
    expect(result.toString()).toBe("Hello");
  });

  it("revives empty Buffer", () => {
    const serialised = { type: "Buffer", data: [] };
    const result = reviveBuffers(serialised);

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toEqual(Buffer.from([]));
    expect(result.length).toBe(0);
  });

  it("revives Buffers nested in objects", () => {
    const input = {
      name: "test",
      body: { type: "Buffer", data: [104, 101, 108, 108, 111] },
      other: "value",
    };

    const result = reviveBuffers(input);

    expect(result.name).toBe("test");
    expect(result.other).toBe("value");
    expect(Buffer.isBuffer(result.body)).toBe(true);
    expect(result.body.toString()).toBe("hello");
  });

  it("revives Buffers nested in arrays", () => {
    const input = [{ type: "Buffer", data: [65] }, "string", { type: "Buffer", data: [66] }];

    const result = reviveBuffers(input);

    expect(Buffer.isBuffer(result[0])).toBe(true);
    expect(result[0].toString()).toBe("A");
    expect(result[1]).toBe("string");
    expect(Buffer.isBuffer(result[2])).toBe(true);
    expect(result[2].toString()).toBe("B");
  });

  it("handles deep nesting: objects containing arrays of objects with Buffers", () => {
    const input = {
      requests: [
        {
          id: "1",
          body: { type: "Buffer", data: [72, 105] },
          metadata: {
            nested: { type: "Buffer", data: [33] },
          },
        },
        {
          id: "2",
          items: [
            { type: "Buffer", data: [97] },
            { type: "Buffer", data: [98] },
          ],
        },
      ],
    };

    const result = reviveBuffers(input);

    expect(result.requests[0].id).toBe("1");
    expect(Buffer.isBuffer(result.requests[0].body)).toBe(true);
    expect(result.requests[0].body.toString()).toBe("Hi");
    expect(Buffer.isBuffer(result.requests[0].metadata.nested)).toBe(true);
    expect(result.requests[0].metadata.nested.toString()).toBe("!");

    expect(result.requests[1].id).toBe("2");
    expect(Buffer.isBuffer(result.requests[1].items[0])).toBe(true);
    expect(result.requests[1].items[0].toString()).toBe("a");
    expect(Buffer.isBuffer(result.requests[1].items[1])).toBe(true);
    expect(result.requests[1].items[1].toString()).toBe("b");
  });

  it("does NOT convert objects that have type and data but type !== 'Buffer'", () => {
    const input = { type: "NotBuffer", data: [1, 2, 3] };
    const result = reviveBuffers(input);

    expect(Buffer.isBuffer(result)).toBe(false);
    expect(result).toEqual({ type: "NotBuffer", data: [1, 2, 3] });
  });

  it("does NOT convert objects that have type: 'Buffer' but data is not an array", () => {
    const input = { type: "Buffer", data: "not an array" };
    const result = reviveBuffers(input);

    expect(Buffer.isBuffer(result)).toBe(false);
    expect(result).toEqual({ type: "Buffer", data: "not an array" });
  });

  it("does NOT convert objects that have type: 'Buffer' but data is missing", () => {
    const input = { type: "Buffer" };
    const result = reviveBuffers(input);

    expect(Buffer.isBuffer(result)).toBe(false);
    expect(result).toEqual({ type: "Buffer" });
  });

  it("passes through regular objects without Buffer-like shape", () => {
    const input = { foo: "bar", nested: { value: 42 } };
    const result = reviveBuffers(input);

    expect(result).toEqual({ foo: "bar", nested: { value: 42 } });
  });

  it("round-trip test: serialise and revive Buffer", () => {
    const original = { body: Buffer.from("hello"), other: "data" };
    const serialised = JSON.parse(JSON.stringify(original));
    const revived = reviveBuffers(serialised);

    expect(Buffer.isBuffer(revived.body)).toBe(true);
    expect(revived.body).toEqual(Buffer.from("hello"));
    expect(revived.body.toString()).toBe("hello");
    expect(revived.other).toBe("data");
  });

  it("handles mixed content in round-trip", () => {
    const original = {
      id: 123,
      name: "test",
      requestBody: Buffer.from("POST data"),
      responseBody: Buffer.from("response"),
      timestamp: Date.now(),
      active: true,
    };

    const serialised = JSON.parse(JSON.stringify(original));
    const revived = reviveBuffers(serialised);

    expect(revived.id).toBe(original.id);
    expect(revived.name).toBe(original.name);
    expect(Buffer.isBuffer(revived.requestBody)).toBe(true);
    expect(revived.requestBody.toString()).toBe("POST data");
    expect(Buffer.isBuffer(revived.responseBody)).toBe(true);
    expect(revived.responseBody.toString()).toBe("response");
    expect(revived.timestamp).toBe(original.timestamp);
    expect(revived.active).toBe(original.active);
  });
});
