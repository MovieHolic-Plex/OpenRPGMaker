// 실행기 칩셋 계열 검사(toolRunner.rejectTilesetFamilyChange) + create_map 기본 칩셋(ToolDefinition.defaultTilesetId).
// 사용자 결정(2026-09-25): 새 맵의 칩셋은 사용자가 보고 있는 맵과 같은 계열이어야 하고, 다른 계열은 사용자 승인이 필요하다.
import { beforeEach, describe, expect, it } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";
import type { Project } from "@/project/types";

const MAP_ID = "map_blank_start";

function withUploaded(project: Project, id: string, family?: string): Project {
  const bundled = project.tilesets[COMBINED_TOWN_TILESET_ID]!;
  const tileset = { ...structuredClone(bundled), id, name: `올린 ${id}`, image: { type: "uploaded" as const, id: `asset_${id}` } };
  delete tileset.referenceDocuments;
  delete tileset.referenceSourceTilesetId;
  project.tilesets[id] = family ? { ...tileset, family } : tileset;
  return project;
}

/** 지금 보는 맵이 업로드 칩셋(Rasak 계열 흉내)인 프로젝트. 같은 계열 칩셋이 하나 더 있다. */
function uploadedProject(): Project {
  const project = withUploaded(withUploaded(createBlankProject(), "rasak_field", "rasak-fantasy"), "rasak_cave", "rasak-fantasy");
  project.maps[MAP_ID]!.tilesetId = "rasak_field";
  return project;
}

function dungeon(ctx: ToolContext, mapId = "map_cave") {
  return runTool(ctx, "run_dungeon_room_pipeline", { mapId, theme: "stone", width: 36, height: 28 }, { dryRun: false });
}

beforeEach(() => {
  resetMapEditHistory();
});

describe("칩셋 계열 검사", () => {
  it("(a) 업로드 계열 맵을 보며 던전 파이프라인으로 새 맵 → 거부, 후보·ask_tileset_change 안내", () => {
    const project = uploadedProject();
    const ctx: ToolContext = { project, currentMapId: MAP_ID };
    const result = dungeon(ctx);
    expect(result.ok).toBe(false);
    const issue = result.issues?.[0];
    expect(issue?.code).toBe("tileset-family-change");
    expect(issue?.mapId).toBe("map_cave");
    expect(issue?.message).toContain("rasak_cave(올린 rasak_cave)");
    expect(issue?.message).toContain("rasak_field(올린 rasak_field)");
    expect(issue?.message).toContain("Rasak Fantasy 계열");
    expect(issue?.message).toContain("ask_tileset_change");
    expect(ctx.project).toBe(project);
    expect(ctx.project.maps.map_cave).toBeUndefined();
  });

  it("(b) 같은 계열 칩셋으로 create_map → 통과", () => {
    const ctx: ToolContext = { project: uploadedProject(), currentMapId: MAP_ID };
    const result = runTool(ctx, "create_map", { id: "map_cave", name: "동굴", width: 20, height: 15, tilesetId: "rasak_cave" }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps.map_cave?.tilesetId).toBe("rasak_cave");
  });

  it("(b') 다른 계열 칩셋을 명시한 create_map 도 거부한다", () => {
    const ctx: ToolContext = { project: uploadedProject(), currentMapId: MAP_ID };
    const result = runTool(ctx, "create_map", { id: "map_x", name: "성", width: 20, height: 15, tilesetId: "opengameart_castle" }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("tileset-family-change");
  });

  it("(c) 승인 목록에 대상 계열이 있으면 통과", () => {
    const ctx: ToolContext = { project: uploadedProject(), currentMapId: MAP_ID, approvedTilesetFamilies: ["easyrpg"] };
    const result = dungeon(ctx);
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps.map_cave).toBeDefined();
  });

  it("(d) currentMapId 없음 → 옛 동작(검사 없음)", () => {
    const ctx: ToolContext = { project: uploadedProject() };
    const result = dungeon(ctx);
    expect(result.ok, result.summary).toBe(true);
    expect(result.issues?.some((issue) => issue.code === "tileset-family-change") ?? false).toBe(false);
  });

  it("(d') 지금 보는 맵 id 가 프로젝트에 없으면 검사하지 않는다", () => {
    const ctx: ToolContext = { project: uploadedProject(), currentMapId: "map_missing" };
    expect(dungeon(ctx).ok).toBe(true);
  });

  it("(e) reset_project 는 계열 검사를 건너뛴다", () => {
    const ctx: ToolContext = { project: uploadedProject(), currentMapId: MAP_ID };
    const result = runTool(ctx, "reset_project", { prompt: "새로", title: "새 게임" }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps[MAP_ID]!.tilesetId).toBe(createBlankProject().maps[MAP_ID]!.tilesetId);
  });

  it("(e') revert_last_edit 는 계열 검사를 건너뛴다", async () => {
    const { applyProjectWithHistory } = await import("@/editor/mapEditHistory");
    const { store } = await import("@/project/store");
    const base = uploadedProject();
    base.maps[MAP_ID]!.tilesetId = COMBINED_TOWN_TILESET_ID;
    store.replace(structuredClone(base));
    resetMapEditHistory();
    const next = structuredClone(base);
    next.maps[MAP_ID]!.tilesetId = "rasak_field";
    expect(applyProjectWithHistory(next, "칩셋 바꿈")).toBe(true);
    // 사용자는 지금 Rasak 계열 맵을 보고 있고, 되돌리면 EasyRPG 로 돌아간다 — 되돌리기는 막히면 안 된다.
    const ctx: ToolContext = { project: store.getCurrent(), currentMapId: MAP_ID };
    const result = runTool(ctx, "revert_last_edit", {}, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps[MAP_ID]!.tilesetId).toBe(COMBINED_TOWN_TILESET_ID);
  });

  it("(f) create_map tilesetId 생략 → 지금 보는 맵 칩셋(다른 계열일 때)", () => {
    const ctx: ToolContext = { project: uploadedProject(), currentMapId: MAP_ID };
    const result = runTool(ctx, "create_map", { id: "map_new", name: "새 들판", width: 20, height: 15 }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const map = ctx.project.maps.map_new!;
    expect(map.tilesetId).toBe("rasak_field");
    expect(map.tileSize).toBe(ctx.project.tilesets.rasak_field!.tileSize);
  });

  it("(f') EasyRPG 실내 맵을 볼 때 create_map 기본은 여전히 숲마을(같은 계열이면 도구 기본값)", () => {
    const project = createBlankProject();
    project.maps[MAP_ID]!.tilesetId = "easyrpg_chipset_interior";
    const ctx: ToolContext = { project, currentMapId: MAP_ID };
    const result = runTool(ctx, "create_map", { id: "map_new", name: "새 마을", width: 20, height: 15 }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps.map_new!.tilesetId).toBe(createBlankProject().maps[MAP_ID]!.tilesetId);
  });

  it("(g) EasyRPG 맵을 보며 EasyRPG 던전 파이프라인 → 통과", () => {
    const ctx: ToolContext = { project: createBlankProject(), currentMapId: MAP_ID };
    const result = dungeon(ctx);
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps.map_cave).toBeDefined();
  });

  it("dryRun 도 같은 검사를 탄다", () => {
    const project = uploadedProject();
    const result = runTool({ project, currentMapId: MAP_ID }, "run_dungeon_room_pipeline", { mapId: "map_cave", theme: "stone", width: 36, height: 28 }, { dryRun: true });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("tileset-family-change");
  });

  it("읽기 도구는 검사하지 않는다", () => {
    const result = runTool({ project: uploadedProject(), currentMapId: MAP_ID }, "get_project_summary", {});
    expect(result.ok, result.summary).toBe(true);
  });
});

