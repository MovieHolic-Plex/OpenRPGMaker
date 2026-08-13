// 맵 인터뷰 툴 계약(2026-07-04): get_tile_info / set_tile_metadata / upsert_tile_group
// / analyze_map_tile_usage / highlight_map_region.
// 핵심 계약: 사용자 확정(confirmedByUser)은 잠금·최우선, 분석은 설명 없는 타일 우선 정렬,
// 기록된 지식은 list_resources/시스템 프롬프트에 반영된다.
import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";

const WINDOW_TILE = 85; // 상위 레이어 소품(창문) — 클러스터 페인팅용.

function ctx(): ToolContext {
  return { project: createBlankProject() };
}

function ctxWithMap(): { context: ToolContext; mapId: string } {
  const context = ctx();
  const created = runTool(context, "create_map", { name: "인터뷰 테스트", width: 8, height: 8, id: "map_interview" });
  expect(created.ok, created.summary).toBe(true);
  return { context, mapId: "map_interview" };
}

describe("set_tile_metadata", () => {
  it("라벨/설명/태그를 기록하고 기본 source는 ai다", () => {
    const context = ctx();
    const result = runTool(context, "set_tile_metadata", {
      entries: [{ tile: WINDOW_TILE, label: "창문", description: "집 벽에 붙는 장식", tags: ["집", "장식"] }],
    });
    expect(result.ok, result.summary).toBe(true);
    const meta = context.project.tilesets[DEFAULT_TILESET_ID].tileMeta?.[WINDOW_TILE];
    expect(meta?.label).toBe("창문");
    expect(meta?.description).toBe("집 벽에 붙는 장식");
    expect(meta?.tags).toEqual(["집", "장식"]);
    expect(meta?.source).toBe("ai");
    expect(meta?.userLocked).not.toBe(true);
  });

  it("confirmedByUser=true sets canonical and compatibility confirmation fields", () => {
    const context = ctx();
    runTool(context, "set_tile_metadata", { entries: [{ tile: WINDOW_TILE, label: "창문" }], confirmedByUser: true });
    const meta = context.project.tilesets[DEFAULT_TILESET_ID].tileMeta?.[WINDOW_TILE];
    expect(meta?.source).toBe("user");
    expect(meta?.userLocked).toBe(true);
    expect(meta?.origin).toBe("user");
    expect(meta?.locked).toBe(true);
    expect(meta?.confidence).toBe(1);
  });

  it("잠긴 타일은 confirmedByUser 없이는 덮어쓰지 못한다(건너뜀 경고)", () => {
    const context = ctx();
    runTool(context, "set_tile_metadata", { entries: [{ tile: WINDOW_TILE, label: "창문" }], confirmedByUser: true });
    const overwrite = runTool(context, "set_tile_metadata", { entries: [{ tile: WINDOW_TILE, label: "AI 추측" }] });
    expect(overwrite.ok).toBe(true);
    expect(overwrite.summary).toContain("잠금 건너뜀");
    expect(context.project.tilesets[DEFAULT_TILESET_ID].tileMeta?.[WINDOW_TILE].label).toBe("창문");
    // 사용자 확정으로는 수정 가능.
    runTool(context, "set_tile_metadata", { entries: [{ tile: WINDOW_TILE, label: "둥근 창문" }], confirmedByUser: true });
    expect(context.project.tilesets[DEFAULT_TILESET_ID].tileMeta?.[WINDOW_TILE].label).toBe("둥근 창문");
  });

  it("LLM 별칭 키(tileId/index/name)도 수용한다 — 라이브 스모크 실패 패턴 회귀", () => {
    const context = ctx();
    const result = runTool(context, "set_tile_metadata", {
      entries: [
        { tileId: WINDOW_TILE, name: "창문" },
        { index: 86, label: "창문 오른쪽" },
      ],
      confirmedByUser: true,
    });
    expect(result.ok, result.summary).toBe(true);
    const tileset = context.project.tilesets[DEFAULT_TILESET_ID];
    expect(tileset.tileMeta?.[WINDOW_TILE].label).toBe("창문");
    expect(tileset.tileMeta?.[86].label).toBe("창문 오른쪽");
  });

  it("범위 밖 타일은 실패한다", () => {
    const context = ctx();
    const result = runTool(context, "set_tile_metadata", { entries: [{ tile: 99999, label: "x" }] });
    expect(result.ok).toBe(false);
  });
});

