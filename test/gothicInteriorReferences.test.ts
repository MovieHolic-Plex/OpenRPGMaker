// gothic_manor 실내 참고문서 번들 — 형태·이미지 경로 외부화·ensure 멱등. 이 파일은 작성 시 실행하지 않았다(not run).
import { describe, expect, it } from "vitest";
import { createGothicInteriorReferences, ensureGothicInteriorReferences, GOTHIC_INTERIOR_REFERENCE_PURPOSE } from "@/project/defaults/gothicInteriorReferences";
import type { TilesetDef } from "@/project/types";

describe("gothic interior references", () => {
  it("용도 하나·문서 하나·이미지는 /assets 경로(dataURL 아님)", () => {
    const refs = createGothicInteriorReferences();
    expect(refs.map((r) => r.id)).toEqual([GOTHIC_INTERIOR_REFERENCE_PURPOSE]);
    expect(refs[0]!.documents[0]!.markdown).toContain("E_HIDE_ACCESS");
    for (const image of refs[0]!.images) expect(image.dataUrl.startsWith("/assets/gothic-interior-references/")).toBe(true);
  });
  it("ensure 는 빠진 용도만 덧붙이고 두 번째는 변화 없음", () => {
    const tileset = { id: "gothic_manor", referenceDocuments: [] } as unknown as TilesetDef;
    expect(ensureGothicInteriorReferences(tileset)).toBe(true);
    expect(ensureGothicInteriorReferences(tileset)).toBe(false);
    expect(ensureGothicInteriorReferences({ id: "other" } as unknown as TilesetDef)).toBe(false);
  });
});
