import { describe, expect, it, vi } from "vitest";
import { collectAppearanceReferences, type AppearanceReferenceReader } from "@/editor/characterAppearanceReferences";
import { parseImageReferences } from "@/ai/imageReferences";
import { generateAiImage } from "@/ai/imageGenerationClient";
import { charsetFrameSource } from "@/assets/easyrpgRtp";
import { createBlankProject } from "@/project/defaults";
import type { CharacterAppearanceRecord } from "@/project/types";

describe("appearance reference images", () => {
  it("reads the exact manual chipset crop and existing face as actual image parts", async () => {
    const project = createBlankProject();
    project.assets.uploaded["manual-charset"] = {
      id: "manual-charset", kind: "charset", name: "Sheet", dataUrl: "data:image/png;base64,c2hlZXQ=", meta: {},
    };
    project.assets.uploaded["manual-face"] = {
      id: "manual-face", kind: "faceset", name: "Face", dataUrl: "data:image/png;base64,ZmFjZQ==", meta: {},
    };
    const record: CharacterAppearanceRecord = {
      id: "appearance", name: "Mira", description: "",
      charset: { resourceId: "manual-charset", characterIndex: 6 },
      face: { resourceId: "manual-face" },
    };
    const before = JSON.stringify({ project, record });
    const reader = vi.fn<AppearanceReferenceReader>()
      .mockResolvedValueOnce("data:image/png;base64,Y3JvcA==")
      .mockResolvedValueOnce("data:image/png;base64,ZmFjZQ==");
    const signal = new AbortController().signal;

    const references = await collectAppearanceReferences(project, record, signal, reader);

    expect(reader).toHaveBeenNthCalledWith(1, "data:image/png;base64,c2hlZXQ=",
      charsetFrameSource({ characterIndex: 6, direction: "down", pattern: 1 }), signal);
    expect(reader).toHaveBeenNthCalledWith(2, "data:image/png;base64,ZmFjZQ==", undefined, signal);
    expect(references).toEqual([
      { mimeType: "image/png", data: "Y3JvcA==" },
      { mimeType: "image/png", data: "ZmFjZQ==" },
    ]);
    expect(JSON.stringify({ project, record })).toBe(before);
  });

  it("allows description-only appearance generation without a charset", async () => {
    const reader = vi.fn<AppearanceReferenceReader>();
    const record = { id: "appearance", name: "Mira", description: "Green coat" };

    const result = await collectAppearanceReferences(createBlankProject(), record, new AbortController().signal, reader);

    expect(result).toEqual([]);
    expect(reader).not.toHaveBeenCalled();
  });

  it.each([
    [{ mimeType: "image/svg+xml", data: "PHN2Zz4=" }],
    [{ mimeType: "image/png", data: "https://remote.example/image.png" }],
    [{ mimeType: "image/png", data: "not base64" }],
    Array.from({ length: 3 }, () => ({ mimeType: "image/png", data: "YQ==" })),
    [{ mimeType: "image/png", data: "a".repeat(8 * 1024 * 1024 + 4) }],
  ].map((parts) => [parts]))("rejects malformed or oversized external reference payload %#", (parts) => {
    expect(() => parseImageReferences(parts)).toThrow();
  });

  it("does not send an oversized reference request to the companion", async () => {
    const send = vi.fn<typeof fetch>();

    await expect(generateAiImage({
      prompt: "face",
      referenceImages: [{ mimeType: "image/png", data: "a".repeat(8 * 1024 * 1024 + 4) }],
    }, { fetch: send })).rejects.toThrow();

    expect(send).not.toHaveBeenCalled();
  });
});
