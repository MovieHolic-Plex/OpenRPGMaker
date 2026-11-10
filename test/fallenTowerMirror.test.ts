import { describe, expect, it } from "vitest";
import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { findCharsetSemantic } from "@/assets/charsetSemantics";
import { FALLEN_MIRROR_TEXTURE } from "@/assets/fallenMirrorCharsets";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { charsetFamilyOf } from "@/project/charsetFamily";

// fs-vqa-obs(2026-11-10): 하늘탑 3층 거울이 RTP 누름 버튼·바위 칸이라 거울로 읽히지 않았다 — 렌즈 거울 칩 FallenMirror1.
describe("fallen tower lens mirror charset", () => {
  it("is a bundled object chip that the player can load", () => {
    const asset = CHARSET_ASSETS.find((a) => a.textureKey === FALLEN_MIRROR_TEXTURE);
    expect(asset?.path).toBe("assets/generated/charsets/FallenMirror1.png");
    expect(resolveAssetResourceUrl(FALLEN_MIRROR_TEXTURE)).toMatch(/assets\/generated\/charsets\/FallenMirror1\.png$/u);
    expect(charsetFamilyOf(undefined, FALLEN_MIRROR_TEXTURE)).toBe("object");
    for (const index of [0, 1]) expect(findCharsetSemantic(FALLEN_MIRROR_TEXTURE, index)?.tags).toContain("거울");
  });
});
