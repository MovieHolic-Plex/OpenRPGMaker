// 조수 v2 칩셋 풀 마을 빌더 — 테마 없는 마을 요청이 프로젝트마다 다른 칩셋 마을로 짓게 한다(villageChipsetPool.ts, make_place 가 style "pool:<칩셋>" 을 박는다).
// 칩셋마다 이미 있는 결정론 구성기를 그대로 부른다: 북방·에도·사막·해적 compose_*_map, 조선 등록 장소 import_region_reference. 새 그림·새 시공기는 없다.
import { prepareTool } from "@/editor/tools/asyncToolRunner";
import { isPassable } from "@/project/collision";
import { isUntouchedMap } from "@/project/projectBlankness";
import type { GameMap, Project } from "@/project/types";
import { villagePoolEntryByStyle, VILLAGE_POOL_STYLE_PREFIX } from "../../../villageChipsetPool";
import type { BuildRun, PlaceBuildResult, PlaceBuilder, PlaceRecord, PlaceSpec } from "../../types";
import { onePassRefusal } from "../onePass";

const CREATE_SIZE: Record<string, readonly [number, number]> = { sengoku_edo: [54, 42], desert_east: [48, 36], pirate_isles: [48, 36] };

function walkSpot(project: Project, map: GameMap): { x: number; y: number } | undefined {
  const cx = Math.floor(map.width / 2);
  for (let y = map.height - 2; y >= 0; y--) for (let d = 0; d < map.width; d++) for (const x of [cx + d, cx - d]) {
    if (x >= 0 && x < map.width && isPassable(project, map, x, y)) return { x, y };
  }
  return undefined;
}

function composeArgs(tilesetId: string, mapId: string | undefined, name: string, seed: number): { tool: string; args: Record<string, unknown> } {
  switch (tilesetId) {
    case "snow_north": return { tool: "compose_snow_north_map", args: { style: "village", newMap: { name }, seed } };
    case "sengoku_edo": return { tool: "compose_sengoku_edo_map", args: { mapId, style: "village", seed } };
    case "desert_east": return { tool: "compose_desert_east_map", args: { mapId, kind: "oasis", seed } };
    case "pirate_isles": return { tool: "compose_pirate_isles_map", args: { mapId, kind: "beach", seed } };
    default: return { tool: "import_region_reference", args: { id: "joseon-v20-64x56", name } };
  }
}

function build(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): PlaceBuildResult {
  const first = run.calls.length;
  const entry = villagePoolEntryByStyle(spec.style);
  const fail = (summary: string): PlaceBuildResult => ({ ok: false, mapIds: previous?.result.mapIds ?? [], summary, warnings: [], missingArt: [], calls: run.calls.slice(first) });
  if (!entry) return fail("칩셋 풀 마을: 알 수 없는 칩셋 스타일이다.");
  if (previous) return fail(onePassRefusal(spec.name));
  const seed = typeof spec.hints?.poolSeed === "number" ? Math.max(1, Math.floor(spec.hints.poolSeed)) : (spec.salt ?? 1) % 9000 + 1;
  const tilesetId = entry.tilesetId;
  let mapId: string | undefined;
  const size = CREATE_SIZE[tilesetId];
  if (size) {
    const made = run.call("create_map", { name: spec.name, width: size[0], height: size[1], tilesetId });
    mapId = (made.data as { mapId?: string } | undefined)?.mapId;
    if (!made.ok || !mapId) return fail(`${entry.ko} 맵을 만들지 못했다: ${String(made.summary ?? "").slice(0, 200)}`);
  }
  const call = composeArgs(tilesetId, mapId, spec.name, seed);
  const res = run.call(call.tool, call.args);
  const builtId = (res.data as { mapId?: string } | undefined)?.mapId ?? mapId;
  const project = run.ctx.project;
  const map = builtId ? project.maps[builtId] : undefined;
  if (!res.ok || !builtId || !map) return fail(`${entry.ko} 짓기 실패: ${String(res.summary ?? "").slice(0, 300)}`);
  const start = project.maps[project.startMapId];
  if (project.startMapId !== builtId && (!start || isUntouchedMap(start))) {
    const spot = walkSpot(project, map);
    if (spot) run.call("set_start_position", { mapId: builtId, x: spot.x, y: spot.y });
  }
  const entrance = run.ctx.project.startMapId === builtId ? { mapId: builtId, ...run.ctx.project.startPos } : { mapId: builtId, ...(walkSpot(run.ctx.project, map) ?? { x: 0, y: 0 }) };
  return {
    ok: true,
    mapIds: [builtId],
    entrance,
    summary: `${spec.name}: ${entry.ko}(${tilesetId}) ${map.width}×${map.height} · 씨앗 ${seed} — ${String(res.summary ?? "").slice(0, 200)}`,
    warnings: [],
    missingArt: [],
    calls: run.calls.slice(first),
    state: { tilesetId, seed },
  };
}

export const VILLAGE_POOL_BUILDER: PlaceBuilder = {
  id: "village-pool",
  onePass: true,
  accepts: (spec) => spec.type === "village" && !!spec.style?.startsWith(VILLAGE_POOL_STYLE_PREFIX),
  prepare: async (spec) => { if (spec.style === "pool:joseon_baram") await prepareTool("import_region_reference", { id: "joseon-v20-64x56" }); },
  build,
};
