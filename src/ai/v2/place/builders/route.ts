// 조수 v2 길목 빌더 — 장소 종류 "route"(지나가는 곳: 산길·정령 숲 …)를 버들항 길 도구 author_wild_route{theme} 한 번으로 짓는다.
//
// 모델은 «무엇» 만 적는다: 갈래(theme — 닫힌 목록), 크기, 있어야 할 볼거리(features — 닫힌 낱말), 드나드는 변(exits). 칸은 코드가 깐다.
// 갈래 안의 가짓수(짜임·주인공 볼거리)는 게임 열쇠(variety)와 그 씨앗으로 고른다 — 이름·요청 글의 낱말을 읽지 않는다.
// 결과 state 에 들어오는 칸·나가는 칸·볼거리 앞 칸·곁가지 끝·길 위 빈 칸을 싣는다(사람·사건·적을 놓는 쪽이 읽는다).
import { SHEER_TERRAIN_BUILDER, sheerKindFor } from "./sheerTerrain";
import { SHEER_KIND_IDS } from "../sheerKindLines";
import { lookHash } from "@/project/kitLook";
import { isUntouchedMap } from "@/project/projectBlankness";
import { parseRouteFeature, parseRouteTheme, ROUTE_FEATURES, ROUTE_THEME_GLOSS, ROUTE_THEMES, type RouteTheme } from "@/editor/tools/routeThemes";
import type { BuildRun, PlaceBuildResult, PlaceBuilder, PlaceRecord, PlaceSpec, Side } from "../../shared/types";

/**
 * v2 계획 모델에게 주는 길목 지식. 갈래는 «id (풀이)» 한 토막씩, 볼거리 낱말은 모든 갈래가 같이 쓰는 한 벌 —
 * 갈래가 열다섯으로 늘어도 카드는 갈래마다 그 한 토막만 자란다(갈래마다 낱말 목록을 싣지 않는다).
 */
export const ROUTE_CARD =
  `[Route type:route] Passage. theme: ${ROUTE_THEMES.map((t) => `${t} (${ROUTE_THEME_GLOSS[t]})`).join(" · ")}. `
  + `features: ${ROUTE_FEATURES.join(" · ")}. For cliff or glade paths, hints.kind: ${SHEER_KIND_IDS}. `
  + "exits: 1–4 sides. Links shape dead ends, junctions and dungeon mouths.";

type Cell = { readonly x: number; readonly y: number };
const SIDES: readonly Side[] = ["north", "south", "east", "west"];
const SIZES: Record<NonNullable<PlaceSpec["size"]>, readonly [number, number]> = { small: [28, 34], medium: [32, 42], large: [40, 50] };

const INSIDE_KINDS = new Set(["dungeon", "cave", "interior", "house"]);
/**
 * 길이 닿는 변 1~4개(첫째가 들어오는 변). make_game 이 채운 이웃(routeLinks)이 있으면 그 가운데 바깥 장소로 가는 변들 — 하나뿐이면 길이 맵 안에서 끝난다.
 * 이웃 자료가 없으면 명세의 exits(1~4), 그것도 없으면 남 → 북.
 */
function sidesOf(spec: PlaceSpec): Side[] {
  const linked = [...new Set((spec.routeLinks ?? []).filter((l) => !INSIDE_KINDS.has(l.kind) && l.side).map((l) => l.side!))];
  if (linked.length) return linked;
  const given = [...new Set((spec.exits ?? []).filter((x): x is Side => SIDES.includes(x as Side)))];
  if (spec.routeLinks?.length) return given.length ? [given[0]!] : ["south"];   // 이웃이 던전뿐: 들어오는 변 하나
  return given.length ? given : ["south", "north"];
}

