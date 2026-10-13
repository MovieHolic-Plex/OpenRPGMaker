// compose_sf_station_map — SF 정거장·네온 거리(sf_station) 맵 한 장을 종류와 씨앗으로 짠다.
// 견본을 붙이지 않는다: 방·건물 줄·도로·기물 배치를 규칙으로 엮는다(src/project/sfStationComposer.ts). 같은 인자는 같은 맵, 씨앗이 다르면 다른 맵.
import { compactMapLayers } from "@/project/mapLayers";
import { composeSfStationMap, labelSfAreas, SF_DEFAULT_SIZE, SF_MAP_KINDS, SF_MIN_SIZE, type SfMapKind } from "@/project/sfStationComposer";
import { isSfStationTileset, SF_STATION_FAMILY, SF_STATION_ID } from "@/project/defaults/sfStation";
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

function isUntouched(map: GameMap): boolean {
  return map.lowerTiles.every((t) => t === map.lowerTiles[0]) && map.upperTiles.every((t) => t === -1);
}

const KIND_KO: Readonly<Record<SfMapKind, string>> = { station: "정거장 로비·거주구", lab: "연구 기지 실내", street: "사이버 네온 거리", moonbase: "달 기지 야외" };

export const COMPOSE_SF_STATION_MAP_TOOL: ToolDefinition = {
  name: "compose_sf_station_map",
  mode: "write",
  domains: ["tile", "map"],
  fillsCurrentMapId: true,
  description: "SF 칩셋(sf_station) 맵 한 장을 종류째 짠다 — 견본이 아니라 씨앗마다 다른 배치가 나온다. "
    + "kind: station(우주 정거장 로비+복도+거주구 선실·식당·위생실) | lab(연구 기지 실내: 실험실+복도+의무실·냉동 수면실·서버실·수경 재배실) | "
    + "street(사이버펑크 네온 거리: 고층 네온 빌딩 줄·보도·4줄 도로·횡단보도·호버카·광장 노점·키오스크·광고판·남쪽 가게 줄) | moonbase(달 기지 야외: 레골리스·다져진 길·돔·모듈·관제탑·착륙장·셔틀·로버·태양광). "
    + `맵 크기 하한: station ${SF_MIN_SIZE.station.w}×${SF_MIN_SIZE.station.h}, lab ${SF_MIN_SIZE.lab.w}×${SF_MIN_SIZE.lab.h}, street ${SF_MIN_SIZE.street.w}×${SF_MIN_SIZE.street.h}, moonbase ${SF_MIN_SIZE.moonbase.w}×${SF_MIN_SIZE.moonbase.h} `
    + `(권장 station ${SF_DEFAULT_SIZE.station.w}×${SF_DEFAULT_SIZE.station.h}, lab ${SF_DEFAULT_SIZE.lab.w}×${SF_DEFAULT_SIZE.lab.h}, street ${SF_DEFAULT_SIZE.street.w}×${SF_DEFAULT_SIZE.street.h}, moonbase ${SF_DEFAULT_SIZE.moonbase.w}×${SF_DEFAULT_SIZE.moonbase.h}). `
    + "손댄 맵은 replace:true 여야 다시 짠다(땅·벽·기물을 지우고 이벤트는 남긴다). 결과의 구역·건물 이름표(list_map_locations)에 문 좌표가 있다 — 문 앞 접근칸에 이동 이벤트를 단다.",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "대상 맵 id(생략하면 지금 보는 맵). 칩셋이 sf_station 이어야 한다" },
      kind: { type: "string", enum: [...SF_MAP_KINDS], description: "맵 종류" },
      seed: { type: "integer", minimum: 0, description: "씨앗 — 다른 값이면 다른 배치. 생략하면 0" },
      replace: { type: "boolean", description: "이미 칠한 맵을 지우고 다시 짠다" },
    },
    required: ["kind"],
    additionalProperties: false,
  },
  invalidArgsExample: { kind: "station", seed: 3 },
  run(draft: Project, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — 짤 sf_station 맵 id 를 준다", { code: "map-not-found" });
    const map = requireMap(draft, mapId);
    const tileset = draft.tilesets[map.tilesetId];
    if (!tileset || !isSfStationTileset(tileset)) {
      throw new ToolError(`맵 '${map.name}'(${mapId}) 의 칩셋 '${map.tilesetId}' 은 SF 칩셋(${SF_STATION_ID}, 계열 ${SF_STATION_FAMILY})이 아니다 — 이 도구는 sf_station 맵에서만 동작한다. create_map({tilesetId:"sf_station"}) 로 새 맵을 만든다.`, { code: "wrong-tileset", mapId });
    }
    const kind = (SF_MAP_KINDS as readonly string[]).includes(String(args.kind)) ? (args.kind as SfMapKind) : null;
    if (!kind) throw new ToolError(`kind 는 ${SF_MAP_KINDS.join("|")} 중 하나다`, { code: "invalid-args" });
    const min = SF_MIN_SIZE[kind];
    if (map.width < min.w || map.height < min.h) {
      const rec = SF_DEFAULT_SIZE[kind];
      throw new ToolError(`맵이 작다(${map.width}×${map.height}) — ${KIND_KO[kind]} 은 ${min.w}×${min.h} 이상이 필요하다. resize_map 으로 ${rec.w}×${rec.h} 로 키운 뒤 부른다`, { code: "map-too-small", mapId });
    }
    if (!isUntouched(map) && args.replace !== true) throw new ToolError("이미 칠한 맵이다 — 지우고 다시 짜려면 replace:true 를 준다(이벤트는 남는다)", { code: "map-not-blank", mapId });
    const seed = typeof args.seed === "number" && Number.isInteger(args.seed) && args.seed >= 0 ? args.seed : 0;

    // 복제본에서 짠 뒤 성공하면 반영한다 — 중간 실패로 반쯤 지운 맵이 남지 않게.
    const next = structuredClone(map);
    const result = composeSfStationMap(next, tileset, kind, seed);
    if (result.placed.length < 6) throw new ToolError(`맵을 짜지 못했다 — 기물 ${result.placed.length}개만 놓였다. 맵을 더 크게 하거나 다른 seed 를 준다`, { code: "compose-failed", mapId });
    compactMapLayers(next);
    const labels = labelSfAreas(next, result.areas);
    // 막힌 칸 위에 남은 이벤트 → 가장 가까운 통행 칸으로 옮긴다
    const moved: string[] = [];
    for (const ev of next.events ?? []) {
      if (isPassable(draft, next, ev.x, ev.y)) continue;
      let best: { x: number; y: number } | null = null; let bd = 1e9;
      for (let y = 0; y < next.height; y++) for (let x = 0; x < next.width; x++) {
        const d = Math.abs(x - ev.x) + Math.abs(y - ev.y);
        if (d < bd && isPassable(draft, next, x, y) && !(next.events ?? []).some((o) => o !== ev && o.x === x && o.y === y)) { bd = d; best = { x, y }; }
      }
      if (best) { moved.push(`${ev.name ?? ev.id} (${ev.x},${ev.y})→(${best.x},${best.y})`); ev.x = best.x; ev.y = best.y; }
    }
    draft.maps[mapId] = next;
    return {
      summary: `${result.summary}. 구역·건물: ${labels.join(" · ")}. 출발 칸 (${result.spawn.x},${result.spawn.y}).`
        + (moved.length ? ` 막힌 칸의 이벤트를 옮겼다: ${moved.join(", ")}.` : "")
        + " 이 배치는 완성이다 — 기물을 흩뿌려 채우지 말고, 도로·횡단보도·착륙장·복도·문 통로 위에는 찍지 않는다. 다음: show_map_region 으로 보고, 문 앞 접근칸에 기획의 이동 이벤트·NPC·단서를 둔다.",
      data: { mapId, kind, seed, areas: result.areas, spawn: result.spawn, placed: result.placed.length, skipped: result.skipped },
    };
  },
};

export const SF_STATION_TOOLS: readonly ToolDefinition[] = [COMPOSE_SF_STATION_MAP_TOOL];
