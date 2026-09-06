import { describe, expect, test } from "bun:test";
import { completeProvider } from "../scripts/lib/ohMyPiPiAiRuntime.ts";
import { convertUserContent } from "../scripts/lib/ohMyPiUserContent.ts";
import { parseImageDelivery } from "../src/ai/imageDelivery.ts";

// A deterministic 1x1 PNG. Capture the real SDK's outgoing JSON, not a mock of complete().
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
const apiKey = JSON.stringify({ token: "offline-sentinel", projectId: "offline-project" });
const gif = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const images = [{ mimeType: "image/png", data: png }, { mimeType: "image/gif", data: gif }];

function reply(): Response {
  return new Response(`data: ${JSON.stringify({ response: { candidates: [{ content: { role: "model", parts: [{ text: "observed" }] }, finishReason: "STOP" }] } })}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });
}

describe("companion image delivery at the real provider request seam", () => {
  test.each(["gemini-3.7-flash", "gemini-3.7-flash-tiered", "gemini-3.7-flash-low"])("preserves labeled PNG bytes for the default model or alias %s", async (model: string) => {
    const outgoing: unknown[] = [];
    const result = await completeProvider("google-antigravity", {
      model,
      messages: [{ role: "user", content: [
        { type: "text", text: "Delivered map" },
        { type: "image_url", image_url: { url: `data:image/png;base64,${png}` } },
      ] }],
    }, { apiKey, fetch: async (_input, init) => {
      outgoing.push(JSON.parse(String(init?.body)));
      return reply();
    } });
    expect(outgoing).toHaveLength(1);
    expect(outgoing[0]).toMatchObject({ request: { contents: [{ role: "user", parts: [
      { text: "Delivered map" }, { inlineData: { mimeType: "image/png", data: png } },
    ] }] } });
    expect(result.completion).toMatchObject({ image_delivery: [{ messageIndex: 0, partIndex: 1 }] });
  });

  test.each(["google-antigravity", "openai-codex"])("preserves multiple images and label ordering on %s wire", async (provider: string) => {
    const outgoing: unknown[] = [];
    const result = await completeProvider(provider, {
      messages: [{ role: "user", content: "Text control" }, { role: "user", content: images.flatMap((image, index) => [
        { type: "text", text: `Map ${index}` }, { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.data}` } },
      ]) }],
    }, { apiKey: provider === "google-antigravity" ? apiKey : "offline-codex-sentinel", fetch: async (_input, init) => {
      const body = init?.body instanceof Uint8Array ? new TextDecoder().decode(Bun.zstdDecompressSync(init.body)) : String(init?.body);
      outgoing.push(JSON.parse(body));
      if (provider === "google-antigravity") return reply();
      return new Response(`data: ${JSON.stringify({ type: "response.completed", response: { id: "offline", status: "completed", output: [], usage: { input_tokens: 1, output_tokens: 0, total_tokens: 1 } } })}\n\n`, { headers: { "Content-Type": "text/event-stream" } });
    } });
    expect(outgoing).toHaveLength(1);
    if (provider === "google-antigravity") {
      expect(outgoing[0]).toMatchObject({ request: { contents: [
        { role: "user", parts: [{ text: "Text control" }] },
        { role: "user", parts: images.flatMap((image, index) => [{ text: `Map ${index}` }, { inlineData: image }]) },
      ] } });
    } else {
      const wire = outgoing[0];
      if (!wire || typeof wire !== "object" || !("input" in wire) || !Array.isArray(wire.input)) throw new Error("Missing Codex input");
      const userParts = wire.input.flatMap((item: unknown) => item && typeof item === "object" && "role" in item && item.role === "user" && "content" in item && Array.isArray(item.content) ? item.content : []);
      expect(userParts).toMatchObject([
        { type: "input_text", text: "Text control" },
        ...images.flatMap((image, index) => [
          { type: "input_text", text: `Map ${index}` }, { type: "input_image", image_url: `data:${image.mimeType};base64,${image.data}` },
        ]),
      ]);
    }
    expect(result.completion).toMatchObject({ image_delivery: [{ messageIndex: 1, partIndex: 1 }, { messageIndex: 1, partIndex: 3 }] });
  });

  test.each([
    "https://example.invalid/map.png", "data:image/svg+xml;base64,PHN2Zy8+", "data:image/png;base64,",
    "data:image/png;base64,!!!!", "data:image/png;base64,YQ=", "data:image/png;base64,YR==",
  ])("rejects malformed or unsupported image URL %s before outbound fetch", async (url: string) => {
    let called = false;
    await expect(completeProvider("google-antigravity", { messages: [{ role: "user", content: [
      { type: "text", text: "Do not downgrade" }, { type: "image_url", image_url: { url } },
    ] }] }, { apiKey, fetch: async () => { called = true; return reply(); } })).rejects.toMatchObject({ status: 400, code: "invalid-image-url" });
    expect(called).toBe(false);
  });

  test("rejects image roles, malformed parts and nonvision models instead of dropping them", async () => {
    const part = { type: "image_url", image_url: { url: `data:image/png;base64,${png}` } };
    await expect(completeProvider("google-antigravity", { messages: [{ role: "tool", content: [part] }] })).rejects.toMatchObject({ code: "unsupported-image-role", status: 400 });
    for (const bad of [{ type: "image_url" }, { type: "audio" }, null]) {
      expect(() => convertUserContent([part, bad], true)).toThrow(expect.objectContaining({ code: "invalid-content-part", status: 400 }));
    }
    expect(() => convertUserContent([part], false)).toThrow(expect.objectContaining({ code: "unsupported-model-image", status: 400 }));
    expect(convertUserContent("Text control", false)).toEqual([{ type: "text", text: "Text control" }]);
  });

  test("accepts JPEG/WebP MIME bytes without relabeling or transcoding", async () => {
    const Jimp = (await import("jimp")).default;
    const image = new Jimp(1, 1, 0xff0000ff);
    const jpeg = (await image.getBufferAsync(Jimp.MIME_JPEG)).toString("base64");
    const webp = "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";
    for (const { mimeType, data } of [{ mimeType: "image/jpeg", data: jpeg }, { mimeType: "image/webp", data: webp }]) {
      expect(convertUserContent([{ type: "image_url", image_url: { url: `data:${mimeType};base64,${data}` } }], true)).toEqual([{ type: "image", mimeType, data }]);
    }
    expect(() => convertUserContent([{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${png}` } }], true)).toThrow();
    expect(() => convertUserContent([{ type: "image_url", image_url: { url: "data:image/png;base64,AA==" } }], true)).toThrow();
  });

  test("rejects the completion when the image-bearing provider request fails", async () => {
    await expect(completeProvider("google-antigravity", { messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: `data:image/png;base64,${png}` } }] }] }, {
      apiKey, fetch: async () => new Response("offline rejection", { status: 400 }),
    })).rejects.toThrow();
  });

  test("parses acknowledgement positions atomically and refuses malformed siblings", () => {
    expect(parseImageDelivery([{ messageIndex: 1, partIndex: 2 }])).toEqual([{ messageIndex: 1, partIndex: 2 }]);
    for (const invalid of [null, [{ messageIndex: -1, partIndex: 0 }], [{ messageIndex: 1, partIndex: 2 }, { messageIndex: 1.5, partIndex: 0 }]]) {
      expect(parseImageDelivery(invalid)).toBeUndefined();
    }
  });
});