describe("ask_tileset_change", () => {
  it("지금 보는 맵을 from 으로 질문 자료를 돌려주고 프로젝트는 그대로 둔다", () => {
    const project = createBlankProject();
    const snapshot = JSON.stringify(project);
    const ctx: ToolContext = { project, currentMapId: MAP_ID };
    const result = runTool(ctx, "ask_tileset_change", { toTilesetId: "opengameart_castle", reason: "성 안을 만들려면 성채 타일이 필요해요.", purpose: "castle_interior" });
    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("이 턴을 끝내라");
    expect(result.data).toEqual({
      kind: "tileset-change-question", mapId: MAP_ID,
      fromTilesetId: project.maps[MAP_ID]!.tilesetId, toTilesetId: "opengameart_castle",
      fromFamily: "easyrpg", toFamily: "castle", fromLabel: "EasyRPG", toLabel: "성채",
      reason: "성 안을 만들려면 성채 타일이 필요해요.", purpose: "castle_interior",
    });
    expect(JSON.stringify(ctx.project)).toBe(snapshot);
  });

  it("없는 타일셋·같은 계열·지금 맵 모름은 거부", () => {
    const ctx: ToolContext = { project: createBlankProject(), currentMapId: MAP_ID };
    expect(runTool(ctx, "ask_tileset_change", { toTilesetId: "nope", reason: "x" }).issues?.[0]?.code).toBe("tileset-not-found");
    expect(runTool(ctx, "ask_tileset_change", { toTilesetId: "easyrpg_chipset_dungeon", reason: "x" }).issues?.[0]?.code).toBe("tileset-same-family");
    expect(runTool({ project: createBlankProject() }, "ask_tileset_change", { toTilesetId: "opengameart_castle", reason: "x" }).issues?.[0]?.code).toBe("map-not-found");
  });

  it("core 도메인으로 늘 노출되는 읽기 도구", async () => {
    const { getTool } = await import("@/editor/tools/toolRegistry");
    const tool = getTool("ask_tileset_change");
    expect(tool?.mode).toBe("read");
    expect(tool?.domains).toEqual(["core"]);
  });
});
