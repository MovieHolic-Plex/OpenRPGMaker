import { describe, expect, it } from "vitest";
import {
  decideImageDataUrl,
  decideImageImport,
  formatImageImportDimensionError,
  formatImageImportFormatError,
  formatImageImportSizeError,
} from "@/editor/panels/resourceManagerImageImport";

describe("decideImageImport", () => {
  it("accepts png and jpeg without normalization", () => {
    expect(
      decideImageImport({ fileName: "tile.png", mimeType: "image/png", sizeBytes: 100 })
    ).toEqual({ ok: true, format: "png", normalizeToPng: false });
    expect(
      decideImageImport({ fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 100 })
    ).toEqual({ ok: true, format: "jpeg", normalizeToPng: false });
  });

  it("accepts webp and gif with PNG normalization", () => {
    expect(
      decideImageImport({ fileName: "shot.webp", mimeType: "image/webp", sizeBytes: 100 })
    ).toEqual({ ok: true, format: "webp", normalizeToPng: true });
    expect(
      decideImageImport({ fileName: "anim.gif", mimeType: "image/gif", sizeBytes: 100 })
    ).toEqual({ ok: true, format: "gif", normalizeToPng: true });
  });

  it("rejects oversize files with actual size and the 4MB limit", () => {
    const decision = decideImageImport({
      fileName: "big.png",
      mimeType: "image/png",
      sizeBytes: 6 * 1024 * 1024,
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.reason).toBe("size");
      expect(decision.message).toContain("6.0MB");
      expect(decision.message).toContain("4MB");
    }
  });

  it("rejects unsupported formats naming the actual type", () => {
    const decision = decideImageImport({
      fileName: "icon.svg",
      mimeType: "image/svg+xml",
      sizeBytes: 100,
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.reason).toBe("format");
      expect(decision.message).toContain("image/svg+xml");
    }
  });

  it("falls back to extension when MIME is empty", () => {
    expect(
      decideImageImport({ fileName: "shot.webp", mimeType: "", sizeBytes: 100 })
    ).toEqual({ ok: true, format: "webp", normalizeToPng: true });
  });
});

describe("decideImageDataUrl", () => {
  it("passes png/jpeg data URLs through", () => {
    const decision = decideImageDataUrl("data:image/png;base64,AAAA");
    expect(decision).toEqual({ ok: true, format: "png", normalizeToPng: false });
  });

  it("flags webp/gif data URLs for normalization", () => {
    expect(decideImageDataUrl("data:image/webp;base64,AAAA")).toEqual({
      ok: true,
      format: "webp",
      normalizeToPng: true,
    });
  });

  it("rejects non-image data URLs", () => {
    const decision = decideImageDataUrl("data:image/svg+xml;base64,AAAA");
    expect(decision.ok).toBe(false);
  });
});

describe("error message helpers", () => {
  it("names unknown format explicitly", () => {
    expect(formatImageImportFormatError("")).toContain("알 수 없음");
  });

  it("shows actual megabytes in size errors", () => {
    expect(formatImageImportSizeError(2.5 * 1024 * 1024)).toContain("2.5MB");
  });

  it("appends actual dimensions when the validator message lacks them", () => {
    const withDims = formatImageImportDimensionError("칩셋: 16x16 단위", 20, 20);
    expect(withDims).toContain("20x20");
    const already = formatImageImportDimensionError("필요 16x16, 현재 20x20", 20, 20);
    expect(already).toBe("필요 16x16, 현재 20x20");
  });
});
