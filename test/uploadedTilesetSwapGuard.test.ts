// 업로드 타일셋을 쓰던 기존 맵의 칩셋을 도구가 말없이 바꾸면 거부한다(toolRunner.rejectUploadedTilesetSwap).
// 실측(2026-09-25): Rasak 얼음 동굴 요청에 run_dungeon_room_pipeline 이 맵을 easyrpg_chipset_dungeon 으로 바꿨다.
// 프로젝트를 통째로 되돌리거나 갈아 끼우는 도구(allowsTilesetChange)는 빠진다 — 되돌리기·새 프로젝트가 막히면 안 된다.
import { beforeEach, describe, expect, it } from "vitest";
import { applyProjectWithHistory, resetMapEditHistory } from "@/editor/mapEditHistory";
import { getTool } from "@/editor/tools/toolRegistry";
import { runTool, runToolDefinition } from "@/editor/tools/toolRunner";
import type { ToolDefinition } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

const MAP_ID = "map_blank_start";

function withUploadedPack(project: Project): Project {
  const bundled = project.tilesets[COMBINED_TOWN_TILESET_ID]!;
  project.tilesets.pack = { ...structuredClone(bundled), id: "pack", name: "올린 팩", image: { type: "uploaded", id: "asset_pack" } };
  return project;
}

function projectWithUploadedTileset(): Project {
  const project = withUploadedPack(createBlankProject());
  project.maps[MAP_ID]!.tilesetId = "pack";
  return project;
}

const swapTool: ToolDefinition = {
  name: "swap_chipset_probe",
  description: "시험용 — 맵 칩셋을 바꾼다(tilesetId 없으면 기본 칩셋)",
  mode: "write",
  parameters: { type: "object", properties: { mapId: { type: "string" }, tilesetId: { type: "string" } }, required: ["mapId"] },
  run(draft, args) {
    const map = draft.maps[args.mapId as string]!;
    const tileset = draft.tilesets[typeof args.tilesetId === "string" ? args.tilesetId : COMBINED_TOWN_TILESET_ID]!;
    map.tilesetId = tileset.id;
    map.tileSize = tileset.tileSize;
    return { summary: "칩셋 바꿈" };
  },
};

function hasSwapIssue(issues: readonly { code?: string }[] | undefined): boolean {
  return issues?.some((issue) => issue.code === "uploaded-tileset-replaced") ?? false;
}

beforeEach(() => {
  resetMapEditHistory();
});

describe("업로드 타일셋 칩셋 바꿔치기 거부", () => {
  it("인자에 tilesetId 없이 업로드 타일셋 맵의 칩셋을 바꾸면 거부하고 프로젝트를 그대로 둔다", () => {
    const project = projectWithUploadedTileset();
    const ctx = { project };
    const result = runToolDefinition(ctx, swapTool, { mapId: MAP_ID });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("uploaded-tileset-replaced");
    expect(ctx.project).toBe(project);
    expect(ctx.project.maps[MAP_ID]!.tilesetId).toBe("pack");
  });

  it("새 tilesetId 를 인자로 명시하면 통과하고 실제로 바뀐다", () => {
    const project = projectWithUploadedTileset();
    const ctx = { project };
    const result = runToolDefinition(ctx, swapTool, { mapId: MAP_ID, tilesetId: COMBINED_TOWN_TILESET_ID }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(hasSwapIssue(result.issues)).toBe(false);
    expect(ctx.project.maps[MAP_ID]!.tilesetId).toBe(COMBINED_TOWN_TILESET_ID);
  });

  it("번들 타일셋 맵은 전처럼 바뀐다", () => {
    const project = withUploadedPack(createBlankProject());
    const ctx = { project };
    const result = runToolDefinition(ctx, { ...swapTool, run(draft, args) {
      draft.maps[args.mapId as string]!.tilesetId = "pack";
      return { summary: "칩셋 바꿈" };
    } }, { mapId: MAP_ID }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps[MAP_ID]!.tilesetId).toBe("pack");
  });

  it("실제 회귀: run_dungeon_room_pipeline 이 업로드 타일셋 맵을 덮어쓰려 하면 uploaded-tileset-replaced 로 거부한다", () => {
    const project = projectWithUploadedTileset();
    const snapshot = JSON.stringify(project);
    const ctx = { project };
    // 얼음 동굴 실측과 같은 모양: 기존 맵 id + replaceExisting. tilesetId 는 이 도구가 받지 않는다.
    const result = runTool(ctx, "run_dungeon_room_pipeline", {
      mapId: MAP_ID, theme: "ice", width: 36, height: 28, replaceExisting: true,
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(false);
    expect(result.issues?.[0]?.code).toBe("uploaded-tileset-replaced");
    expect(ctx.project).toBe(project);
    expect(JSON.stringify(ctx.project)).toBe(snapshot);
  });

  it("allowsTilesetChange: reset_project·revert_last_edit 만 켠다", () => {
    expect(getTool("reset_project")?.allowsTilesetChange).toBe(true);
    expect(getTool("revert_last_edit")?.allowsTilesetChange).toBe(true);
    expect(getTool("run_dungeon_room_pipeline")?.allowsTilesetChange).toBeUndefined();
    expect(getTool("paint_tiles")?.allowsTilesetChange).toBeUndefined();
  });

  it("reset_project 는 업로드 타일셋 맵이 있어도 빈 프로젝트로 갈아 끼운다(같은 맵 id 가 기본 칩셋으로 돌아간다)", () => {
    const project = projectWithUploadedTileset();
    const ctx = { project };
    const result = runTool(ctx, "reset_project", { prompt: "새로", title: "새 게임" }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(hasSwapIssue(result.issues)).toBe(false);
    expect(ctx.project.meta.title).toBe("새 게임");
    expect(ctx.project.maps[MAP_ID]!.tilesetId).toBe(createBlankProject().maps[MAP_ID]!.tilesetId);
  });

  it("revert_last_edit 는 업로드 타일셋으로 바꾼 칩셋 변경을 되돌린다", () => {
    const base = withUploadedPack(createBlankProject());
    store.replace(structuredClone(base));
    resetMapEditHistory();
    const next = structuredClone(base);
    next.maps[MAP_ID]!.tilesetId = "pack";
    expect(applyProjectWithHistory(next, "타일셋 바꿈")).toBe(true);
    expect(store.getCurrent().maps[MAP_ID]!.tilesetId).toBe("pack");

    const ctx = { project: store.getCurrent() };
    const result = runTool(ctx, "revert_last_edit", {}, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(hasSwapIssue(result.issues)).toBe(false);
    expect(ctx.project.maps[MAP_ID]!.tilesetId).toBe(base.maps[MAP_ID]!.tilesetId);
  });
});
