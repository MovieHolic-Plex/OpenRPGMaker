import { beforeEach, describe, expect, it, vi } from "vitest";
import { SHARED_CONTENT_ENDPOINT } from "../src/project/sharedContentSchema";

const mocks = vi.hoisted(() => ({ handle: vi.fn(), response: vi.fn(), inflate: vi.fn() }));
vi.mock("electron", () => ({ protocol: { handle: mocks.handle } }));
vi.mock("node:zlib", () => ({ gunzipSync: mocks.inflate }));
vi.mock("../scripts/lib/sharedContentSqlite", () => ({
  SHARED_CONTENT_PREVIEW_CACHE: "private, max-age=31536000, immutable",
  sharedContentResponse: mocks.response,
  sharedContentPreviewResponse: vi.fn(), sharedReferenceImageResponse: vi.fn(),
}));
vi.mock("../scripts/lib/sharedCharacterGraphics", () => ({ sharedCharacterGraphicsResponse: vi.fn() }));
vi.mock("../scripts/lib/activityMirror.mjs", () => ({ handleActivityMirror: vi.fn(), isActivityMirrorPath: () => false }));
vi.mock("../scripts/lib/ohMyPiHttp.mjs", () => ({ isCompanionPath: () => false }));
import { registerAppProtocol } from "../electron/main/protocols";

let handler: (request: Request) => Promise<Response>;
beforeEach(() => {
  vi.clearAllMocks();
  registerAppProtocol("/unused-renderer", () => "/unused-log");
  handler = mocks.handle.mock.calls[0]![1];
});

describe("native shared catalog conditional reads", () => {
  it.each(["defaults", "rest", "all"])("returns a bodyless %s 304 before inflate", async scope => {
    const etag = `"${scope}-revision"`;
    // An erroneous future backend gzip alongside 304 must still never be touched.
    mocks.response.mockReturnValue({ status: 304, etag, gzip: Buffer.from("invalid gzip") });
    const url = `app://oprn${SHARED_CONTENT_ENDPOINT}?scope=${scope}`;
    const result = await handler(new Request(url, { headers: { "If-None-Match": etag } }));
    expect(mocks.response).toHaveBeenCalledWith("GET", new URL(url), etag);
    expect(result.status).toBe(304);
    expect(result.body).toBeNull();
    expect(result.headers.get("etag")).toBe(etag);
    expect(mocks.inflate).not.toHaveBeenCalled();
  });

  it("keeps 200 validator and payload, and forwards a changed validator", async () => {
    mocks.response.mockReturnValue({ status: 200, etag: '"defaults-new"', gzip: Buffer.from("encoded") });
    mocks.inflate.mockReturnValue(Buffer.from('{"revision":"new","libraries":{}}'));
    const result = await handler(new Request(`app://oprn${SHARED_CONTENT_ENDPOINT}?scope=defaults`, {
      headers: { "If-None-Match": '"defaults-old"' },
    }));
    expect(result.status).toBe(200);
    expect(result.headers.get("etag")).toBe('"defaults-new"');
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(result.headers.get("content-encoding")).toBeNull();
    expect(await result.json()).toEqual({ revision: "new", libraries: {} });
    expect(mocks.inflate).toHaveBeenCalledOnce();
    expect(mocks.response.mock.calls[0]![2]).toBe('"defaults-old"');
  });

  it.each([405, 500])("preserves %s JSON error semantics without inflation", async status => {
    mocks.response.mockReturnValue({ status, body: { error: "catalog unavailable" } });
    const result = await handler(new Request(`app://oprn${SHARED_CONTENT_ENDPOINT}`, { method: status === 405 ? "POST" : "GET" }));
    expect(result.status).toBe(status);
    expect(await result.json()).toEqual({ error: "catalog unavailable" });
    expect(mocks.inflate).not.toHaveBeenCalled();
  });
});
