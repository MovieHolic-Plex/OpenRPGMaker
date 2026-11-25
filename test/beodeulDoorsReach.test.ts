// 마을의 문은 모두 입구에서 걸어 닿아야 한다(2026-11-15 실모델 확인 빌드 r5 «물레방아가 멈춘 날»: 언덕 위 탑집의 문 앞 19칸이 절벽 끝과 제 건물에 갇혀
// 아무도 그 문에 갈 수 없었다). 시공기는 기물을 다 놓은 뒤 입구에서 걸어 보고, 못 닿는 문이 남으면 그 문 앞 주머니를 피해 다시 짓는다(authorBeodeulTown).
// 닿는지는 시공기의 보고가 아니라 엔진의 걸음(canMove — 통행·단·경사로)으로 따로 번져 본다.
import { describe, expect, it } from "vitest";
import { freshBlankProject, ownTileset } from "./support/blankProject";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { canMove, isPassable } from "@/project/collision";
import { runTool } from "@/editor/tools";
import { buildingEntrances } from "@/ai/v2/place/entrances";
import { villageArgs } from "@/ai/v2/place/builders/village";
import type { ToolContext } from "@/editor/tools/types";
import type { PlaceSpec } from "@/ai/v2/shared/types";
import type { GameMap, Project } from "@/project/types";

type Data = { mapId: string; houses: number; entrance: { x: number; y: number }; doors: { kit: string; x: number; y: number; reached: boolean }[] };

/** r5 의 기록된 마을 요청 — 조수가 자리를 준 강가 마을(땅 씨앗 44829, 38×48). 높은 곳 건물을 북쪽 단의 좁은 턱에 청했다. */
const R5 = { type: "village", name: "물레강 마을", theme: "river", size: "medium", hints: { water: "river", landform: "flat", houseCount: 5, roofs: "red", terrainSeed: 44829,
  layout: { gather: { x: 17, y: 30 }, landmark: { x: 18, y: 6 }, anchor: { x: 24, y: 28 }, work: { x: 15, y: 22 }, houses: [{ x: 24, y: 20, kind: "medium" }, { x: 32, y: 22, kind: "small" }, { x: 32, y: 32, kind: "large" }, { x: 22, y: 38, kind: "small" }, { x: 30, y: 42, kind: "medium" }],
    fields: [{ x: 17, y: 44 }, { x: 26, y: 45 }], orchards: [{ x: 34, y: 38 }], pastures: [{ x: 30, y: 5 }], forests: [{ x: 36, y: 28 }, { x: 14, y: 12 }], props: [{ x: 20, y: 26 }, { x: 14, y: 33 }], exits: ["east"] }, width: 38, height: 48 } } as unknown as PlaceSpec;
const R5_KEY = JSON.stringify(["project", "154683ba-d3cf-4df7-93d2-14f4960debac"]);

// 빈 프로젝트는 파일마다 한 번 짓고 번들 타일셋을 동결 공유한다(test/support/blankProject.ts). 버들항 시공기와 이 파일은
// beodeul_city 타일셋을 제자리에서 고치므로(겉모습 look · 시설 킷 · 접목) 그 하나만 케이스마다 개인 사본으로 바꾼다.
function createBlankProject(): Project {
  const project = freshBlankProject();
  ownTileset(project, "beodeul_city");
  return project;
}

function town(args: Record<string, unknown>, key?: string): { project: Project; map: GameMap; data: Data; warnings: string[] } {
  const project = createBlankProject() as Project; ensureBundledTilesets(project);
  const ctx = { project, currentMapId: project.startMapId, ...(key ? { assistantRun: true, lookKey: key } : {}) } as ToolContext;
  const res = runTool(ctx, "author_beodeul_town", args);
  expect(res.ok, res.summary).toBe(true);
  const data = res.data as unknown as Data;
  const r = res as unknown as { diff?: { warnings?: string[] }; warnings?: string[] };
  return { project: ctx.project, map: ctx.project.maps[data.mapId]!, data, warnings: r.diff?.warnings ?? r.warnings ?? [] };
}
/** 입구에서 엔진 걸음으로 닿지 않는 문(문 앞 칸). */
function lostDoors(project: Project, map: GameMap, from: { x: number; y: number }): string[] {
  const W = map.width, H = map.height, seen = new Uint8Array(W * H), q: number[] = [];
  expect(isPassable(project, map, from.x, from.y), "입구 칸은 걸을 수 있다").toBe(true);
  seen[from.y * W + from.x] = 1; q.push(from.y * W + from.x);
  for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx] || !canMove(project, map, x, y, nx, ny)) continue; seen[ny * W + nx] = 1; q.push(ny * W + nx); } }
  return buildingEntrances(project, map).filter((d) => !seen[d.front.y * W + d.front.x]).map((d) => `${d.kit}@(${d.front.x},${d.front.y})`);
}

describe("마을의 문은 모두 입구에서 걸어 닿는다", () => {
  it.each([52002, 59921, 67840])("r5 의 기록된 요청(씨앗 %i): 언덕 위 탑집을 포함해 모든 건물의 문에 닿는다", (seed) => {
    const { project, map, data } = town({ ...villageArgs(R5).args, name: R5.name, seed }, R5_KEY);
    expect(data.doors.length).toBeGreaterThanOrEqual(7);
    expect(data.doors.filter((d) => !d.reached)).toEqual([]);
    expect(data.doors.some((d) => d.kit.includes("tower-house")), "높은 곳 건물이 빠지지 않고 선다").toBe(true);
    expect(lostDoors(project, map, data.entrance)).toEqual([]);
  }, 240_000);

  it.each([
    ["언덕 마을", { theme: "river", seed: 11, houseCount: 4, landform: "hill" }],
    ["다랑이 마을", { theme: "river", seed: 31, houseCount: 5, landform: "terraces" }],
    ["포구", { theme: "coast", seed: 5, houseCount: 4 }],
  ] as const)("자동 배치 %s: 모든 건물의 문에 닿는다", (_name, args) => {
    const { project, map, data } = town({ ...args });
    expect(data.doors.filter((d) => !d.reached)).toEqual([]);
    expect(lostDoors(project, map, data.entrance)).toEqual([]);
  }, 240_000);

  it("r5 의 요청(씨앗 52002)은 첫 판에서 탑집 문이 갇힌다 — 도구가 그 문 앞 주머니를 피해 다시 짓고 그 사실을 알린다", () => {
    const { warnings } = town({ ...villageArgs(R5).args, name: R5.name, seed: 52002 }, R5_KEY);
    expect(warnings.some((w) => /^Rebuilt \d+ time\(s\) so that every building door can be walked to/.test(w))).toBe(true);
  }, 240_000);
});
