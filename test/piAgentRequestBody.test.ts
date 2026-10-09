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

  // 2026-09-28 실측: 새 빈 프로젝트 첫 Pi 요청이 gzip 69MB 였고 옛 64MiB 상한이 매번 끊었다.
  it("accepts a compressed body above the old 64MiB cap", async () => {
    const chunk = Buffer.alloc(1024 * 1024, 0x20);
    const chunks = Array.from({ length: 70 }, () => chunk);
    const request = Object.assign(Readable.from([...chunks, Buffer.from("{}")]), { method: "POST", headers: {} });
    await expect(readRequestJson(request)).resolves.toEqual({});
  });
});
