// 업로드 타일셋을 쓰던 기존 맵의 칩셋을 도구가 말없이 바꾸면 거부한다(toolRunner.rejectUploadedTilesetSwap).
// 실측(2026-09-25): Rasak 얼음 동굴 요청에 run_dungeon_room_pipeline 이 맵을 easyrpg_chipset_dungeon 으로 바꿨다.
import { describe, expect, it } from "vitest";
import { runToolDefinition } from "@/editor/tools/toolRunner";
import type { ToolDefinition } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";

const MAP_ID = "map_blank_start";

function projectWithUploadedTileset() {
  const project = createBlankProject();
  const bundled = project.tilesets[DEFAULT_TILESET_ID]!;
  project.tilesets.pack = { ...structuredClone(bundled), id: "pack", name: "올린 팩", image: { type: "uploaded", assetId: "asset_pack" } };
  project.maps[MAP_ID]!.tilesetId = "pack";
  return project;
}

const swapTool: ToolDefinition = {
  name: "swap_chipset_probe",
  description: "시험용 — 맵 칩셋을 기본 칩셋으로 바꾼다",
  mode: "write",
  parameters: { type: "object", properties: { mapId: { type: "string" }, tilesetId: { type: "string" } }, required: ["mapId"] },
  run(draft, args) {
    draft.maps[args.mapId as string]!.tilesetId = DEFAULT_TILESET_ID;
    return { summary: "칩셋 바꿈" };
  },
};

describe("업로드 타일셋 칩셋 바꿔치기 거부", () => {
  it("인자에 tilesetId 없이 업로드 타일셋 맵의 칩셋을 바꾸면 거부하고 프로젝트를 그대로 둔다", () => {
    const project = projectWithUploadedTileset();
    const ctx = { project };
    const result = runToolDefinition(ctx, swapTool, { mapId: MAP_ID });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("uploaded-tileset-replaced");
    expect(ctx.project.maps[MAP_ID]!.tilesetId).toBe("pack");
  });

  it("새 tilesetId 를 인자로 명시하면 통과한다", () => {
    const project = projectWithUploadedTileset();
    const result = runToolDefinition({ project }, swapTool, { mapId: MAP_ID, tilesetId: DEFAULT_TILESET_ID });
    expect(result.issues?.some((issue) => issue.code === "uploaded-tileset-replaced") ?? false).toBe(false);
  });

  it("번들 타일셋 맵은 전처럼 바뀐다", () => {
    const project = createBlankProject();
    const result = runToolDefinition({ project }, { ...swapTool, run(draft, args) {
      draft.maps[args.mapId as string]!.tilesetId = "other";
      return { summary: "칩셋 바꿈" };
    } }, { mapId: MAP_ID });
    expect(result.issues?.some((issue) => issue.code === "uploaded-tileset-replaced") ?? false).toBe(false);
  });
});
