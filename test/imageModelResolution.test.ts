import { describe, expect, it } from "vitest";
import { compareImageModelVersions, pickNewestImageModel, reportedImageModel } from "@/ai/imageModelResolution";
import { DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_PROVIDER_ID, IMAGE_MODEL_CATALOG } from "@/ai/imageModelCatalog";

describe("image model resolution", () => {
  it("orders revisions by each numeric part", () => {
    expect(compareImageModelVersions("3.1.0", "3.0.0")).toBeGreaterThan(0);
    expect(compareImageModelVersions("2.0.0", "10.0.0")).toBeLessThan(0);
    expect(compareImageModelVersions("3.1.0", "3.1")).toBe(0);
    expect(compareImageModelVersions(undefined, "1")).toBeLessThan(0);
  });

  it("picks the newest image-kind model and ignores chat-only rows", () => {
    expect(pickNewestImageModel([
      { id: "chat-9", kind: "chat", revision: "9.0.0" },
      { id: "img-old", kind: "image", revision: "2.0.0" },
      { id: "img-new", kind: "image", revision: "2.6.0" },
    ])).toBe("img-new");
  });

  it("honours provider priority before revision", () => {
    expect(pickNewestImageModel([
      { id: "newer-but-deprioritised", kind: "image", revision: "9.0.0", priority: 5 },
      { id: "preferred", kind: "image", revision: "1.0.0", priority: 1 },
    ])).toBe("preferred");
  });

  it("returns null rather than inventing a name when nothing is listed", () => {
    expect(pickNewestImageModel([])).toBeNull();
    expect(pickNewestImageModel([{ id: "chat", kind: "chat" }])).toBeNull();
  });

  it("lists only the ChatGPT image route in the editor catalog", () => {
    expect(DEFAULT_IMAGE_PROVIDER_ID).toBe("openai-codex");
    expect(DEFAULT_IMAGE_MODEL).toBe("codex-image-default");
    expect(IMAGE_MODEL_CATALOG.map(({ providerId, model }) => ({ providerId, model })))
      .toEqual([{ providerId: "openai-codex", model: "codex-image-default" }]);
  });

  it("accepts only non-empty strings as a reported model", () => {
    expect(reportedImageModel("gpt-image-2-codex")).toBe("gpt-image-2-codex");
    expect(reportedImageModel("  gpt-image-2-codex  ")).toBe("gpt-image-2-codex");
    expect(reportedImageModel("")).toBeNull();
    expect(reportedImageModel(undefined)).toBeNull();
    expect(reportedImageModel(42)).toBeNull();
  });
});
