// 조수 v2 칩셋 풀 마을 빌더 — 테마 없는 마을 요청이 프로젝트마다 다른 칩셋 마을로 짓게 한다(villageChipsetPool.ts, make_place 가 style "pool:<칩셋>" 을 박는다).
// 칩셋마다 이미 있는 결정론 구성기를 그대로 부른다: 북방·에도·사막·해적 compose_*_map, 조선 등록 장소 import_region_reference. 새 그림·새 시공기는 없다.
import { prepareTool } from "@/editor/tools/asyncToolRunner";
import { isPassable } from "@/project/collision";
import { isUntouchedMap } from "@/project/projectBlankness";
import type { GameMap, Project } from "@/project/types";
import { villagePoolEntryByStyle, VILLAGE_POOL_STYLE_PREFIX } from "../../../villageChipsetPool";
import type { BuildRun, PlaceBuildResult, PlaceBuilder, PlaceRecord, PlaceSpec } from "../../shared/types";
import { onePassRefusal } from "../onePass";

const CREATE_SIZE: Record<string, readonly [number, number]> = { sengoku_edo: [54, 42], desert_east: [48, 36], pirate_isles: [48, 36] };
/** 해적 군도의 마을은 섬(beach)이다 — 다른 맵으로 나가는 변을 주문받으면 섬에서는 길을 낼 수 없어 큰길이 동서 가장자리에 닿는 항구 마을로 짓는다. */
const PIRATE_MAINLAND_SIZE: readonly [number, number] = [56, 40];
type Sides = NonNullable<PlaceSpec["exits"]>;

function walkSpot(project: Project, map: GameMap): { x: number; y: number } | undefined {
  const cx = Math.floor(map.width / 2);
  for (let y = map.height - 2; y >= 0; y--) for (let d = 0; d < map.width; d++) for (const x of [cx + d, cx - d]) {
    if (x >= 0 && x < map.width && isPassable(project, map, x, y)) return { x, y };
  }
  return undefined;
}

/** 구성기 호출 — exits(다른 맵으로 나가는 변)는 그 인자를 받는 구성기에만 싣는다(북방·사막·해적). */
function composeArgs(tilesetId: string, mapId: string | undefined, name: string, seed: number, exits: Sides): { tool: string; args: Record<string, unknown> } {
  const out = exits.length ? { exits } : {};
  switch (tilesetId) {
    case "snow_north": return { tool: "compose_snow_north_map", args: { style: "village", newMap: { name }, seed, ...out } };
    case "sengoku_edo": return { tool: "compose_sengoku_edo_map", args: { mapId, style: "village", seed } };
    case "desert_east": return { tool: "compose_desert_east_map", args: { mapId, kind: "oasis", seed, ...out } };
    case "pirate_isles": return { tool: "compose_pirate_isles_map", args: { mapId, kind: exits.length ? "harbor" : "beach", seed, ...out } };
    default: return { tool: "import_region_reference", args: { id: "joseon-v20-64x56", name } };
  }
}

/** 구성기가 돌려준 «나가는 길이 가장자리에 닿은 칸»(해적 군도 data.exits[{side,x,y}])과 못 낸 변 — 잇기(create_transfer_pair)가 쓸 좌표를 요약에 싣는다. */
export function roadExitNote(data: unknown): string {
  const d = (data ?? {}) as { exits?: unknown; exitsMissing?: unknown };
  const cells = (Array.isArray(d.exits) ? d.exits : []).filter((e): e is { side: string; x: number; y: number } => !!e && typeof (e as { side?: unknown }).side === "string" && Number.isInteger((e as { x?: unknown }).x) && Number.isInteger((e as { y?: unknown }).y));
  const missing = (Array.isArray(d.exitsMissing) ? d.exitsMissing : []).filter((m): m is string => typeof m === "string");
  return (cells.length ? ` · road leaves the map at ${cells.map((e) => `${e.side} (${e.x},${e.y})`).join(", ")}` : "")
    + (missing.length ? ` · no road to the ${missing.join(", ")} edge (sea)` : "");
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
  const exits: Sides = [...new Set(spec.exits ?? [])];
  const mainland = tilesetId === "pirate_isles" && exits.length > 0;
  const size = mainland ? PIRATE_MAINLAND_SIZE : CREATE_SIZE[tilesetId];
  if (size) {
    const made = run.call("create_map", { name: spec.name, width: size[0], height: size[1], tilesetId });
    mapId = (made.data as { mapId?: string } | undefined)?.mapId;
    if (!made.ok || !mapId) return fail(`${entry.ko} 맵을 만들지 못했다: ${String(made.summary ?? "").slice(0, 200)}`);
  }
  const call = composeArgs(tilesetId, mapId, spec.name, seed, exits);
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
    summary: `${spec.name}: ${mainland ? "해적 항구 마을" : entry.ko}(${tilesetId}) ${map.width}×${map.height} · 씨앗 ${seed}${roadExitNote(res.data)} — ${String(res.summary ?? "").slice(0, 200)}`,
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