export function routeArgs(spec: PlaceSpec): { theme: RouteTheme; sides: Side[]; seed: number; feature?: string; dungeon?: string; villageSide?: Side; villagePaved?: boolean; width: number; height: number; warnings: string[] } {
  const warnings: string[] = [];
  const key = spec.variety ?? `${spec.name}|${spec.salt ?? 0}`;
  let theme = parseRouteTheme(spec.theme);
  if (!theme) {
    if (spec.theme) warnings.push(`theme «${spec.theme}» is not a route theme (${ROUTE_THEMES.join(" · ")}) — chosen per game instead.`);
    theme = ROUTE_THEMES[lookHash(`route-theme|${key}`) % ROUTE_THEMES.length]!;
  }
  const feature = (spec.features ?? []).map((f) => parseRouteFeature(String(f).trim().toLowerCase())).find((f) => f !== undefined);
  const unknown = (spec.features ?? []).filter((f) => !parseRouteFeature(String(f).trim().toLowerCase()));
  if (unknown.length) warnings.push(`features ${unknown.map((f) => `«${f}»`).join(", ")} are not route features (${ROUTE_FEATURES.join(" · ")}) — ignored.`);
  const sides = sidesOf(spec);
  const seed = lookHash(`route-seed|${key}|${spec.name}`) % 1_000_000;
  const dungeonLink = (spec.routeLinks ?? []).find((l) => l.kind === "dungeon" || l.kind === "cave");
  const villageLink = (spec.routeLinks ?? []).find((l) => l.kind === "village" && l.side && sides.includes(l.side));
  // 맵 꼴: 세로로 긴 것만이 아니다 — 동서로만 지나면 가로로 길고, 갈림길(변 셋·넷)은 정사각·큰 맵, 나머지는 게임 열쇠가 세로·정사각·가로 가운데서 고른다(단은 늘 남북으로 오른다)
  const [w, h] = SIZES[spec.size ?? "medium"];
  const tall: [number, number] = [w, h], square: [number, number] = [Math.round((w + h) / 2) + 1, Math.round((w + h) / 2) + 1], broad: [number, number] = [Math.round(h * 1.05), Math.max(32, w)], big: [number, number] = [Math.round(h * 1.08), Math.round(h * 1.08)];
  const sideways = sides.length >= 2 && sides.every((x) => x === "east" || x === "west");
  const pool = sideways ? [broad, broad, square] : sides.length >= 3 ? [square, big, big] : sides.length === 1 ? [tall, square, tall] : [tall, square, broad, tall];
  const [width, height] = pool[lookHash(`route-dims|${key}|${spec.name}`) % pool.length]!;
  return { theme, sides, seed, ...(feature ? { feature } : {}), ...(dungeonLink ? { dungeon: dungeonLink.dungeonType ?? "cave" } : {}), ...(villageLink ? { villageSide: villageLink.side!, villagePaved: villageLink.paved === true } : {}), width, height, warnings };
}

