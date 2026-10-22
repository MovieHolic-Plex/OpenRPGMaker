// compose_wasteland_map — 폐허·황무지(wasteland_ruins) 맵 한 장을 종류와 씨앗으로 짠다(2026-10-22 마을 종류 표 post-apoc-kit).
// 견본을 붙이지 않는다: 길·무너진 건물·거주지 울·판잣집·차 배치를 규칙으로 엮는다(src/project/wastelandComposer.ts).
import { compactMapLayers } from "@/project/mapLayers";
import { composeWastelandMap, labelWastelandAreas, WASTELAND_DEFAULT_SIZE, WASTELAND_KIND_KO, WASTELAND_KINDS, WASTELAND_MIN_SIZE, type WastelandKind } from "@/project/wastelandComposer";
import { isWastelandRuinsTileset, WASTELAND_RUINS_FAMILY, WASTELAND_RUINS_ID } from "@/project/defaults/wastelandRuins";
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { claimStartIfBlank } from "./composerStart";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

function isUntouched(map: GameMap): boolean {
  return map.lowerTiles.every((t) => t === map.lowerTiles[0]) && map.upperTiles.every((t) => t === -1);
}

const sizes = (table: Readonly<Record<WastelandKind, { w: number; h: number }>>) => WASTELAND_KINDS.map((k) => `${k} ${table[k].w}×${table[k].h}`).join(", ");

export const COMPOSE_WASTELAND_MAP_TOOL: ToolDefinition = {
  name: "compose_wasteland_map",
  mode: "write",
  domains: ["tile", "map"],
  fillsCurrentMapId: true,
  description: "폐허·황무지 칩셋(wasteland_ruins) 맵 한 장을 종류째 짠다 — 씨앗마다 다른 배치. "
    + "kind: settlement(포스트아포칼립스 생존자 정착지: 갈라진 큰길 십자·북쪽 무너진 건물 줄·바리케이드와 고철 울로 두른 거주지(판잣집·모닥불 광장·고물 장터·급수탑·발전기·망루)·폐차장) | "
    + "ruined-city(좀비 폐허 도시: 바둑판 도로·블록마다 무너진 건물·무너진 벽·잔해·덩굴, 도로에 녹슨 차·버스·불탄 차·꺾인 가로등 — 사람 사는 흔적 없음) | "
    + "shanty(황무지 판잣집 정착촌: 흙먼지 땅·끊긴 옛 도로·고철 울 안 판잣집 골목·고철 더미·급수탑·태양판·모닥불). "
    + `맵 크기 하한 ${sizes(WASTELAND_MIN_SIZE)} (권장 ${sizes(WASTELAND_DEFAULT_SIZE)}). `
    + "손댄 맵은 replace:true 여야 다시 짠다(이벤트는 남긴다). 결과 이름표(list_map_locations)에 판잣집·건물 문 좌표가 있다. 이 배치는 완성이다 — 잔해·차를 더 흩뿌리지 않는다.",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "대상 맵 id(생략하면 지금 보는 맵). 칩셋이 wasteland_ruins 이어야 한다" },
      kind: { type: "string", enum: [...WASTELAND_KINDS], description: "맵 종류" },
      seed: { type: "integer", minimum: 0, description: "씨앗 — 다른 값이면 다른 배치. 생략하면 0" },
      replace: { type: "boolean", description: "이미 칠한 맵을 지우고 다시 짠다" },
    },
    required: ["kind"],
    additionalProperties: false,
  },
  invalidArgsExample: { kind: "settlement", seed: 3 },
  run(draft: Project, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — 짤 wasteland_ruins 맵 id 를 준다", { code: "map-not-found" });
    const map = requireMap(draft, mapId);
    const tileset = draft.tilesets[map.tilesetId];
    if (!tileset || !isWastelandRuinsTileset(tileset)) {
      throw new ToolError(`맵 '${map.name}'(${mapId}) 의 칩셋 '${map.tilesetId}' 은 폐허·황무지 칩셋(${WASTELAND_RUINS_ID}, 계열 ${WASTELAND_RUINS_FAMILY})이 아니다 — create_map({tilesetId:"${WASTELAND_RUINS_ID}"}) 로 새 맵을 만든다.`, { code: "wrong-tileset", mapId });
    }
    const kind = (WASTELAND_KINDS as readonly string[]).includes(String(args.kind)) ? (args.kind as WastelandKind) : null;
    if (!kind) throw new ToolError(`kind 는 ${WASTELAND_KINDS.join("|")} 중 하나다`, { code: "invalid-args" });
    const min = WASTELAND_MIN_SIZE[kind];
    if (map.width < min.w || map.height < min.h) {
      const rec = WASTELAND_DEFAULT_SIZE[kind];
      throw new ToolError(`맵이 작다(${map.width}×${map.height}) — ${WASTELAND_KIND_KO[kind]} 은 ${min.w}×${min.h} 이상이 필요하다. resize_map 으로 ${rec.w}×${rec.h} 로 키운 뒤 부른다`, { code: "map-too-small", mapId });
    }
    if (!isUntouched(map) && args.replace !== true) throw new ToolError("이미 칠한 맵이다 — 지우고 다시 짜려면 replace:true 를 준다(이벤트는 남는다)", { code: "map-not-blank", mapId });
    const seed = typeof args.seed === "number" && Number.isInteger(args.seed) && args.seed >= 0 ? args.seed : 0;

    const next = structuredClone(map);
    const result = composeWastelandMap(next, tileset, kind, seed);
    if (result.placed.length < 8) throw new ToolError(`맵을 짜지 못했다 — 기물 ${result.placed.length}개만 놓였다. 맵을 더 크게 하거나 다른 seed 를 준다`, { code: "compose-failed", mapId });
    compactMapLayers(next);
    const labels = labelWastelandAreas(next, result.areas);
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
    const startClaim = claimStartIfBlank(draft, mapId, result.spawn);
    return {
      summary: `${result.summary}. 구역·건물: ${labels.join(" · ")}. 출발 칸 (${result.spawn.x},${result.spawn.y}).`
        + (moved.length ? ` 막힌 칸의 이벤트를 옮겼다: ${moved.join(", ")}.` : "") + startClaim.note
        + " 이 배치는 완성이다 — 잔해·차·기물을 더 흩뿌리지 말고, 길·문 앞에 찍지 않는다. 다음: show_map_region 으로 보고, 문 앞 접근칸에 이동 이벤트·NPC 를 둔다.",
      data: { mapId, kind, seed, areas: result.areas, spawn: result.spawn, placed: result.placed.length, skipped: result.skipped },
    };
  },
};

export const WASTELAND_TOOLS: readonly ToolDefinition[] = [COMPOSE_WASTELAND_MAP_TOOL];