describe("get_tile_info", () => {
  it("reports modern-only locks through the compatibility response field", () => {
    const context = ctx();
    const tileset = context.project.tilesets[DEFAULT_TILESET_ID];
    const current = tileset.tileMeta?.[WINDOW_TILE] ?? { label: "", description: "" };
    if (!tileset.tileMeta) throw new Error("missing tile metadata");
    tileset.tileMeta[WINDOW_TILE] = { ...current, locked: true };

    const result = runTool(context, "get_tile_info", { tileIds: [WINDOW_TILE] });
    const data = result.data as { tiles: Array<{ userLocked: boolean }> };

    expect(data.tiles[0]?.userLocked).toBe(true);
  });

  it("기록된 라벨/태그/통행성/레이어/그룹 규칙을 돌려준다", () => {
    const context = ctx();
    runTool(context, "set_tile_metadata", { entries: [{ tile: WINDOW_TILE, label: "창문", tags: ["집"] }], confirmedByUser: true });
    runTool(context, "upsert_tile_group", {
      name: "집 장식",
      role: "prop",
      tileIds: [WINDOW_TILE],
      placementRules: "벽 타일 위에만 배치",
    });
    const result = runTool(context, "get_tile_info", { tileIds: [WINDOW_TILE, TILE.WALL] });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { tiles: Array<Record<string, unknown>> };
    expect(data.tiles).toHaveLength(2);
    const windowInfo = data.tiles[0];
    expect(windowInfo.label).toBe("창문");
    expect(windowInfo.userLocked).toBe(true);
    // 번들 기본 그룹이 이미 있을 수 있으므로 내가 만든 규칙이 포함되는지만 본다.
    expect((windowInfo.groups as Array<{ placementRules: string }>).some((group) => group.placementRules === "벽 타일 위에만 배치")).toBe(true);
    const wallInfo = data.tiles[1];
    expect(wallInfo.passable).toBe(false); // WALL은 통행 불가.
  });
});

describe("upsert_tile_group", () => {
  it("그룹을 생성하고 defaultLayer를 priority에서 추론한다", () => {
    const context = ctx();
    const result = runTool(context, "upsert_tile_group", {
      name: "울타리",
      role: "fence",
      tileIds: [378, 379, 380],
      placementRules: "모서리→가로 반복→모서리 순서로 배치",
    });
    expect(result.ok, result.summary).toBe(true);
    // 번들 타일셋에 같은 이름의 기본 그룹이 있으므로 반환된 groupId로 찾는다.
    const groupId = (result.data as { groupId: string }).groupId;
    const group = context.project.tilesets[DEFAULT_TILESET_ID].tileGroups?.find((entry) => entry.id === groupId);
    expect(group).toBeDefined();
    expect(group?.placementRules).toContain("반복");
    expect(group?.source).toBe("user");
    const update = runTool(context, "upsert_tile_group", {
      id: groupId,
      name: "나무 울타리",
      role: "fence",
      tileIds: [378, 379],
    });
    expect(update.ok).toBe(true);
    expect((update.data as { created: boolean }).created).toBe(false);
    expect(context.project.tilesets[DEFAULT_TILESET_ID].tileGroups?.find((entry) => entry.id === groupId)?.name).toBe("나무 울타리");
  });

  it("모르는 id/role은 거부한다", () => {
    const context = ctx();
    expect(runTool(context, "upsert_tile_group", { id: "ghost", name: "x", role: "fence", tileIds: [1] }).ok).toBe(false);
    expect(runTool(context, "upsert_tile_group", { name: "x", role: "flying", tileIds: [1] }).ok).toBe(false);
  });
});

describe("analyze_map_tile_usage", () => {
  it("클러스터 bbox·인접 통계·설명 없는 타일 우선 정렬을 제공한다", () => {
    const { context, mapId } = ctxWithMap();
    const map = context.project.maps[mapId];
    // (2,2)~(4,3)에 창문 타일 2x3 클러스터를 상위 레이어에 깐다.
    for (let y = 2; y <= 3; y += 1) {
      for (let x = 2; x <= 4; x += 1) map.upperTiles[y * map.width + x] = WINDOW_TILE;
    }
    // 정렬(설명됨 vs 설명 없음)을 검증하려면 설명된 타일도 포함해야 한다(기본값은 설명 없는 것만).
    const result = runTool(context, "analyze_map_tile_usage", { mapId, includeDescribed: true });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as {
      coverage: { used: number; described: number };
      tiles: Array<{ tile: number; described: boolean; count: number; sampleRegion: { x: number; y: number; w: number; h: number }; mostCommonBelow: number | null; label?: string; knownVia: string | null }>;
    };
    const windowStat = data.tiles.find((stat) => stat.tile === WINDOW_TILE);
    expect(windowStat).toBeDefined();
    expect(windowStat?.count).toBe(6);
    expect(windowStat?.sampleRegion).toEqual({ x: 2, y: 2, w: 3, h: 2 });
    // 클러스터 바로 아래 줄: (2..4,4) — 상위는 비었고 하위는 잔디.
    expect(windowStat?.mostCommonBelow).toBe(TILE.GRASS);
    // 설명 없는 타일이 설명된 타일보다 앞에 온다.
    const firstDescribedIndex = data.tiles.findIndex((stat) => stat.described);
    const lastUndescribedIndex = data.tiles.map((stat) => stat.described).lastIndexOf(false);
    if (firstDescribedIndex !== -1 && lastUndescribedIndex !== -1) {
      expect(lastUndescribedIndex).toBeLessThan(firstDescribedIndex);
    }
  });

  it("사용자가 가르친 타일은 described=true, knownVia=user로 바뀐다", () => {
    const { context, mapId } = ctxWithMap();
    const map = context.project.maps[mapId];
    map.upperTiles[2 * map.width + 2] = WINDOW_TILE;
    const before = runTool(context, "analyze_map_tile_usage", { mapId });
    const beforeStat = (before.data as { tiles: Array<{ tile: number; knownVia: string | null }> }).tiles.find((stat) => stat.tile === WINDOW_TILE);
    runTool(context, "set_tile_metadata", { entries: [{ tile: WINDOW_TILE, label: "창문" }], confirmedByUser: true });
    // 확정 후에는 described=true라 기본 목록에서 빠진다 — 포함시켜 상태 전이를 검증한다(#7 회귀).
    const after = runTool(context, "analyze_map_tile_usage", { mapId, includeDescribed: true });
    const afterStat = (after.data as { tiles: Array<{ tile: number; described: boolean; knownVia: string | null; label?: string }> }).tiles.find((stat) => stat.tile === WINDOW_TILE);
    expect(afterStat?.described).toBe(true);
    expect(afterStat?.knownVia).toBe("user");
    expect(afterStat?.label).toBe("창문");
    // 가르치기 전에는 최소한 user는 아니어야 한다.
    expect(beforeStat?.knownVia).not.toBe("user");
  });
});

