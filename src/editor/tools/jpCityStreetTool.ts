// compose_jp_city_street — 일본 도시(jp_city) 맵 한 장을 씨앗과 가게 목록으로 거리째 짠다.
// 견본을 붙이는 것이 아니라 부품 사전·거리 칸·소품을 규칙으로 엮는다(src/project/jpCityStreetComposer.ts). 같은 인자는 같은 거리, 씨앗이 다르면 다른 거리.
import { isJpCityTileset, JP_CITY_FAMILY, JP_CITY_ID } from "@/project/defaults/jpCity";
import { blankFillTileFor } from "@/project/defaults/defaultMaps";
import { labelStreetBuildings, planJpCityStreet, runJpStreetPlan, type JpStreetStyle } from "@/project/jpCityStreetComposer";
import { fillLotUses } from "@/project/jpCityLotUse";
import { setLayerTileAt } from "@/project/mapLayers";
import { clearTileStack } from "@/project/mapOverlayTiles";
import type { GameMap, Project } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

// toolRegistry 가 이 파일을 (jpCityTools 를 거쳐) 불러오므로 레지스트리를 직접 import 하면 순환이다 — 레지스트리가 만들어진 뒤 조회 함수를 꽂는다.
let lookup: (name: string) => ToolDefinition | undefined = () => undefined;
export function bindStreetToolLookup(fn: (name: string) => ToolDefinition | undefined): void { lookup = fn; }

function isUntouched(map: GameMap): boolean {
  return map.lowerTiles.every((t) => t === map.lowerTiles[0]) && map.upperTiles.every((t) => t === -1);
}

export const COMPOSE_JP_CITY_STREET_TOOL: ToolDefinition = {
  name: "compose_jp_city_street",
  mode: "write",
  domains: ["tile", "map"],
  fillsCurrentMapId: true,
  description: "일본 도시(jp_city) 맵 한 장을 거리째 짠다 — 뒷줄 건물·보도·도로(횡단보도·차)·앞줄 건물·가로등·자판기·자전거·노보리를 규칙으로 배치한다. 견본을 붙이는 게 아니라 씨앗마다 다른 거리가 나온다. "
    + "shops 에 기획의 가게를 넣으면 그 가게가 먼저 건물이 된다(konbini·izakaya·ramen·cafe·shop·office·apartment·house·machiya·garage·sento·bento). style: shopping(상가 거리) | residential(주택가). "
    + "맵은 40×28 이상이어야 한다. 손댄 맵은 replace:true 여야 다시 짠다(땅·건물·소품을 지우고, 이벤트는 그대로 둔다 — 건물이 막는 칸 위 이벤트는 옮긴다). 짠 뒤 build_jp_city_building 으로 건물을 고치거나 link_jp_city_interior 로 문마다 실내를 잇는다.",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "대상 맵 id(생략하면 지금 보는 맵). 칩셋이 jp_city 여야 한다" },
      seed: { type: "integer", minimum: 0, description: "거리 씨앗 — 다른 값이면 다른 거리. 생략하면 0" },
      style: { type: "string", enum: ["shopping", "residential"] },
      shops: { type: "array", items: { type: "string", enum: ["konbini", "izakaya", "ramen", "cafe", "shop", "office", "apartment", "house", "machiya", "garage", "sento", "bento"] }, description: "거리에 꼭 넣을 가게(앞에서부터 건물에 배정)" },
      replace: { type: "boolean", description: "이미 칠한 맵을 지우고 다시 짠다" },
      lotsOnly: { type: "boolean", description: "다시 짜지 않고 이미 지은 jp_city 맵의 남은 빈 대지만 쓰임(코인 주차·골목 자판기·놀이터·텃밭·공사장·광장 꾸밈)으로 채운다 — 건물을 손으로 더하거나 옮긴 뒤 부른다" },
    },
    additionalProperties: false,
  },
  invalidArgsExample: { seed: 3, style: "shopping", shops: ["konbini", "cafe"] },
  run(draft: Project, args): ToolExecResult {
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
    const style: JpStreetStyle = args.style === "residential" ? "residential" : "shopping";
    const shops = Array.isArray(args.shops) ? args.shops.filter((s): s is string => typeof s === "string") : [];
    const seed = typeof args.seed === "number" && Number.isInteger(args.seed) ? args.seed : 0;

    // 복제본에서 짠 뒤 성공하면 반영한다 — 중간 실패로 반쯤 지운 맵이 남지 않게.
    const next = structuredClone(draft);
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
    built.locations = (built.locations ?? []).filter((l) => !(l.tags ?? []).includes("jp-building"));    // 다시 짜면 옛 건물 위치 이름표는 지운다
    const labels = labelStreetBuildings(built, outcome.buildings);
    draft.maps[mapId] = built;
    for (const [id, ts] of Object.entries(next.tilesets)) draft.tilesets[id] = ts;
    return {
      summary: `${plan.summary} — 건물 ${outcome.built}채(못 지은 자리 ${outcome.skipped}) · 소품 ${outcome.props}개, 빈터 쓰임 ${outcome.lotUses.length}곳(${[...new Set(outcome.lotUses.map((u) => u.use))].join("·") || "없음"}). 건물 문: ${labels.join(" · ")}. 문마다 가게에 맞는 실내를 link_jp_city_interior 로 잇는다(건물 이름표는 list_map_locations).`,
      data: { mapId, seed, style, shopsBuilt: labels, built: outcome.built, skipped: outcome.skipped, props: outcome.props, walkRows: plan.walkRows },
    };
  },
};
