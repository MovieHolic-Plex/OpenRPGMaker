// 한꺼번에 읽기: read_tileset_reference 에 documentId·imageId 를 빼면 용도의 이미지 전부와 MD 쪽을 한 응답에 준다.
// 2026-10-04 실측(버들항 길 깔기): 배치 관문이 물 용도 15건(MD 2쪽·이미지 13장)을 요구했고, 모델은 두 건 읽고 길을 포기했다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { referenceOwner, referencePageStarts } from "@/project/tilesetReferences";
import { TilesetReferenceEvidence } from "@/ai/tilesetReferenceEvidence";
import type { ToolContext } from "@/editor/tools/types";

type Bundle = { documents: { id: string; offset: number }[]; images: { id: string }[]; remaining: unknown[]; after: string[] };

function fixture() {
  const ctx: ToolContext = { project: createBlankProject() };
  const found = Object.values(ctx.project.tilesets)
    .map(tileset => ({ tileset, group: referenceOwner(ctx.project, tileset).referenceDocuments?.find(g => g.documents.length > 0 && g.images.length > 0) }))
    .find(entry => entry.group);
  if (!found) throw new Error("fixture: no bundled tileset with documents and images");
  return { ctx, tileset: found.tileset, group: found.group! };
}

describe("read_tileset_reference 한꺼번에 읽기", () => {
  it("모든 쪽을 이어 읽으면 낱장 읽기와 같은 쪽을 모두 받고, 이미지는 첫 묶음에만 온다", () => {
    const { ctx, tileset, group } = fixture();
    const seen = new Set<string>();
    let after: string[] = [];
    let imageCount = -1;
    for (let round = 0; round < 50; round++) {
      const result = runTool(ctx, "read_tileset_reference", { tilesetId: tileset.id, categoryId: group.id, ...(after.length ? { after } : {}) });
      expect(result.ok).toBe(true);
      const data = result.data as Bundle;
      if (round === 0) imageCount = data.images.length;
      else expect(data.images).toHaveLength(0);
      for (const document of data.documents) seen.add(`${document.id}:${document.offset}`);
      expect(JSON.stringify(data).length).toBeLessThanOrEqual(32_000);
      after = data.after;
      if (!data.remaining.length) break;
      expect(data.documents.length).toBeGreaterThan(0);
    }
    expect(imageCount).toBe(group.images.length);
    const expected = group.documents.flatMap(doc => referencePageStarts(doc.markdown).map(offset => `${doc.id}:${offset}`));
    expect([...seen].sort()).toEqual(expected.sort());
  });

  it("관문은 묶음으로 읽은 쪽을 읽은 것으로 치고, 남은 것은 이미지 전달뿐이다", () => {
    const { ctx, tileset, group } = fixture();
    const mapId = ctx.project.startMapId;
    ctx.project.maps[mapId]!.tilesetId = tileset.id;
    const evidence = new TilesetReferenceEvidence();
    const args = { mapId, layer: "lower", mode: "cells", tile: 12, cells: [{ x: 1, y: 1 }], referencePurpose: group.id };
    const first = evidence.beforeWrite(ctx.project, "paint_tiles", args);
    expect(first?.summary).toContain(`categoryId:"${group.id}"})`);
    let after: string[] = [];
    for (let round = 0; round < 50; round++) {
      const result = runTool(ctx, "read_tileset_reference", { tilesetId: tileset.id, categoryId: group.id, ...(after.length ? { after } : {}) });
      evidence.observe(result);
      const data = result.data as Bundle;
      after = data.after;
      if (!data.remaining.length) break;
    }
    const blocked = evidence.beforeWrite(ctx.project, "paint_tiles", args);
    expect(blocked?.summary).toContain(`(${group.images.length}건)`);
    expect(blocked?.summary).toContain("이미지 입력 전달 필요");
  });

  it("documentId 와 imageId 를 둘 다 주면 거절한다", () => {
    const { ctx, tileset, group } = fixture();
    const result = runTool(ctx, "read_tileset_reference", { tilesetId: tileset.id, categoryId: group.id, documentId: group.documents[0]!.id, imageId: group.images[0]!.id });
    expect(result.ok).toBe(false);
  });
});
