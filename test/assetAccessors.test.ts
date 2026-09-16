import { describe, expect, it } from "vitest";
import {
  setUploadedAssetResolver,
  uploadedAssetBytes,
  uploadedAssetMime,
  uploadedAssetUrl,
} from "@/project/persistence/assetAccessors";
import type { UploadedAsset } from "@/project/types";

const REF_ONLY: UploadedAsset = {
  id: "asset-ref-only",
  name: "참조만 있는 자산",
  kind: "sprite",
  ref: { sha256: "a".repeat(64), mime: "image/png", bytes: 3, extension: "png" },
};

const LEGACY: UploadedAsset = {
  id: "asset-legacy",
  name: " dataUrl 자산",
  kind: "sprite",
  dataUrl: "data:image/gif;base64,R0lGOD",
};

describe("uploadedAsset accessors", () => {
  it("ref 만 있는 자산은 어댑터가 준 url·mime·바이트를 돌려준다", async () => {
    setUploadedAssetResolver({
      url: (ref) => `oprn-asset://project/${ref.sha256}`,
      bytes: async (ref) => new TextEncoder().encode(`bytes:${ref.extension}`),
    });

    expect(uploadedAssetUrl(REF_ONLY)).toBe(`oprn-asset://project/${"a".repeat(64)}`);
    expect(uploadedAssetMime(REF_ONLY)).toBe("image/png");
    await expect(uploadedAssetBytes(REF_ONLY)).resolves.toEqual(new TextEncoder().encode("bytes:png"));
  });

  it("옛 dataUrl 자산은 접근자가 그대로 돌려주고 mime 을 헤더에서 읽는다", async () => {
    setUploadedAssetResolver(null);

    expect(uploadedAssetUrl(LEGACY)).toBe(LEGACY.dataUrl);
    expect(uploadedAssetMime(LEGACY)).toBe("image/gif");
  });

  it("해석기가 없으면 ref 자산의 url 은 빈 문자열이고 mime 은 ref 에서 온다", () => {
    setUploadedAssetResolver(null);

    expect(uploadedAssetUrl(REF_ONLY)).toBe("");
    expect(uploadedAssetMime(REF_ONLY)).toBe("image/png");
  });
});