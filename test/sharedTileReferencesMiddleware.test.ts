import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSharedTileReferences } from "@/project/sharedTileReferences";
import { sharedTileReferencesMiddleware } from "../scripts/lib/sharedTileReferencesSqlite";

const MISSING = "/tmp/oprn-shared-tile-references-missing.sqlite";

function respond(url: string, headers: Record<string, string> = {}) {
  const chunks: Buffer[] = [];
  let status = 0;
  let responseHeaders: Record<string, unknown> = {};
  const req = { url, method: "GET", headers } as IncomingMessage;
  const res = {
    writeHead(code: number, nextHeaders?: Record<string, unknown>) {
      status = code;
      responseHeaders = nextHeaders ?? {};
      return res;
    },
    end(body?: Buffer | string) {
      if (body) chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(body));
    },
  } as unknown as ServerResponse;
  return { req, res, done: () => ({ status, headers: responseHeaders, body: Buffer.concat(chunks).toString("utf8") }) };
}

describe("shared tile reference fetch", () => {
  const previous = process.env.OPRN_SHARED_CONTENT_SQLITE;

  afterEach(() => {
    if (previous === undefined) delete process.env.OPRN_SHARED_CONTENT_SQLITE;
    else process.env.OPRN_SHARED_CONTENT_SQLITE = previous;
  });

  it("returns JSON instead of the SPA html fallback when the catalog file is absent", () => {
    process.env.OPRN_SHARED_CONTENT_SQLITE = MISSING;
    const call = respond("/__oprn/shared-tile-references", { "accept-encoding": "identity" });
    let forwarded = false;
    sharedTileReferencesMiddleware(call.req, call.res, () => { forwarded = true; });
    const result = call.done();
    expect(forwarded).toBe(false);
    expect(result.status).toBe(200);
    expect(String(result.headers["content-type"])).toContain("application/json");
    expect(JSON.parse(result.body)).toEqual({ revision: "", entries: [] });
  });

  it("rejects an html body before parsing it as tile references", async () => {
    const previousWindow = (globalThis as { window?: unknown }).window;
    const previousFetch = globalThis.fetch;
    (globalThis as { window?: unknown }).window = {};
    globalThis.fetch = vi.fn(async () => new Response("<!doctype html><html></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    })) as typeof fetch;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      expect(await loadSharedTileReferences()).toBe(false);
      expect(warn.mock.calls.some((call) => String(call[0]).includes("공용 타일 참고문서"))).toBe(true);
    } finally {
      (globalThis as { window?: unknown }).window = previousWindow;
      globalThis.fetch = previousFetch;
      warn.mockRestore();
    }
  });
});
