// compose_jp_city_street — 일본 도시(jp_city) 맵 한 장을 씨앗과 가게 목록으로 거리째 짠다.
// 견본을 붙이는 것이 아니라 부품 사전·거리 칸·소품을 규칙으로 엮는다(src/project/jpCityStreetComposer.ts). 같은 인자는 같은 거리, 씨앗이 다르면 다른 거리.
import { JP_REGIONS } from "@/editor/jpCity/japaneseRegionsCatalog";
import { isPassable } from "@/project/collision";
import { isJpCityTileset, JP_CITY_FAMILY, JP_CITY_ID } from "@/project/defaults/jpCity";
import { blankFillTileFor } from "@/project/defaults/defaultMaps";
import { labelStreetBuildings, planJpCityStreet, runJpStreetPlan, type JpStreetStyle } from "@/project/jpCityStreetComposer";
import { flavorAvailable } from "@/project/jpShitamachiStreet";
import { fillLotUses } from "@/project/jpCityLotUse";
import { setLayerTileAt } from "@/project/mapLayers";
import { clearTileStack } from "@/project/mapOverlayTiles";
import type { GameMap, Project } from "@/project/types";
import { inMainWalkComponent, mainWalkComponent } from "@/project/walkComponent";
import { claimStartIfBlank } from "./composerStart";
import { requireMap } from "./mapHelpers";
import { hasJpForestR4, paintJpForestArea } from "@/editor/jpCity/forestPainter";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

// toolRegistry 가 이 파일을 (jpCityTools 를 거쳐) 불러오므로 레지스트리를 직접 import 하면 순환이다 — 레지스트리가 만들어진 뒤 조회 함수를 꽂는다.
let lookup: (name: string) => ToolDefinition | undefined = () => undefined;
export function bindStreetToolLookup(fn: (name: string) => ToolDefinition | undefined): void { lookup = fn; }

function isUntouched(map: GameMap): boolean {
  return map.lowerTiles.every((t) => t === map.lowerTiles[0]) && map.upperTiles.every((t) => t === -1);
}

function pickStreetStartPos(project: Project, map: GameMap, walkRows: readonly number[]): { x: number; y: number } {
  if (project.startMapId === map.id && isPassable(project, map, project.startPos.x, project.startPos.y)) {
    return project.startPos;
  }
  const cx = Math.floor(map.width / 2), cy = Math.floor(map.height / 2);
  for (const y of walkRows) {
    if (y < 0 || y >= map.height) continue;
    for (let d = 0; d < map.width; d++) {
      for (const x of [cx + d, cx - d]) {
        if (x >= 0 && x < map.width && isPassable(project, map, x, y)) return { x, y };
      }
    }
  }
  for (let r = 0; r < Math.max(map.width, map.height); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && x < map.width && y >= 0 && y < map.height && isPassable(project, map, x, y)) return { x, y };
      }
    }
  }
  return { x: cx, y: cy };
}

