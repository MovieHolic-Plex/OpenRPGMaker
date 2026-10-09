// 2026-09-24 헤드리스 r0735: 모델이 목록을 보기 전에 documentId 를 지어내
// 「MD 문서를 찾을 수 없습니다」만 받았다. 오류가 고를 수 있는 ID 를 함께 말해야 한다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { referenceOwner } from "@/project/tilesetReferences";
import type { ToolContext } from "@/editor/tools/types";

describe("read_tileset_reference unknown ids", () => {
  it("accepts a zero image offset and rejects pagination into an image", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const entry = Object.values(ctx.project.tilesets)
      .map(tileset => ({ tileset, group: referenceOwner(ctx.project, tileset).referenceDocuments?.find(g => g.images.length > 0) }))
      .find(candidate => candidate.group)!;
    const args = { tilesetId: entry.tileset.id, categoryId: entry.group!.id, imageId: entry.group!.images[0]!.id };
    const omitted = runTool(ctx, "read_tileset_reference", args);
    const zero = runTool(ctx, "read_tileset_reference", { ...args, offset: 0 });
    expect(omitted.ok).toBe(true);
    expect(zero).toEqual(omitted);
    expect(runTool(ctx, "read_tileset_reference", { ...args, offset: 1 }).ok).toBe(false);
  });

  it("lists valid document ids when the documentId is unknown", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const withDocs = Object.values(ctx.project.tilesets)
      .map(tileset => ({ tileset, group: referenceOwner(ctx.project, tileset).referenceDocuments?.find(g => g.documents.length > 0) }))
      .find(entry => entry.group);
    expect(withDocs, "a bundled tileset with reference documents").toBeDefined();
    const { tileset, group } = withDocs!;
    const result = runTool(ctx, "read_tileset_reference", { tilesetId: tileset.id, categoryId: group!.id, documentId: `${group!.id}-guide-made-up` });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain(group!.documents[0]!.id);
  });

  it("lists valid category ids when the categoryId is unknown", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const tileset = Object.values(ctx.project.tilesets).find(t => (referenceOwner(ctx.project, t).referenceDocuments ?? []).length > 0)!;
    const first = referenceOwner(ctx.project, tileset).referenceDocuments![0]!.id;
    const result = runTool(ctx, "read_tileset_reference", { tilesetId: tileset.id, categoryId: "nope", documentId: "x" });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain(first);
  });
});
