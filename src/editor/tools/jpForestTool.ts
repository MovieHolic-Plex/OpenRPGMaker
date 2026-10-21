// paint_jp_forest — jp_city 맵의 잔디 땅에 나무 composer 숲(jp_forest_r4 활엽)을 칠한다.
// 숲 바닥(1층)만 깔고 나무·접지 그늘은 composer 가 칸마다 정한다(편집기 붓·compose_jp_region 과 같은 규칙, src/project/defaults/treeComposer.ts).
// 조수가 나무 키트를 낱개로 흩뿌리거나 수관 칸을 번호로 찍지 않게 하는 입구다.
import { isJpCityTileset, JP_CITY_FAMILY, JP_CITY_ID } from "@/project/defaults/jpCity";
import { hasJpForestR4, JP_FOREST_TYPES, paintJpForestArea, type JpForestType } from "@/editor/jpCity/forestPainter";
import type { Project } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type Rect = { x: number; y: number; w: number; h: number };
const SIDES = ["north", "south", "east", "west", "around"] as const;
type Side = (typeof SIDES)[number];

function intOf(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : undefined;
}
function rectOf(v: unknown): Rect | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const x = intOf(o.x), y = intOf(o.y), w = intOf(o.w), h = intOf(o.h);
  return x === undefined || y === undefined || w === undefined || h === undefined || w <= 0 || h <= 0 ? undefined : { x, y, w, h };
}

/** 기준 사각형(신사 경내·공원 등) 옆 띠. around 는 네 변 모두. */
function besideCells(W: number, H: number, ref: Rect, side: Side, depth: number, want: Uint8Array): void {
  const put = (r: Rect) => {
    for (let y = Math.max(0, r.y); y < Math.min(H, r.y + r.h); y++) for (let x = Math.max(0, r.x); x < Math.min(W, r.x + r.w); x++) want[y * W + x] = 1;
  };
  const d = depth;
  if (side === "north" || side === "around") put({ x: ref.x - (side === "around" ? d : 0), y: ref.y - d, w: ref.w + (side === "around" ? 2 * d : 0), h: d });
  if (side === "south" || side === "around") put({ x: ref.x - (side === "around" ? d : 0), y: ref.y + ref.h, w: ref.w + (side === "around" ? 2 * d : 0), h: d });
  if (side === "west" || side === "around") put({ x: ref.x - d, y: ref.y, w: d, h: ref.h });
  if (side === "east" || side === "around") put({ x: ref.x + ref.w, y: ref.y, w: d, h: ref.h });
}

