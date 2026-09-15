import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { completeProvider, openaiToContext } from "../scripts/lib/ohMyPiPiAiRuntime.ts";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=";

describe("oh-my-pi user image conversion", () => {
  test("preserves image bytes when user content contains a PNG data URL", () => {
    // Given
    const body = { messages: [{ role: "user", content: [
      { type: "image_url", image_url: { url: `data:image/png;base64,${png}` } },
    ] }] };

    // When
    const context = openaiToContext("google-antigravity", body);

    // Then
    expect(context.messages).toEqual([{
      role: "user",
      content: [{ type: "image", data: png, mimeType: "image/png" }],
      timestamp: expect.any(Number),
    }]);
  });

  test.each(["image/png", "image/jpeg", "image/webp"])("preserves data and ordering when the MIME type is %s", async (mimeType: string) => {
    // The merged boundary validates MIME headers as well as transporting exact bytes.
    const Jimp = (await import("jimp")).default;
    const data = mimeType === "image/png" ? png : mimeType === "image/webp"
      ? "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA"
      : (await new Jimp(1, 1, 0xff0000ff).getBufferAsync(Jimp.MIME_JPEG)).toString("base64");
    const body = { messages: [{ role: "user", content: [
      { type: "text", text: "before" },
      { type: "image_url", image_url: { url: `data:${mimeType};base64,${data}`, detail: "low" } },
      { type: "text", text: "between" },
      { type: "image_url", image_url: { url: `data:image/png;base64,${png}`, detail: "high" } },
      { type: "text", text: "after" },
    ] }] };

    // When
    const context = openaiToContext("google-antigravity", body);

    // Then
    expect(context.messages).toEqual([{
      role: "user",
      content: [
        { type: "text", text: "before" },
        { type: "image", data, mimeType, detail: "low" },
        { type: "text", text: "between" },
        { type: "image", data: png, mimeType: "image/png", detail: "high" },
        { type: "text", text: "after" },
      ],
      timestamp: expect.any(Number),
    }]);
  });

  test.each([
    { content: "plain text" },
    { content: [{ type: "text", text: "plain text" }] },
  ])("preserves text when user content is %j", ({ content }: { readonly content: unknown }) => {
    // Given
    const body = { messages: [{ role: "user", content }] };
    // When
    const context = openaiToContext("google-antigravity", body);
    // Then
    expect(context.messages).toMatchObject([{ role: "user", content: [{ type: "text", text: "plain text" }] }]);
  });

  test("preserves tool replay when the history includes assistant calls and tool results", () => {
    // Given
    const body = { messages: [
      { role: "system", content: "system context" },
      { role: "assistant", content: "checking", tool_calls: [{
        id: "probe", function: { name: "read_map", arguments: '{"width":20}' },
      }] },
      { role: "tool", tool_call_id: "probe", name: "read_map", content: "result" },
    ] };
    // When
    const context = openaiToContext("google-antigravity", body);
    // Then
    expect(context).toMatchObject({ systemPrompt: ["system context"], messages: [
      { role: "assistant", content: [
        { type: "text", text: "checking" },
        { type: "toolCall", id: "probe", name: "read_map", arguments: { width: 20 } },
      ] },
      { role: "toolResult", toolCallId: "probe", toolName: "read_map", content: [{ type: "text", text: "result" }] },
    ] });
  });

  test.each([
    ["remote URL", { url: "https://example.invalid/image.png" }],
    ["unsupported MIME", { url: "data:image/gif;base64,R0lG" }],
    ["missing base64 marker", { url: "data:image/png,QUJD" }],
    ["empty data", { url: "data:image/png;base64," }],
    ["invalid alphabet", { url: "data:image/png;base64,%%%=" }],
    ["missing padding", { url: "data:image/png;base64,YQ" }],
    ["extra padding", { url: "data:image/png;base64,YQ===" }],
    ["invalid padding bits", { url: "data:image/png;base64,YR==" }],
    ["trailing newline", { url: "data:image/png;base64,QUJD\n" }],
    ["missing URL", {}],
    ["non-string URL", { url: 42 }],
    ["null image", null],
    ["missing image", undefined],
    ["invalid detail", { url: `data:image/png;base64,${png}`, detail: "invalid" }],
  ])("rejects input when the image has %s", (_label: string, image_url: unknown) => {
    // Given
    const body = { messages: [{ role: "user", content: [
      { type: "text", text: "inspect" }, { type: "image_url", image_url },
    ] }] };
    // When
    const convert = () => openaiToContext("google-antigravity", body);
    // Then
    expect(convert).toThrow(expect.objectContaining({ name: "ImageTransportError", status: 400, partIndex: 1 }));
  });

  test("sends image bytes through pi-ai when completing a mixed user message", async () => {
    // Given: use the real pi-ai serializer and replace only the HTTP transport.
    const requestBodies: unknown[] = [];
    const body = { model: "gemini-3.1-pro", messages: [{ role: "user", content: [
      { type: "text", text: "before" },
      { type: "image_url", image_url: { url: `data:image/png;base64,${png}` } },
      { type: "text", text: "after" },
    ] }] };
    const response = { response: { candidates: [{
      content: { role: "model", parts: [{ text: "seen" }] }, finishReason: "STOP",
    }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 } } };

    // When
    const result = await completeProvider("google-antigravity", body, {
      apiKey: JSON.stringify({ token: "test-token", projectId: "test-project" }),
      fetch: async (input, init) => {
        requestBodies.push(JSON.parse(String(init?.body)));
        const reply = new Response(`data: ${JSON.stringify(response)}\n\ndata: [DONE]\n\n`, {
          headers: { "Content-Type": "text/event-stream" },
        });
        Object.defineProperty(reply, "url", { value: String(input) });
        return reply;
      },
    });

    // Then
    expect(requestBodies).toMatchObject([{ request: { contents: [{ role: "user", parts: [
      { text: "before" }, { inlineData: { mimeType: "image/png", data: png } }, { text: "after" },
    ] }] } }]);
    expect(result.completion.choices).toMatchObject([{ message: { content: "seen" } }]);
  });

  test("rejects before transport when completing a message with a remote image", async () => {
    // Given
    let requests = 0;
    const body = { model: "gemini-3.1-pro", messages: [{ role: "user", content: [
      { type: "image_url", image_url: { url: "https://example.invalid/image.png" } },
    ] }] };
    // When
    const result = completeProvider("google-antigravity", body, {
      apiKey: "unused-test-key",
      fetch: async () => {
        requests += 1;
        return new Response("unexpected transport", { status: 400 });
      },
    });
    // Then
    await expect(result).rejects.toMatchObject({ name: "ImageTransportError", status: 400 });
    expect(requests).toBe(0);
  });

  test("returns HTTP 400 when the worker receives a malformed image", async () => {
    // Given: subscribe to readiness before sending a real loopback HTTP request.
    const worker = spawn(process.execPath, [new URL("../scripts/oh-my-pi-worker.ts", import.meta.url).pathname], {
      env: { ...process.env, OPRN_OH_MY_PI_WORKER_PORT: "0", OPRN_OH_MY_PI_TEST_STUB: "0" },
      stdio: ["ignore", "pipe", "inherit"],
      timeout: 10_000,
    });
    const exited = once(worker, "exit");
    const lines = createInterface({ input: worker.stdout });
    try {
      const [line]: readonly unknown[] = await once(lines, "line", { signal: AbortSignal.timeout(5_000) });
      if (typeof line !== "string" || !/^READY \d+$/.test(line)) throw new TypeError("Invalid worker readiness line");
      const port = line.slice("READY ".length);
      // When
      const response = await fetch(`http://127.0.0.1:${port}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google-antigravity", body: {
          model: "gemini-3.1-pro", messages: [{ role: "user", content: [
            { type: "image_url", image_url: { url: "data:image/png;base64,%%%" } },
          ] }],
        } }),
        signal: AbortSignal.timeout(5_000),
      });
      // Then
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: expect.any(String) });
    } finally {
      lines.close();
      worker.kill();
      await exited;
    }
  }, 15_000);
});
