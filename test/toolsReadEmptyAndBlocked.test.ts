import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

// 2026-11-11 B5a: 싼 모델은 스키마 칸을 기본값으로 다 채워 보낸다(빈 members, 서 있는 적의 patrol, 다른 graphic, 문앞과 같은 doorAt).
// 전에는 도구가 거절하고 game.ts 의 감싸개가 한국어 거절 글을 정규식으로 읽어 다시 불렀다. 이제 도구가 스스로 읽는다.
function fixture() {
  const ctx = { project: createBlankProject() };
  const mapId = ctx.project.startMapId;
  const map = ctx.project.maps[mapId];
  assert(map);
  const enemy = ctx.project.database.enemies[0];
  assert(enemy);
  const troop = runTool(ctx, "upsert_troop", { troop: { id: "troop_b5", name: "시험 무리", enemyIds: [enemy.id], members: [] } });
  return { ctx, mapId, map, troop };
}
const warningsOf = (result: { diff?: { warnings: string[] } }) => (result.diff?.warnings ?? []).join("\n");

describe("도구가 빈 칸·어긋난 칸을 스스로 읽는다", () => {
  it("upsert_troop: 빈 members 는 안 준 것이다", () => {
    const { ctx, troop } = fixture();
    assert(troop.ok, troop.summary);
    expect(ctx.project.database.troops.find((entry) => entry.id === "troop_b5")?.enemyIds).toHaveLength(1);
  });

  it("place_field_enemy: 서 있는 적의 patrol 은 무시하고 알린다", () => {
    const { ctx, mapId } = fixture();
    const result = runTool(ctx, "place_field_enemy", { mapId, x: 4, y: 4, troopId: "troop_b5", behavior: "stationary", patrol: { length: 1, axis: "horizontal", directions: [] } });
    assert(result.ok, result.summary);
    expect(warningsOf(result)).toContain("patrol was not used");
  });

  it("place_field_enemy: 추격 적의 내용 없는 patrol 은 없는 것으로 본다", () => {
    const { ctx, mapId } = fixture();
    const result = runTool(ctx, "place_field_enemy", { mapId, x: 12, y: 4, troopId: "troop_b5", behavior: "chase", patrol: { length: 1, directions: [] } });
    assert(result.ok, result.summary);
    expect((result.data as { cells?: unknown }).cells).toBeUndefined();
  });

  it("place_field_enemy: 전투 그림과 다른 graphic 은 거절하지 않고 전투 그림을 따른다", () => {
    const { ctx, mapId } = fixture();
    const result = runTool(ctx, "place_field_enemy", { mapId, x: 4, y: 10, troopId: "troop_b5", behavior: "stationary", graphic: { textureKey: "tex_easyrpg_charset_people1", characterIndex: 0 } });
    assert(result.ok, result.summary);
    expect(warningsOf(result)).toContain("uses the battle picture");
  });

  it("create_transfer_pair: doorAt 이 문앞과 같은 칸이면 문앞만 준 것으로 읽는다", () => {
    const { ctx, mapId } = fixture();
    const result = runTool(ctx, "create_transfer_pair", { a: { mapId, x: 5, y: 5, doorAt: { x: 5, y: 5 } }, b: { mapId, x: 15, y: 10 } });
    assert(result.ok, result.summary);
  });

  it("create_transfer_pair: 문앞이 막혔으면 가까운 닿는 칸으로 옮겨 잇고 알린다", () => {
    const { ctx, mapId, map } = fixture();
    const solid = Object.entries(ctx.project.tilesets[map.tilesetId]?.tileMeta ?? {}).find(([, meta]) => meta?.passage === "solid");
    assert(solid, "막힌 타일이 있어야 한다");
    for (const [x, y] of [[8, 4], [7, 4], [9, 4], [8, 5]] as const) map.upperTiles[y * map.width + x] = Number(solid[0]);
    const result = runTool(ctx, "create_transfer_pair", { a: { mapId, x: 8, y: 4, doorAt: { x: 8, y: 3 } }, b: { mapId, x: 15, y: 10 } });
    assert(result.ok, result.summary);
    expect(warningsOf(result)).toContain("linked at the nearest walkable cell");
    expect((result.data as { gateA: { x: number; y: number } }).gateA).not.toEqual({ x: 8, y: 4 });
  });
});