function build(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): PlaceBuildResult {
  const first = run.calls.length;
  const fail = (summary: string): PlaceBuildResult => ({ ok: false, mapIds: previous?.result.mapIds ?? [], summary, warnings: [], missingArt: [], calls: run.calls.slice(first) });
  const project0 = run.ctx.project;
  if (!project0.tilesets.beodeul_city) return fail("this project has no beodeul_city chipset — a route map cannot be built here.");
  const args = routeArgs(spec);
  if (sheerKindFor(spec)) {
    return SHEER_TERRAIN_BUILDER.build(run, { ...spec, exits: args.sides }, previous);
  }
  let mapId = spec.mapId && project0.maps[spec.mapId] ? spec.mapId : previous?.result.mapIds[0];
  const again = !!mapId && !!project0.maps[mapId];
  if (!again) {
    // 빈 시작 맵은 쓰지 않는다(크기가 다르다) — 새 맵을 만든다.
    const made = run.call("create_map", { name: spec.name, width: args.width, height: args.height, tilesetId: "beodeul_city" });
    mapId = (made.data as { mapId?: string } | undefined)?.mapId;
    if (!made.ok || !mapId) return fail(`create_map: ${String(made.summary ?? "").slice(0, 200)}`);
  }
  const res = run.call("author_wild_route", { mapId, theme: args.theme, sides: args.sides, seed: args.seed, ...(args.feature ? { feature: args.feature } : {}), ...(args.dungeon ? { dungeon: args.dungeon } : {}), ...(args.villageSide ? { villageSide: args.villageSide, villagePaved: !!args.villagePaved } : {}), ...(again ? { replace: true } : {}) });
  if (!res.ok) {
    if (!again && run.ctx.project.maps[mapId!] && isUntouchedMap(run.ctx.project.maps[mapId!]!)) run.call("remove_map", { mapId });
    return fail(`route «${spec.name}» could not be built: ${String(res.summary ?? "").slice(0, 240)}`);
  }
  const data = (res.data ?? {}) as { relief?: string; pathSteps?: { single: number; repeat: number }; kitMax?: number; sealed?: number; shape?: string; routeExits?: { side: Side; x: number; y: number }[]; dungeonGate?: Cell | null; variant?: string; layout?: string; hero?: string; heroName?: string; mood?: string | null; entry?: Cell; exit?: Cell; heroAt?: unknown; heroFront?: Cell | null; side?: string; sideAt?: Cell | null; enemySpots?: Cell[] };
  if (run.ctx.project.maps[mapId!]?.name !== spec.name) run.call("set_map_properties", { mapId, name: spec.name });
  // 안개 낀 가짓수와 정령 숲의 어스름은 실제 조명·날씨로(그림이 아니다)
  if (data.mood === "fog" || args.theme === "spirit") {
    run.call("set_scene_mood", { mapId, applyMode: "map", ...(args.theme === "spirit" ? { lighting: { ambient: 0.24, color: "#173a44" } } : {}), ...(data.mood === "fog" ? { weather: { kind: "fog", intensity: 0.45 } } : {}) });
  }
  const project = run.ctx.project, map = project.maps[mapId!]!;
  const entry = data.entry ?? { x: Math.floor(map.width / 2), y: map.height - 1 };
  const startMap = project.maps[project.startMapId];
  if (project.startMapId !== mapId && (!startMap || isUntouchedMap(startMap))) run.call("set_start_position", { mapId, x: entry.x, y: Math.max(0, Math.min(map.height - 1, entry.y)) });
  const free = [...(data.heroFront ? [data.heroFront] : []), ...(data.sideAt ? [data.sideAt] : []), ...(data.enemySpots ?? [])];
  return {
    ok: true,
    mapIds: [mapId!],
    entrance: { mapId: mapId!, x: entry.x, y: entry.y },
    summary: `${spec.name}: ${args.theme} route ${map.width}×${map.height} (${mapId}, ${data.shape ?? "pass"} · ${data.variant ?? "?"}) — landmark «${data.heroName ?? "?"}»${data.heroFront ? ` at heroFront (${data.heroFront.x},${data.heroFront.y})` : " (not placed)"}`
      + `${data.sideAt ? `, side nook ${data.side} (${data.sideAt.x},${data.sideAt.y})` : ""}, enemySpots ${(data.enemySpots ?? []).map((c) => `(${c.x},${c.y})`).join(" ") || "-"}, road reaches ${(data.routeExits ?? []).map((e) => `${e.side} (${e.x},${e.y})`).join(" · ") || args.sides.join(" · ")}${data.dungeonGate ? `, dungeon entrance cell (${data.dungeonGate.x},${data.dungeonGate.y})` : ""}`,
    warnings: [...args.warnings, ...(res.warnings ?? []).map(String)],
    missingArt: [],
    calls: run.calls.slice(first),
    state: { tilesetId: "beodeul_city", theme: args.theme, shape: data.shape, relief: data.relief, pathSteps: data.pathSteps, kitMax: data.kitMax, sealed: data.sealed, routeExits: data.routeExits ?? [], ...(data.dungeonGate ? { dungeonGate: data.dungeonGate } : {}), variant: data.variant, layout: data.layout, hero: data.hero, side: data.side, entry, exit: data.exit, heroAt: data.heroAt, heroFront: data.heroFront ?? undefined, sideAt: data.sideAt ?? undefined, enemySpots: data.enemySpots ?? [], freeSpots: free, start: entry },
  };
}

export const ROUTE_BUILDER: PlaceBuilder = {
  id: "route",
  accepts: (spec) => spec.type === "route",
  build,
};
