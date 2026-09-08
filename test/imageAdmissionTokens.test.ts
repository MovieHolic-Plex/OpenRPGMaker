import { describe, expect, it } from "vitest";
import { estimateAdmissionTokens, estimateContextTokens } from "@/ai/contextCompaction";
import { buildIndependentReviewRequest, type ReviewInput } from "@/ai/independentReview";
import { defaultAiConfig } from "@/ai/llmClient";
import { originalContextWindow } from "@/ai/originalContext";
import type { ChatMessage } from "@/ai/llmClient";

/** A real PNG header (signature + IHDR) followed by filler, as a base64 data URL.
 * Only the header is parsed, so the filler stands in for compressed pixel data. */
function pngDataUrl(width: number, height: number, payloadBytes = 120_000): string {
  const header = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
    (width >>> 24) & 255, (width >>> 16) & 255, (width >>> 8) & 255, width & 255,
    (height >>> 24) & 255, (height >>> 16) & 255, (height >>> 8) & 255, height & 255];
  const bytes = [...header, ...Array.from({ length: payloadBytes }, (_, i) => (i * 7) & 255)];
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:image/png;base64,${btoa(binary)}`;
}

const imageMessage = (url: string): ChatMessage => ({ role: "user",
  content: [{ type: "text", text: "Current render" }, { type: "image_url", image_url: { url } }] });

describe("image admission accounting", () => {
  it("bills a rendered map by its pixels, not by its data-URL characters", () => {
    // 512 is the renderer's cap (MAX_IMAGE_DIMENSION). Providers bill such an image in the
    // hundreds of tokens; the transport-weighted estimate reads it as six figures.
    const messages = [imageMessage(pngDataUrl(512, 512))];
    const transport = estimateContextTokens(messages);
    const admission = estimateAdmissionTokens(messages);

    expect(transport).toBeGreaterThan(100_000);
    expect(admission).toBeLessThan(5_000);
    expect(admission).toBeGreaterThan(0);
  });

  it("keeps the compaction estimate unchanged", () => {
    // The transport weighting is a measured product decision: without it a conversation
    // carrying screenshots never crosses the compaction threshold. Admission accounting is
    // additive and must not move this number.
    const messages = [imageMessage(pngDataUrl(512, 512))];
    expect(estimateContextTokens(messages)).toBe(estimateContextTokens(messages));
    const textOnly: ChatMessage[] = [{ role: "user", content: "hello" }];
    expect(estimateAdmissionTokens(textOnly)).toBe(estimateContextTokens(textOnly));
  });

  it("falls back to transport accounting when the pixel size is unreadable", () => {
    for (const url of ["https://example.test/render.png", "data:image/png;base64,QQ==",
      "data:image/jpeg;base64,QUJD"]) {
      const messages = [imageMessage(url)];
      expect(estimateAdmissionTokens(messages)).toBe(estimateContextTokens(messages));
    }
  });

  it("scales with pixels so a larger render still costs more", () => {
    const small = estimateAdmissionTokens([imageMessage(pngDataUrl(64, 64))]);
    const large = estimateAdmissionTokens([imageMessage(pngDataUrl(512, 512))]);
    expect(large).toBeGreaterThan(small);
  });

  it("admits six capped map renders on a reviewer window they used to overflow", () => {
    // A 200K reviewer is where the over-count actually bit: its token ceiling (183,616 after
    // the output reserve) is far below the request-body budget, so six tens-of-kilobytes
    // renders -- ordinary evidence for a six-map edit -- were refused as if they were 480K
    // tokens of text. On a 1M window the body budget binds first, which is why this needs a
    // small window to show.
    const config = { ...defaultAiConfig(), providerId: "google-antigravity", model: "claude-opus-4-5" };
    expect(originalContextWindow(config)).toBe(200_000);
    const images = Array.from({ length: 6 }, (_, i) => ({ label: `map ${i}`, dataUrl: pngDataUrl(512, 512, 60_000) }));
    const input: ReviewInput = { revision: 1, originalRequest: "Render every changed map",
      before: [], after: [], changes: [], toolResults: [], acceptance: null, requiredProblems: [], images };

    // Six capped renders are ordinary evidence for a six-map edit; refusing them left the
    // draft unreviewable with no way to recover.
    const request = buildIndependentReviewRequest(config, input);
    expect(request.messages).toHaveLength(2);
    expect(estimateContextTokens(request.messages)).toBeGreaterThan(originalContextWindow(config));
    expect(estimateAdmissionTokens(request.messages)).toBeLessThan(originalContextWindow(config));
  });

  it("still refuses an envelope that exceeds the provider request body, not just the window", () => {
    const config = defaultAiConfig();
    // Admission accounting must not trade a local refusal for an input-size failure one round
    // trip later: this envelope is cheap in billed tokens and far too large as a request body.
    const images = Array.from({ length: 6 }, (_, i) => ({ label: `map ${i}`, dataUrl: pngDataUrl(512, 512, 900_000) }));
    const input: ReviewInput = { revision: 1, originalRequest: "Render every changed map",
      before: [], after: [], changes: [], toolResults: [], acceptance: null, requiredProblems: [], images };

    expect(estimateAdmissionTokens([{ role: "user", content: images.map(image => (
      { type: "image_url" as const, image_url: { url: image.dataUrl } })) }])).toBeLessThan(originalContextWindow(config));
    expect(() => buildIndependentReviewRequest(config, input)).toThrow("independent-review-window-exceeded");
  });
});
