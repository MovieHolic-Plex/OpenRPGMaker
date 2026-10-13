// compose_pirate_isles_map — 열대 군도·해적 항구(pirate_isles) 맵 한 장을 종류와 씨앗으로 짠다.
// 견본을 붙이지 않는다: 섬·해안·건물 줄·부두·소품 배치를 규칙으로 엮는다(src/project/pirateIslesComposer.ts). 같은 인자는 같은 맵, 씨앗이 다르면 다른 맵.
import { compactMapLayers } from "@/project/mapLayers";
import { composePirateIslesMap, labelPirateAreas, PIRATE_DEFAULT_SIZE, PIRATE_MAP_KINDS, PIRATE_MIN_SIZE, type PirateMapKind } from "@/project/pirateIslesComposer";
import { isPirateIslesTileset, PIRATE_ISLES_FAMILY, PIRATE_ISLES_ID } from "@/project/defaults/pirateIsles";
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

function isUntouched(map: GameMap): boolean {
  return map.lowerTiles.every((t) => t === map.lowerTiles[0]) && map.upperTiles.every((t) => t === -1);
}

const KIND_KO: Readonly<Record<PirateMapKind, string>> = {
  harbor: "해적 항구 마을", beach: "열대 섬 해변 마을", fort: "해안 요새", wreck: "난파선·보물 동굴 섬", ship: "배 안", tavern: "해적 술집 안", hut: "섬 오두막 안", cave: "보물 동굴 안",
};
const sizes = (rec: typeof PIRATE_MIN_SIZE) => PIRATE_MAP_KINDS.map((k) => `${k} ${rec[k].w}×${rec[k].h}`).join(", ");

export const COMPOSE_PIRATE_ISLES_MAP_TOOL: ToolDefinition = {
  name: "compose_pirate_isles_map",
  mode: "write",
  domains: ["tile", "map"],
  fillsCurrentMapId: true,
  description: "해적 군도 칩셋(pirate_isles) 맵 한 장을 종류째 짠다 — 견본이 아니라 씨앗마다 다른 배치가 나온다(계획 → 섬·해안 → 건물(문 앞 길) → 소품, 놓을 때마다 통행 검사). "
    + "kind: harbor(해적 항구 마을: 바다·돌 방파제·판자 부두·정박한 배·해적 범선·술집·창고·시장 광장) | beach(열대 섬 해변 마을: 섬·모래 둘레·오두막·광장 모닥불·토템·물 위 수상 가옥·쪽배) | "
    + "fort(해안 요새: 성벽·포대 탑·남벽 문루·바다 겨눈 대포·안뜰 병영·망루 — 문루 문 앞 접근칸과 안뜰 안쪽 칸을 이동 이벤트로 잇는다) | wreck(난파선과 보물 동굴 섬) | ship(배 안: 선장실·선원 선실·주방·선창) | tavern(해적 술집 안) | hut(섬 오두막 안) | cave(보물 동굴 안). "
    + `맵 크기 하한: ${sizes(PIRATE_MIN_SIZE)} (권장 ${sizes(PIRATE_DEFAULT_SIZE)}). `
    + "손댄 맵은 replace:true 여야 다시 짠다(땅·기물을 지우고 이벤트는 남긴다). 결과의 건물·구역 이름표(list_map_locations)에 문 앞 접근칸 좌표가 있다 — 거기에 이동 이벤트를 단다.",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "대상 맵 id(생략하면 지금 보는 맵). 칩셋이 pirate_isles 여야 한다" },
      kind: { type: "string", enum: [...PIRATE_MAP_KINDS], description: "맵 종류" },
      seed: { type: "integer", minimum: 0, description: "씨앗 — 다른 값이면 다른 배치. 생략하면 0" },
      replace: { type: "boolean", description: "이미 칠한 맵을 지우고 다시 짠다" },
    },
    required: ["kind"],
    additionalProperties: false,
  },
  invalidArgsExample: { kind: "harbor", seed: 3 },
  run(draft: Project, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — 짤 pirate_isles 맵 id 를 준다", { code: "map-not-found" });
    const map = requireMap(draft, mapId);
    const tileset = draft.tilesets[map.tilesetId];
    if (!tileset || !isPirateIslesTileset(tileset)) {
      throw new ToolError(`맵 '${map.name}'(${mapId}) 의 칩셋 '${map.tilesetId}' 은 해적 군도 칩셋(${PIRATE_ISLES_ID}, 계열 ${PIRATE_ISLES_FAMILY})이 아니다 — 이 도구는 pirate_isles 맵에서만 동작한다. create_map({tilesetId:"pirate_isles"}) 로 새 맵을 만든다.`, { code: "wrong-tileset", mapId });
    }
    const kind = (PIRATE_MAP_KINDS as readonly string[]).includes(String(args.kind)) ? (args.kind as PirateMapKind) : null;
    if (!kind) throw new ToolError(`kind 는 ${PIRATE_MAP_KINDS.join("|")} 중 하나다`, { code: "invalid-args" });
    const min = PIRATE_MIN_SIZE[kind];
    if (map.width < min.w || map.height < min.h) {
      const rec = PIRATE_DEFAULT_SIZE[kind];
      throw new ToolError(`맵이 작다(${map.width}×${map.height}) — ${KIND_KO[kind]} 은 ${min.w}×${min.h} 이상이 필요하다. resize_map 으로 ${rec.w}×${rec.h} 로 키운 뒤 부른다`, { code: "map-too-small", mapId });
    }
    if (!isUntouched(map) && args.replace !== true) throw new ToolError("이미 칠한 맵이다 — 지우고 다시 짜려면 replace:true 를 준다(이벤트는 남는다)", { code: "map-not-blank", mapId });
    const seed = typeof args.seed === "number" && Number.isInteger(args.seed) && args.seed >= 0 ? args.seed : 0;

    const next = structuredClone(map);
    const result = composePirateIslesMap(next, tileset, kind, seed);
    if (result.placed.length < 4) throw new ToolError(`맵을 짜지 못했다 — 기물 ${result.placed.length}개만 놓였다. 맵을 더 크게 하거나 다른 seed 를 준다`, { code: "compose-failed", mapId });
    compactMapLayers(next);
    const labels = labelPirateAreas(next, result.areas);
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
    const rec = PIRATE_DEFAULT_SIZE[kind];
    const oversize = map.width > Math.round(rec.w * 1.12) || map.height > Math.round(rec.h * 1.12)
      ? ` 맵(${map.width}×${map.height})이 권장 ${rec.w}×${rec.h} 보다 커서 빈 땅이 늘었다 — 더 촘촘하게 하려면 resize_map 으로 ${rec.w}×${rec.h} 로 줄이고 replace:true 로 다시 짠다.` : "";
    return {
      summary: `${result.summary}. 건물·구역: ${labels.join(" · ")}. 출발 칸 (${result.spawn.x},${result.spawn.y}).`
        + (moved.length ? ` 막힌 칸의 이벤트를 옮겼다: ${moved.join(", ")}.` : "") + oversize
        + " 이 배치는 완성이다 — 기물을 흩뿌려 채우지 말고, 길·부두·방파제 가장자리·문 앞에는 찍지 않는다. 다음: show_map_region 으로 보고, 문 앞 접근칸에 기획의 이동 이벤트·NPC·단서를 둔다.",
      data: { mapId, kind, seed, areas: result.areas, spawn: result.spawn, placed: result.placed.length, skipped: result.skipped, unreachable: result.unreachable },
    };
  },
};

export const PIRATE_ISLES_TOOLS: readonly ToolDefinition[] = [COMPOSE_PIRATE_ISLES_MAP_TOOL];
