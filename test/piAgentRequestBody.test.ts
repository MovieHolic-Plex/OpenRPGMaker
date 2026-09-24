// @vitest-environment node
import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { piRequestBody } from "../src/ai/piAgent/requestBody";
import { readRequestJson } from "../scripts/lib/companionHttpUtil.mjs";

async function decode(value: unknown) {
  const wire = await piRequestBody(value);
  const request = Object.assign(Readable.from([Buffer.from(wire.body as ArrayBuffer)]), {
    method: "POST", headers: { "content-encoding": new Headers(wire.headers).get("Content-Encoding") ?? "identity" },
  });
  return { wire, value: await readRequestJson(request) };
}

describe("Pi project request transport", () => {
  it("preserves embedded references and checkpoint fields through gzip", async () => {
    const project = { tilesets: { pack: { image: "data:image/png;base64," + "a".repeat(1024 * 1024) } } };
    for (const payload of [{ project, task: "author" }, { project, checkpointId: "step1", ok: true }]) {
      const result = await decode(payload);
      expect(new Headers(result.wire.headers).get("Content-Encoding")).toBe("gzip");
      expect(result.value).toEqual(payload);
    }
  });

  it("keeps small requests compatible and honors cancellation", async () => {
    const small = await piRequestBody({ checkpointId: "1", ok: false });
    expect(typeof small.body).toBe("string");
    expect(new Headers(small.headers).has("Content-Encoding")).toBe(false);
    const controller = new AbortController();
    controller.abort();
    await expect(piRequestBody({}, controller.signal)).rejects.toThrow();
  });

  it("rejects damaged gzip instead of silently replacing the project", async () => {
    const request = Object.assign(Readable.from([Buffer.from("not gzip")]), {
      method: "POST", headers: { "content-encoding": "gzip" },
    });
    await expect(readRequestJson(request)).rejects.toThrow();
  });
});
