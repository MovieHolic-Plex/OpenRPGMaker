// 조수 v2 길목 빌더 — 장소 종류 "route"(지나가는 곳: 산길·정령 숲 …)를 버들항 길 도구 author_wild_route{theme} 한 번으로 짓는다.
//
// 모델은 «무엇» 만 적는다: 갈래(theme — 닫힌 목록), 크기, 있어야 할 볼거리(features — 닫힌 낱말), 드나드는 변(exits). 칸은 코드가 깐다.
// 갈래 안의 가짓수(짜임·주인공 볼거리)는 게임 열쇠(variety)와 그 씨앗으로 고른다 — 이름·요청 글의 낱말을 읽지 않는다.
// 결과 state 에 들어오는 칸·나가는 칸·볼거리 앞 칸·곁가지 끝·길 위 빈 칸을 싣는다(사람·사건·적을 놓는 쪽이 읽는다).
import { lookHash } from "@/project/kitLook";
import { isUntouchedMap } from "@/project/projectBlankness";
import { parseRouteTheme, ROUTE_THEMES, routeFeatureWords, type RouteTheme } from "@/editor/tools/routeThemes";
import type { BuildRun, PlaceBuildResult, PlaceBuilder, PlaceRecord, PlaceSpec, Side } from "../../shared/types";

/** v2 계획 모델에게 주는 길목 지식. */
export const ROUTE_CARD =
  "[Route type:route] A passage map between places (not a destination): the road runs from one map edge to another, with one landmark of that route and a dead-end side nook. Beodeul chipset. "
  + `theme = exactly one of: mountain (mountain trail, hiking path, pass) · spirit (spirit or fairy forest); omitted = chosen per game. size small|medium|large. exits = [side you enter from, side you leave by] (default south, north). `
  + `features (optional, one closed word; omitted = chosen per game): ${ROUTE_THEMES.map((t) => `${t} → ${routeFeatureWords(t).join(" · ")}`).join("; ")}. `
  + "The result names the landmark and gives free cells: heroFront (a person or event beside the landmark), sideAt (rest spot or chest), enemySpots (visible enemies on the road).";

type Cell = { readonly x: number; readonly y: number };
const SIDES: readonly Side[] = ["north", "south", "east", "west"];
const OPPOSITE: Record<Side, Side> = { north: "south", south: "north", east: "west", west: "east" };
const SIZES: Record<NonNullable<PlaceSpec["size"]>, readonly [number, number]> = { small: [28, 34], medium: [32, 42], large: [40, 50] };

/** 명세의 드나드는 변 둘 — 없으면 남 → 북, 하나면 그 맞은편으로. */
function sidesOf(spec: PlaceSpec): [Side, Side] {
  const given = (spec.exits ?? []).filter((s): s is Side => SIDES.includes(s as Side));
  if (given.length >= 2 && given[0] !== given[1]) return [given[0]!, given[1]!];
  if (given.length === 1) return [given[0]!, OPPOSITE[given[0]!]];
  return ["south", "north"];
}

export function routeArgs(spec: PlaceSpec): { theme: RouteTheme; sides: [Side, Side]; seed: number; feature?: string; width: number; height: number; warnings: string[] } {
  const warnings: string[] = [];
  const key = spec.variety ?? `${spec.name}|${spec.salt ?? 0}`;
  let theme = parseRouteTheme(spec.theme);
  if (!theme) {
    if (spec.theme) warnings.push(`theme «${spec.theme}» is not a route theme (${ROUTE_THEMES.join(" · ")}) — chosen per game instead.`);
    theme = ROUTE_THEMES[lookHash(`route-theme|${key}`) % ROUTE_THEMES.length]!;
  }
  const words = routeFeatureWords(theme);
  const feature = (spec.features ?? []).map((f) => String(f).trim().toLowerCase()).find((f) => words.includes(f));
  const unknown = (spec.features ?? []).filter((f) => !words.includes(String(f).trim().toLowerCase()));
  if (unknown.length) warnings.push(`features ${unknown.map((f) => `«${f}»`).join(", ")} are not ${theme} route features (${words.join(" · ")}) — ignored.`);
  const sides = sidesOf(spec);
  const [w, h] = SIZES[spec.size ?? "medium"];
  // 동서로 지나는 길목은 가로로 넓게(단은 늘 남북으로 오른다)
  const sideways = sides.every((s) => s === "east" || s === "west");
  const width = sideways ? Math.round(h * 0.95) : w, height = sideways ? Math.max(30, w) : h;
  return { theme, sides, seed: lookHash(`route-seed|${key}|${spec.name}`) % 1_000_000, ...(feature ? { feature } : {}), width, height, warnings };
}