export const PAINT_JP_FOREST_TOOL: ToolDefinition = {
  name: "paint_jp_forest",
  mode: "write",
  domains: ["tile", "map"],
  fillsCurrentMapId: true,
  description: "jp_city 맵의 잔디 땅에 숲을 칠한다(신사 옆 진수의 숲·공원 숲·산자락·집 뒤 숲). 숲 바닥만 깔면 나무(3~4칸 활엽, 겹친 수관)와 나무 밑 그늘을 칸마다 규칙으로 세운다 — "
    + "나무 키트(jp-prop-tree-*)를 여러 번 stamp 하거나 수관 칸을 번호로 칠하지 않는다. 잔디·자갈잔디 칸만 숲이 되고 길·물·건물·소품 칸은 건너뛴다(수관도 그 위로 넘치지 않는다). "
    + "자리: rect(숲 사각형) 또는 beside({x,y,w,h, side, depth}) — 기준 사각형(신사 경내·공원·건물) 옆 띠, 또는 besideLocation(맵 위치 이름표 id·이름) + side·depth. "
    + "forestType: dense(기본, 빽빽한 숲 — 신사 숲·산비탈·경계 숲) | grove(공원 숲 — 덩이 숲 사이에 잔디 빈터를 남긴다). "
    + "rect·beside 는 숲을 원하는 잔디 구역만 준다 — 맵 전체를 주면 모든 잔디 조각(집 뒤 틈·길섶)에 숲이 흩어진다. 숲은 4×4 칸 이상 권장(2칸 띠는 한 줄 가로수처럼 보이고, 1칸 틈은 칠하지 않는다). 같은 자리를 다시 불러도 같은 숲이 나온다(grove 덩이 모양만 seed 로 바꾼다). 지금 수종은 활엽 하나다.",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string", description: "대상 맵 id(생략하면 지금 보는 맵). 칩셋이 jp_city 여야 한다" },
      rect: {
        type: "object",
        description: "숲을 칠할 사각형(칸 좌표)",
        properties: { x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer", minimum: 1 }, h: { type: "integer", minimum: 1 } },
        required: ["x", "y", "w", "h"],
        additionalProperties: false,
      },
      beside: {
        type: "object",
        description: "기준 사각형 옆에 숲 띠를 두른다 — 신사 경내 사각형을 주고 side:\"around\" 면 진수의 숲",
        properties: {
          x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer", minimum: 1 }, h: { type: "integer", minimum: 1 },
          side: { type: "string", enum: [...SIDES], description: "north 뒤(위) · south 앞(아래) · east · west · around 네 변" },
          depth: { type: "integer", minimum: 3, maximum: 20, description: "띠 두께 칸 수(기본 6)" },
        },
        required: ["x", "y", "w", "h"],
        additionalProperties: false,
      },
      besideLocation: { type: "string", description: "맵 위치 이름표(list_map_locations)의 id 또는 이름 — 그 사각형 옆에 숲을 두른다(side·depth 와 함께)" },
      side: { type: "string", enum: [...SIDES], description: "besideLocation 과 쓸 때 방향(기본 north)" },
      depth: { type: "integer", minimum: 3, maximum: 20, description: "besideLocation 과 쓸 때 띠 두께(기본 6)" },
      forestType: { type: "string", enum: [...JP_FOREST_TYPES], description: "dense 빽빽한 숲(기본) | grove 공원 숲(덩이 사이 잔디 빈터)" },
      grounding: { type: "boolean", description: "옛 인자 — 무시한다. 나무 밑 땅 그늘(접지)은 늘 켜진다" },
      seed: { type: "integer", minimum: 0, description: "grove 덩이 모양 씨앗(기본 0). 나무 배치는 자리로 정해진다" },
    },
    additionalProperties: false,
  },
  invalidArgsExample: { beside: { x: 20, y: 8, w: 12, h: 10, side: "around", depth: 6 }, forestType: "dense" },
  run(draft: Project, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — 숲을 칠할 jp_city 맵 id 를 준다", { code: "map-not-found" });
    const map = requireMap(draft, mapId);
    const tileset = draft.tilesets[map.tilesetId];
    if (!tileset || !isJpCityTileset(tileset)) {
      throw new ToolError(`맵 '${map.name}'(${mapId}) 의 칩셋 '${map.tilesetId}' 은 일본 도시(${JP_CITY_ID}, 계열 ${JP_CITY_FAMILY})가 아니다 — paint_jp_forest 는 jp_city 맵에서만 동작한다.`, { code: "wrong-tileset", mapId });
    }
    if (!hasJpForestR4(tileset)) {
      throw new ToolError("이 프로젝트의 jp_city 칩셋에 나무 composer 숲(jp-forest4-bl)이 아직 없다 — 숲 키트(stamp_object kit:jp_city/jp-rg-*)로 대신 놓는다.", { code: "forest-not-baked", mapId });
    }
    const W = map.width, H = map.height;
    const want = new Uint8Array(W * H);
    const rect = rectOf(args.rect);
    const beside = rectOf(args.beside);
    const sideOf = (v: unknown, dflt: Side): Side => (SIDES as readonly string[]).includes(String(v)) ? (v as Side) : dflt;
    let where = "";
    if (rect) {
      for (let y = Math.max(0, rect.y); y < Math.min(H, rect.y + rect.h); y++) for (let x = Math.max(0, rect.x); x < Math.min(W, rect.x + rect.w); x++) want[y * W + x] = 1;
      where = `(${rect.x},${rect.y}) ${rect.w}×${rect.h}`;
    }
    if (beside) {
      const o = args.beside as Record<string, unknown>;
      const side = sideOf(o.side, "around"), depth = Math.max(3, Math.min(20, intOf(o.depth) ?? 6));
      besideCells(W, H, beside, side, depth, want);
      where += `${where ? " + " : ""}(${beside.x},${beside.y}) ${beside.w}×${beside.h} 의 ${side} ${depth}칸`;
    }
    if (typeof args.besideLocation === "string" && args.besideLocation.trim()) {
      const key = args.besideLocation.trim();
      const loc = (map.locations ?? []).find((l) => l.id === key) ?? (map.locations ?? []).find((l) => l.name === key);
      if (!loc) throw new ToolError(`위치 이름표 '${key}' 가 이 맵에 없다 — list_map_locations 로 id 를 고르거나 beside 사각형을 준다`, { code: "location-not-found", mapId });
      const side = sideOf(args.side, "north"), depth = Math.max(3, Math.min(20, intOf(args.depth) ?? 6));
      besideCells(W, H, { x: loc.x, y: loc.y, w: loc.w, h: loc.h }, side, depth, want);
      where += `${where ? " + " : ""}「${loc.name}」의 ${side} ${depth}칸`;
    }
    if (!where) throw new ToolError("숲 자리가 없다 — rect 또는 beside 또는 besideLocation 중 하나를 준다", { code: "invalid-args", mapId });
    const forestType: JpForestType = args.forestType === "grove" ? "grove" : "dense";
    const grounding = args.grounding !== false;
    const seed = intOf(args.seed) ?? 0;
    const next = structuredClone(map);
    const rep = paintJpForestArea(next, tileset, want, { forestType, grounding, seed });
    if (!rep) throw new ToolError("숲을 칠하지 못했다(composer 없음)", { code: "forest-not-baked", mapId });
    if (rep.floorCells === 0) {
      throw new ToolError(`숲이 될 잔디 칸이 없다 — ${where} 은 길·물·건물·소품이거나 잔디가 아니다(건너뛴 칸 ${rep.skipped}). 잔디(fill_region 잔디)를 먼저 깔거나 자리를 옮긴다.`, { code: "no-forest-cells", mapId });
    }
    draft.maps[mapId] = next;
    const warnings: string[] = [];
    if (rep.skipped > rep.floorCells) warnings.push(`요청 자리의 칸 중 ${rep.skipped}칸이 잔디가 아니라 건너뛰었다 — show_map_region 으로 숲 모양을 확인한다`);
    return {
      summary: `숲(${forestType === "grove" ? "공원 숲" : "빽빽한 숲"}${grounding ? "·나무 밑 그늘" : ""}) — ${where}: 숲 바닥 ${rep.floorCells}칸, 나무·그늘 칸 ${rep.changed}칸 바뀜. show_map_region 으로 확인한다.`,
      data: { mapId, ...rep, seed },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};
