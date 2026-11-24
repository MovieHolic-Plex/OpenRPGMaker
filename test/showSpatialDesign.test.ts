import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { INTERIOR_OBJECT_CATALOG } from "@/editor/interiorObjectCatalog";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";

describe("show_spatial_design — 조수가 오브젝트 그림 재료를 받는다", () => {
  it("내장 실내 오브젝트는 그 칸 배열과 크기를 돌려준다", () => {
    // Given: 빈 프로젝트의 실내 칩셋과 카탈로그 첫 오브젝트.
    const project = createBlankProject();
    const object = INTERIOR_OBJECT_CATALOG.find(entry => entry.cells.length > 0)!;
    expect(project.tilesets[INTERIOR_ROOM_TILESET_ID], "실내 칩셋").toBeDefined();

    // When
    const result = runTool({ project }, "show_spatial_design", { tilesetId: INTERIOR_ROOM_TILESET_ID, kitId: object.id });

    // Then: 그릴 칸이 그대로 온다(렌더러가 이 배열로 PNG 를 만든다).
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ kind: "cells", tilesetId: INTERIOR_ROOM_TILESET_ID, kitId: object.id,
      width: Math.max(1, object.width), height: Math.max(1, object.height) });
    expect((result.data as { cells: unknown[] }).cells).toHaveLength(object.cells.length);
  });

  it("없는 그림은 그리지 않고 실패로 알린다", () => {
    const result = runTool({ project: createBlankProject() }, "show_spatial_design", { tilesetId: INTERIOR_ROOM_TILESET_ID, kitId: "no-such-object" });
    expect(result.ok).toBe(false);
  });
});