function build(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): PlaceBuildResult {
  const first = run.calls.length;
  const fail = (summary: string): PlaceBuildResult => ({ ok: false, mapIds: previous?.result.mapIds ?? [], summary, warnings: [], missingArt: [], calls: run.calls.slice(first) });
  const project0 = run.ctx.project;
  if (!project0.tilesets.beodeul_city) return fail("this project has no beodeul_city chipset — a route map cannot be built here.");
  const args = routeArgs(spec);
  let mapId = spec.mapId && project0.maps[spec.mapId] ? spec.mapId : previous?.result.mapIds[0];
  const again = !!mapId && !!project0.maps[mapId];
  if (!again) {
    // 빈 시작 맵은 쓰지 않는다(크기가 다르다) — 새 맵을 만든다.
    const made = run.call("create_map", { name: spec.name, width: args.width, height: args.height, tilesetId: "beodeul_city" });
    mapId = (made.data as { mapId?: string } | undefined)?.mapId;
    if (!made.ok || !mapId) return fail(`create_map: ${String(made.summary ?? "").slice(0, 200)}`);
  }
  const res = run.call("author_wild_route", { mapId, theme: args.theme, sides: args.sides, seed: args.seed, ...(args.feature ? { feature: args.feature } : {}), ...(again ? { replace: true } : {}) });
  if (!res.ok) {
    if (!again && run.ctx.project.maps[mapId!] && isUntouchedMap(run.ctx.project.maps[mapId!]!)) run.call("remove_map", { mapId });
    return fail(`route «${spec.name}» could not be built: ${String(res.summary ?? "").slice(0, 240)}`);
  }
  const data = (res.data ?? {}) as { variant?: string; layout?: string; hero?: string; heroName?: string; mood?: string | null; entry?: Cell; exit?: Cell; heroAt?: unknown; heroFront?: Cell | null; side?: string; sideAt?: Cell | null; enemySpots?: Cell[] };
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
    summary: `${spec.name}: ${args.theme} route ${map.width}×${map.height} (${mapId}, ${data.variant ?? "?"}) — landmark «${data.heroName ?? "?"}»${data.heroFront ? ` at heroFront (${data.heroFront.x},${data.heroFront.y})` : " (not placed)"}`
      + `${data.sideAt ? `, side nook ${data.side} (${data.sideAt.x},${data.sideAt.y})` : ""}, enemySpots ${(data.enemySpots ?? []).map((c) => `(${c.x},${c.y})`).join(" ") || "-"}, road ${args.sides[0]} (${entry.x},${entry.y}) → ${args.sides[1]}${data.exit ? ` (${data.exit.x},${data.exit.y})` : ""}`,
    warnings: [...args.warnings, ...(res.warnings ?? []).map(String)],
    missingArt: [],
    calls: run.calls.slice(first),
    state: { tilesetId: "beodeul_city", theme: args.theme, variant: data.variant, layout: data.layout, hero: data.hero, side: data.side, entry, exit: data.exit, heroAt: data.heroAt, heroFront: data.heroFront ?? undefined, sideAt: data.sideAt ?? undefined, enemySpots: data.enemySpots ?? [], freeSpots: free, start: entry },
  };
}

export const ROUTE_BUILDER: PlaceBuilder = {
  id: "route",
  accepts: (spec) => spec.type === "route",
  build,
};