export const COMPOSE_JP_CITY_STREET_TOOL: ToolDefinition = {
  name: "compose_jp_city_street",
  mode: "write",
  domains: ["tile", "map"],
  fillsCurrentMapId: true,
  description: "일본 도시(jp_city) 맵 한 장을 거리째 짠다 — 뒷줄 건물·보도·도로(횡단보도·차)·앞줄 건물·가로등·자판기·자전거·노보리를 규칙으로 배치한다. 견본을 붙이는 게 아니라 씨앗마다 다른 거리가 나온다. "
    + "shops 에 기획의 가게를 넣으면 그 가게가 먼저 건물이 된다(konbini·izakaya·ramen·cafe·shop·office·apartment·house·machiya·garage·sento·bento). style: shopping(상가 거리) | residential(주택가). "
    + "맵은 40×28 이상이어야 한다. 손댄 맵은 replace:true 여야 다시 짠다(땅·건물·소품을 지우고, 이벤트는 그대로 둔다 — 건물이 막는 칸 위 이벤트는 옮긴다). 짠 뒤 build_jp_city_building 으로 건물을 고치거나 link_jp_city_interior 로 문마다 실내를 잇는다. "
    + "상가가 아닌 일본 장소(학교·단치·건널목·신사·사찰·성·등산로·계곡·온천 마을·다랑논·항구·해변·무인역 등 30종)는 region 에 list_jp_regions 의 id 를 준다(compose_jp_region 과 같다).",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "대상 맵 id(생략하면 지금 보는 맵). 칩셋이 jp_city 여야 한다" },
      seed: { type: "integer", minimum: 0, description: "거리 씨앗 — 다른 값이면 다른 거리. 생략하면 0" },
      style: { type: "string", enum: ["shopping", "residential", "shitamachi", "shotengai"], description: "shopping 상가 · residential 주택가 · shitamachi 시타마치 골목(청과 가게·벽돌 술집·자판기 골목·옥상 안테나·골목 계단·콘크리트 판석 보도) · shotengai 쇼텐가이 아케이드 상가(붉은 차양 아케이드·大門通 아치·코인 주차·변압기 전신주)" },
      shops: { type: "array", items: { type: "string", enum: ["konbini", "izakaya", "ramen", "cafe", "shop", "office", "apartment", "house", "machiya", "garage", "sento", "bento"] }, description: "거리에 꼭 넣을 가게(앞에서부터 건물에 배정)" },
      replace: { type: "boolean", description: "이미 칠한 맵을 지우고 다시 짠다" },
      region: { type: "string", enum: JP_REGIONS.map((r) => r.id), description: "일본 지역 30종 id(list_jp_regions) — 주면 style·shops 대신 그 지역 문법으로 짓는다" },
      parkForest: { type: "string", enum: ["grove", "dense", "none"], description: "공원 구획 뒤쪽 잔디에 숲 — grove 덩이 숲(기본) · dense 빽빽한 숲 · none 숲 없음(나무 키트 몇 그루만)" },
      grounding: { type: "boolean", description: "옛 인자 — 무시한다. 숲 나무 밑 땅 그늘(접지)은 늘 켜진다" },
      lotsOnly: { type: "boolean", description: "다시 짜지 않고 이미 지은 jp_city 맵의 남은 빈 대지만 쓰임(코인 주차·골목 자판기·놀이터·텃밭·공사장·광장 꾸밈)으로 채운다 — 건물을 손으로 더하거나 옮긴 뒤 부른다" },
    },
    additionalProperties: false,
  },
  invalidArgsExample: { seed: 3, style: "shopping", shops: ["konbini", "cafe"] },
  run(draft: Project, args): ToolExecResult {
    if (typeof args.region === "string" && args.region) {
      const tool = lookup("compose_jp_region");
      if (!tool) throw new ToolError("도구 compose_jp_region 이 없다", { code: "unknown-tool" });
      return tool.run(draft, { region: args.region, ...(typeof args.mapId === "string" ? { mapId: args.mapId } : {}), ...(typeof args.seed === "number" ? { seed: args.seed } : {}), ...(args.replace === true ? { replace: true } : {}), ...(args.grounding === false ? { grounding: false } : {}) });
    }
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — 거리를 짤 jp_city 맵 id 를 준다", { code: "map-not-found" });
    const map = requireMap(draft, mapId);
    const tileset = draft.tilesets[map.tilesetId];
    if (!tileset || !isJpCityTileset(tileset)) {
      throw new ToolError(`맵 '${map.name}'(${mapId}) 의 칩셋 '${map.tilesetId}' 은 일본 도시(${JP_CITY_ID}, 계열 ${JP_CITY_FAMILY})가 아니다 — 이 도구는 jp_city 맵에서만 동작한다.`, { code: "wrong-tileset", mapId });
    }
    if (args.lotsOnly === true) {
      const style0: JpStreetStyle = args.style === "residential" ? "residential" : "shopping";
      const work = structuredClone(draft);                              // 복제본에서 채우고 끝나면 반영(중간 실패로 반쯤 채운 맵이 남지 않게)
      const lot = fillLotUses({ mapId, seed: typeof args.seed === "number" ? args.seed : 0, style: style0, view: () => ({ map: work.maps[mapId]!, tileset: work.tilesets[work.maps[mapId]!.tilesetId]! }), call: (name, a) => {
        const tool = lookup(name);
        if (!tool) throw new ToolError(`도구 ${name} 이 없다`, { code: "unknown-tool" });
        return tool.run(work, a).data;
      } });
      draft.maps[mapId] = work.maps[mapId]!;
      for (const [id, ts] of Object.entries(work.tilesets)) draft.tilesets[id] = ts;
      const kinds = [...new Set(lot.uses.map((u) => u.use))].join("·") || "없음";
      return {
        summary: `빈터 쓰임 ${lot.uses.length}곳(${kinds}) · 소품 ${lot.props}개 — 소품 없는 대지 ${(lot.emptyBefore * 100).toFixed(0)}% → ${(lot.emptyAfter * 100).toFixed(0)}%. show_map_region 으로 확인한다.`,
        data: { mapId, uses: lot.uses, props: lot.props, emptyBefore: lot.emptyBefore, emptyAfter: lot.emptyAfter },
      };
    }
    if (map.width < 40 || map.height < 28) throw new ToolError(`맵이 작다(${map.width}×${map.height}) — 40×28 이상으로 resize_map 한 뒤 부른다`, { code: "map-too-small", mapId });
    if (!isUntouched(map) && args.replace !== true) throw new ToolError("이미 칠한 맵이다 — 지우고 다시 짜려면 replace:true 를 준다(이벤트는 남는다)", { code: "map-not-blank", mapId });
    const asked: JpStreetStyle = args.style === "residential" || args.style === "shitamachi" || args.style === "shotengai" ? args.style : "shopping";
    const style: JpStreetStyle = (asked === "shitamachi" || asked === "shotengai") && !flavorAvailable(tileset, asked) ? "shopping" : asked;
    const warnings = style !== asked ? [`이 칩셋에 ${asked} 키트가 아직 구워지지 않아 기본 상가 거리(shopping)로 짰다`] : [];
    const shops = Array.isArray(args.shops) ? args.shops.filter((s): s is string => typeof s === "string") : [];
    const seed = typeof args.seed === "number" && Number.isInteger(args.seed) ? args.seed : 0;

    // 복제본에서 짠 뒤 성공하면 반영한다 — 중간 실패로 반쯤 지운 맵이 남지 않게.
    const next: Project = { ...draft, maps: { ...draft.maps, [mapId]: structuredClone(map) }, tilesets: { ...draft.tilesets, [map.tilesetId]: structuredClone(draft.tilesets[map.tilesetId]!) } };
    const target = next.maps[mapId]!;
    target.lowerTiles.fill(blankFillTileFor(JP_CITY_ID, 0, next.tilesets[map.tilesetId]!));
    for (let i = 0; i < target.lowerTiles.length; i++) { setLayerTileAt(target, 3, i, -1); setLayerTileAt(target, 4, i, -1); clearTileStack(target, "upper", i); }
    const plan = planJpCityStreet({ mapId, width: target.width, height: target.height, seed, style, shops });
    const outcome = runJpStreetPlan(plan, (name, a) => {
      const tool = lookup(name);
      if (!tool) throw new ToolError(`도구 ${name} 이 없다`, { code: "unknown-tool" });
      const res = tool.run(next, a);
      return (res.data ?? undefined) as { rect?: { x0: number; y0: number; w: number; h: number }; doors?: { x: number; y: number }[] } | undefined;
    }, () => ({ map: next.maps[mapId]!, tileset: next.tilesets[map.tilesetId]! }));
    if (outcome.built < 4) throw new ToolError(`거리를 짜지 못했다 — 건물 ${outcome.built}채만 지어졌다. 맵을 더 크게 하거나 다른 seed 를 준다`, { code: "compose-failed", mapId });
    const built = next.maps[mapId]!;
    // 공원 숲: 공원 구획 뒤쪽(북쪽) 절반 남짓 잔디에 나무 composer 숲(입구 판석·연못·벤치·나무 키트 칸은 건너뛴다).
    let parkForestCells = 0;
    const parkForest = args.parkForest === "dense" || args.parkForest === "none" ? args.parkForest : "grove";
    if (parkForest !== "none" && plan.parks?.length && hasJpForestR4(next.tilesets[map.tilesetId]!)) {
      const want = new Uint8Array(built.width * built.height);
      for (const p of plan.parks) {
        const rows = Math.max(4, Math.ceil(p.h * 0.55));
        for (let y = Math.max(0, p.y); y < Math.min(built.height, p.y + rows); y++) for (let x = Math.max(0, p.x); x < Math.min(built.width, p.x + p.w); x++) want[y * built.width + x] = 1;
      }
      parkForestCells = paintJpForestArea(built, next.tilesets[map.tilesetId]!, want, { forestType: parkForest, grounding: args.grounding !== false, seed })?.floorCells ?? 0;
    }
    built.locations = (built.locations ?? []).filter((l) => !(l.tags ?? []).includes("jp-building"));    // 다시 짜면 옛 건물 위치 이름표는 지운다
    const labels = labelStreetBuildings(built, outcome.buildings);
    // 문 앞이 큰길에서 걸어서 닿지 않는 건물(맵 끝 뒷골목에 갇힌 남쪽 줄 등)은 이름표에 적고 경고한다 — link_jp_city_interior 가 거부한다.
    const walk = mainWalkComponent(next, built);
    const deadDoors: string[] = [];
    for (const loc of built.locations ?? []) {
      if (!(loc.tags ?? []).includes("jp-building")) continue;
      const m = /문 앞 접근칸 \((\d+),(\d+)\)/u.exec(loc.note ?? "");
      if (!m || inMainWalkComponent(walk, built, { x: Number(m[1]), y: Number(m[2]) })) continue;
      loc.note = `${loc.note} · 문 앞이 큰길에서 걸어서 닿지 않음 — 실내를 잇지 말 것`;
      deadDoors.push(`${loc.name} (${m[1]},${Number(m[2]) - 1})`);
    }
    if (deadDoors.length) warnings.push(`큰길에서 걸어서 닿지 않는 건물 문 ${deadDoors.length}곳: ${deadDoors.join(" · ")} — 이 문에는 실내를 잇지 않는다(다른 문을 쓰거나 seed 를 바꾼다)`);
    draft.maps[mapId] = built;
    for (const [id, ts] of Object.entries(next.tilesets)) draft.tilesets[id] = ts;
    const startNote = claimStartIfBlank(draft, mapId, pickStreetStartPos(draft, built, plan.walkRows)).note;
    return {
      summary: `${plan.summary} — 건물 ${outcome.built}채(못 지은 자리 ${outcome.skipped}) · 소품 ${outcome.props}개, 빈터 쓰임 ${outcome.lotUses.length}곳(${[...new Set(outcome.lotUses.map((u) => u.use))].join("·") || "없음"})${parkForestCells ? `, 공원 숲 ${parkForestCells}칸` : ""}. 건물 문: ${labels.join(" · ")}. 문마다 가게에 맞는 실내를 link_jp_city_interior 로 잇는다(건물 이름표는 list_map_locations).${startNote}`,
      data: { mapId, seed, style, parkForestCells, shopsBuilt: labels, built: outcome.built, skipped: outcome.skipped, props: outcome.props, walkRows: plan.walkRows },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};