describe("show_tiles", () => {
  it("타일 목록을 표시 데이터로 돌려준다(최대 12개, 범위 검증)", () => {
    const context = ctx();
    const result = runTool(context, "show_tiles", { tileIds: [WINDOW_TILE, 86, 87] });
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toEqual({ tilesetId: DEFAULT_TILESET_ID, tiles: [WINDOW_TILE, 86, 87] });
    expect(runTool(context, "show_tiles", { tileIds: [99999] }).ok).toBe(false);
    expect(runTool(context, "show_tiles", { tileIds: [] }).ok).toBe(false);
  });
});

describe("highlight_map_region", () => {
  it("범위를 맵 안으로 클램프해 강조 영역을 돌려준다", () => {
    const { context, mapId } = ctxWithMap();
    const result = runTool(context, "highlight_map_region", { mapId, x: -3, y: 5, w: 100, h: 2 });
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toEqual({ mapId, x: 0, y: 5, w: 8, h: 2 });
  });
});

describe("타일 지식 배선(검색·시스템 프롬프트)", () => {
  it("가르친 라벨이 list_resources(tile) 검색에 히트한다", () => {
    const context = ctx();
    runTool(context, "set_tile_metadata", {
      entries: [{ tile: WINDOW_TILE, label: "루비 창문", tags: ["보석집"] }],
      confirmedByUser: true,
    });
    const byLabel = runTool(context, "list_resources", { kind: "tile", query: "루비 창문" });
    expect(byLabel.ok).toBe(true);
    const matches = (byLabel.data as { matches: Array<{ id: string }> }).matches;
    expect(matches.some((match) => match.id === `tile:${WINDOW_TILE}`)).toBe(true);
    // 커스텀 태그로도 검색된다.
    const byTag = runTool(context, "list_resources", { kind: "tile", query: "보석집" });
    expect((byTag.data as { matches: Array<{ id: string }> }).matches.some((match) => match.id === `tile:${WINDOW_TILE}`)).toBe(true);
  });

  it("그룹 이름이 소속 타일의 검색 태그가 된다", () => {
    const context = ctx();
    runTool(context, "upsert_tile_group", { name: "수정 울타리", role: "fence", tileIds: [378] });
    const result = runTool(context, "list_resources", { kind: "tile", query: "수정 울타리" });
    expect((result.data as { matches: Array<{ id: string }> }).matches.some((match) => match.id === "tile:378")).toBe(true);
  });

  it("사용자가 가르친 타일이 있으면 시스템 프롬프트에 타일 지식 섹션이 실린다", () => {
    const context = ctx();
    const blankPrompt = buildSystemPrompt(context.project);
    expect(blankPrompt).not.toContain("타일 지식");
    runTool(context, "set_tile_metadata", {
      entries: [{ tile: WINDOW_TILE, label: "루비 창문", description: "보석 저택 전용 창문" }],
      confirmedByUser: true,
    });
    runTool(context, "upsert_tile_group", {
      name: "보석 저택",
      role: "building",
      tileIds: [WINDOW_TILE],
      placementRules: "벽 위에 가로로 배치",
    });
    const prompt = buildSystemPrompt(context.project);
    expect(prompt).toContain("타일 지식");
    expect(prompt).toContain("루비 창문");
    expect(prompt).toContain("벽 위에 가로로 배치");
  });
});
