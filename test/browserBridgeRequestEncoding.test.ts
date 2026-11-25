import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { bridgeJsonParts, encodeBridgeRequest } from "../electron/browser/requestBody";

describe("browser bridge request encoding", () => {
  it("matches JSON.stringify byte for byte across chunk boundaries", () => {
    const cases: unknown[] = [
      { a: 1, b: undefined, c: [undefined, () => 1, null, Number.NaN, "s"], d: new Date(0), e: { toJSON: () => undefined }, f: "가😀".repeat(50), g: [[1, 2], { h: "x".repeat(300) }], i: "" },
      { big: "a".repeat(1000) + "😀" + "b".repeat(1000), arr: ["😀".repeat(400), 1, { z: "q\n\"\u0001".repeat(200) }] },
      "top", 5, null, [], {}, [{ a: [] }],
    ];
    for (const value of cases) {
      for (const chunk of [1, 2, 3, 7, 64, 4096]) expect(bridgeJsonParts(value, chunk).join("")).toBe(JSON.stringify(value));
    }
  });

  it("never quotes a long string in one piece", () => {
    // 2026-09-28: Firefox threw «allocation size overflow» quoting a 187M-char full-save document in one go.
    const serialized = "x".repeat(1000);
    const parts = bridgeJsonParts({ channel: "oprn:project.save", payload: { serialized } }, 64);
    expect(parts.length).toBeGreaterThan(10);
    expect(Math.max(...parts.map((part) => part.length))).toBeLessThan(200);
    expect(JSON.parse(parts.join(""))).toEqual({ channel: "oprn:project.save", payload: { serialized } });
  });

  it("rejects cycles like JSON.stringify", () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(() => bridgeJsonParts(cycle)).toThrow(TypeError);
  });

  it("gzips the joined parts", async () => {
    const value = { channel: "oprn:project.save", payload: { serialized: "가".repeat(2 * 1024 * 1024) } };
    const encoded = await encodeBridgeRequest(value);
    expect(encoded.headers["content-encoding"]).toBe("gzip");
    const bytes = new Uint8Array(await (encoded.body as Blob).arrayBuffer());
    expect(gunzipSync(bytes).toString("utf8")).toBe(JSON.stringify(value));
  });
});
