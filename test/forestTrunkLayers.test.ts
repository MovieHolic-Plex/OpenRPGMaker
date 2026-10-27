// 숲 합성 레이어 회귀 — 밑동(290/292/293)은 lower solid 가 정위치다.
// liftTrunksToUpper(2026-09 초)가 밑동을 upper 로 들어올려 런타임 렌더러의
// lower 투명-밑동 잔디 받침을 빗나가게 했다(투명 픽셀 구멍). 재발 방지.
import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { RETIRED_COMBINED_TOWN_TILESET_ID, withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";

const TRUNKS = new Set([290, 291, 292, 293]);
const CANOPIES = new Set([260, 261, 262, 263]);

function setup() {
  // 밑동 290~293·수관 260~263 은 옛 combined_town 칸 번호다 — 2026-10-07 정리 뒤 기본 칩셋(beodeul_city)이 아니므로 그 시트를 명시해 만든다.
  const ctx: ToolContext = { project: withRetiredEasyRpgTilesets(createEmptyToolProject("숲 레이어 회귀")) };
  const made = runTool(ctx, "create_map", { name: "숲", width: 30, height: 30, tilesetId: RETIRED_COMBINED_TOWN_TILESET_ID });
  const mapId = (made.data as { mapId: string }).mapId;
  return { ctx, mapId };
}

function layerCounts(mapId: string, ctx: ToolContext) {
  const map = ctx.project.maps[mapId]!;
  let canopyUpper = 0;
  let canopyLower = 0;
  let trunkUpper = 0;
  let trunkLower = 0;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const i = y * map.width + x;
      const u = map.upperTiles[i] ?? -1;
      const l = map.lowerTiles[i] ?? -1;
      if (CANOPIES.has(u)) canopyUpper += 1;
      if (CANOPIES.has(l)) canopyLower += 1;
      if (TRUNKS.has(u)) trunkUpper += 1;
      if (TRUNKS.has(l)) trunkLower += 1;
    }
  }
  return { canopyUpper, canopyLower, trunkUpper, trunkLower };
}

describe("forest composition trunk layers", () => {
  it("dense 합성: 수관은 upper, 밑동은 lower — upper 고아 밑동 없음", () => {
    const { ctx, mapId } = setup();
    const r = runTool(ctx, "place_props", {
      mapId, area: { x: 2, y: 2, w: 20, h: 20 }, material: "침엽수", density: "dense", seed: 7,
    });
    expect(r.ok, r.summary).toBe(true);
    const c = layerCounts(mapId, ctx);
    expect(c.trunkLower).toBeGreaterThan(0);
    expect(c.trunkUpper).toBe(0);
    expect(c.canopyLower).toBe(0);
    expect(c.canopyUpper).toBeGreaterThan(0);
  });

  it("impassable 합성: 밑동은 lower — gap-closure 덤불이 밑동을 upper 로 밀지 않음", () => {
    const { ctx, mapId } = setup();
    const r = runTool(ctx, "place_props", {
      mapId, area: { x: 2, y: 2, w: 20, h: 20 }, material: "활엽수", density: "impassable", seed: 7,
    });
    expect(r.ok, r.summary).toBe(true);
    const c = layerCounts(mapId, ctx);
    expect(c.trunkLower).toBeGreaterThan(0);
    expect(c.trunkUpper).toBe(0);
    expect(c.canopyLower).toBe(0);
  });
});
