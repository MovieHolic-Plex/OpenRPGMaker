// editor/tools/layerTools.ts
// MZ 4층 쓰기 도구 — 여러 층 배열 한 번에 찍기(stamp_layer_block)·그림자 조각(paint_shadow).
// 설계: docs/superpowers/specs/2026-09-24-mz-four-layer-design.md §7, 계획 docs/superpowers/plans/2026-09-25-mz-layers-assistant.md Task 2.
//
// 왜 따로 있는가: paint_tiles 는 호출당 번호 하나라 나무 2×3 같은 여러 칸 물체를 찍으려면 호출이 여러 번 들고,
// 참고문서의 「완성 예제」(층별 배열)를 그대로 옮길 수단이 없었다. 그림자는 쓰는 도구가 아예 없었다.
// 층 번호와 맵 칸 이름의 대응은 @/project/mapLayers 가 정본이다 — 여기서는 도우미만 쓴다.

import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { autotileLayerView, shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { TILE } from "@/project/defaults/constants";
import { compactMapLayers, setLayerTileAt, setShadowAt, shadowAt, type TileLayerNo } from "@/project/mapLayers";
import type { GameMap } from "@/project/types";
import { FOUR_LAYER_GUIDANCE, FOUR_LAYER_GUIDANCE_SHORT, inMapBounds, passabilityWarning, requireMap, type Point } from "./mapHelpers";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

/** 배열 값 -1 = 그 칸 건드리지 않음, -2 = 그 칸을 그 층에서 비움. */
const KEEP = -1;
const CLEAR = -2;

const STAMP_EXAMPLE = {
  mapId: "map_1", x: 4, y: 3,
  layers: { "1": [[10, 10], [10, 10]], "3": [[-1, 120], [-1, 128]], shadow: [[0, 0], [5, 0]] },
};

const GRID_SCHEMA: JsonSchema = {
  type: "array",
  description: "행 배열(위→아래), 각 행은 칸 값(왼→오른). -1=건드리지 않음, -2=그 칸 비움",
  items: { type: "array", items: { type: "integer" } },
};

type StampLayerKey = "1" | "2" | "3" | "4" | "shadow";
const STAMP_LAYER_KEYS: readonly StampLayerKey[] = ["1", "2", "3", "4", "shadow"];

interface StampWrite {
  readonly x: number;
  readonly y: number;
  readonly value: number;
}

function invalid(message: string, mapId?: string): never {
  throw new ToolError(`${message} 예: ${JSON.stringify(STAMP_EXAMPLE)}`, { code: "invalid-args", ...(mapId ? { mapId } : {}) });
}

function coerceGrid(value: unknown, key: StampLayerKey, mapId: string): number[][] {
  if (!Array.isArray(value)) invalid(`layers["${key}"] 는 2차원 정수 배열이어야 합니다.`, mapId);
  return value.map((row, rowIndex) => {
    if (!Array.isArray(row)) invalid(`layers["${key}"][${rowIndex}] 는 정수 배열(한 행)이어야 합니다.`, mapId);
    return row.map((cell, colIndex) => {
      if (typeof cell !== "number" || !Number.isInteger(cell)) invalid(`layers["${key}"][${rowIndex}][${colIndex}] 는 정수여야 합니다.`, mapId);
      return cell;
    });
  });
}

/**
 * 블록을 층별 쓰기 목록으로 편다. 범위 밖 번호·맵 밖 칸이 하나라도 있으면 아무것도 쓰기 전에 거부한다(부분 쓰기 없음).
 * -1 칸은 쓰기가 아니라서 맵 밖에 있어도 된다(모양을 맞추려는 빈칸 채움).
 */
function planStamp(map: GameMap, tileCount: number | undefined, x0: number, y0: number, layers: Record<string, unknown>): Map<StampLayerKey, StampWrite[]> {
  const plan = new Map<StampLayerKey, StampWrite[]>();
  const unknown = Object.keys(layers).filter((key) => !STAMP_LAYER_KEYS.includes(key as StampLayerKey));
  if (unknown.length > 0) invalid(`layers 에 모르는 키가 있습니다: ${unknown.join(", ")} — "1"|"2"|"3"|"4"|"shadow" 만 받습니다.`, map.id);
  for (const key of STAMP_LAYER_KEYS) {
    if (layers[key] === undefined) continue;
    const grid = coerceGrid(layers[key], key, map.id);
    const writes: StampWrite[] = [];
    grid.forEach((row, dy) => row.forEach((value, dx) => {
      if (value === KEEP) return;
      const x = x0 + dx, y = y0 + dy;
      const where = `layers["${key}"][${dy}][${dx}]`;
      if (key === "shadow") {
        if (value !== CLEAR && (value < 0 || value > 15)) invalid(`${where}=${value}: 그림자는 0~15(사분면 비트) 또는 -1/-2 만 받습니다.`, map.id);
      } else if (value !== CLEAR && (value < 0 || (tileCount !== undefined && value >= tileCount))) {
        throw new ToolError(
          `타일 인덱스 범위 밖: ${where}=${value} (-1=건드리지 않음, -2=비움, 0~${(tileCount ?? 1) - 1}) — 아무 칸도 쓰지 않았습니다. tile_query 로 존재하는 인덱스를 확인하세요.`,
          { code: "tile-out-of-range", mapId: map.id },
        );
      }
      if (!inMapBounds(map, x, y)) {
        throw new ToolError(
          `${where} 가 맵(${map.width}×${map.height}) 밖 칸 (${x},${y}) 입니다 — 아무 칸도 쓰지 않았습니다. x/y 를 옮기거나 그 칸을 -1 로 두세요.`,
          { code: "region-out-of-bounds", mapId: map.id, x, y },
        );
      }
      writes.push({ x, y, value });
    }));
    if (writes.length > 0) plan.set(key, writes);
  }
  return plan;
}

const stampLayerBlock: ToolDefinition = {
  name: "stamp_layer_block",
  description:
    "여러 층 배열을 (x,y) 부터 한 번에 찍는다 — 여러 칸 물체(나무 2×3·집)나 참고문서의 완성 예제 배열을 그대로 옮길 때. "
    + `${FOUR_LAYER_GUIDANCE} `
    + "layers 의 키는 \"1\"|\"2\"|\"3\"|\"4\"|\"shadow\", 값은 행 배열(위→아래). 칸 값 -1=건드리지 않음, -2=그 칸을 그 층에서 비움, 그 밖은 타일 번호(그림자는 0~15 사분면 비트: 1=좌상 2=우상 4=좌하 8=우하). "
    + "1층 칸을 찍으면 그 칸의 2층은 비워진다(같은 블록에 2층 값이 있으면 그 값). 3·4층·그림자는 준 칸만 바뀐다. "
    + "범위 밖 번호나 맵 밖 칸이 하나라도 있으면 아무것도 쓰지 않고 실패한다. 1·2층 자동타일 멤버는 찍은 뒤 그 층 이웃에 맞춰 재성형된다 — "
    + "참고문서 예제를 번호 그대로 옮기려면 reshape:false(재성형 안 함).",
  mode: "write",
  domains: ["map", "tile"],
  invalidArgsExample: STAMP_EXAMPLE,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer", description: "블록 좌상단 x(맵 좌표)" },
      y: { type: "integer", description: "블록 좌상단 y(맵 좌표)" },
      layers: {
        type: "object",
        description: "층별 2차원 배열. 필요한 층만 준다",
        properties: { "1": GRID_SCHEMA, "2": GRID_SCHEMA, "3": GRID_SCHEMA, "4": GRID_SCHEMA, shadow: GRID_SCHEMA },
      },
      reshape: { type: "boolean", description: "기본 true — 1·2층 자동타일 멤버를 찍은 뒤 이웃에 맞춰 재성형. false 면 찍은 번호 그대로" },
    },
    required: ["mapId", "x", "y", "layers"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const x0 = args.x as number, y0 = args.y as number;
    if (!Number.isInteger(x0) || !Number.isInteger(y0)) invalid("x/y 는 정수여야 합니다.", map.id);
    const layers = args.layers;
    if (typeof layers !== "object" || layers === null || Array.isArray(layers)) invalid("layers 는 {\"1\":[[…]], …} 객체여야 합니다.", map.id);
    const tileset = draft.tilesets[map.tilesetId];
    const plan = planStamp(map, tileset?.count, x0, y0, layers as Record<string, unknown>);
    if (plan.size === 0) invalid("쓸 칸이 없습니다 — 모든 칸이 -1(건드리지 않음)입니다.", map.id);
    if (args.reshape !== undefined && typeof args.reshape !== "boolean") invalid("reshape 는 true/false 여야 합니다.", map.id);
    const reshape = args.reshape !== false;

    // 같은 블록에 2층 값이 있는 칸 — 1층 칸이 2층을 비우는 규칙에서 뺀다.
    const layer2Cells = new Set((plan.get("2") ?? []).map((w) => w.y * map.width + w.x));
    const counts: Record<StampLayerKey, number> = { "1": 0, "2": 0, "3": 0, "4": 0, shadow: 0 };
    const written = new Map<TileLayerNo, Point[]>();
    for (const key of STAMP_LAYER_KEYS) {
      const writes = plan.get(key);
      if (!writes) continue;
      for (const write of writes) {
        const index = write.y * map.width + write.x;
        if (key === "shadow") {
          setShadowAt(map, index, write.value === CLEAR ? 0 : write.value);
        } else {
          const layer = Number(key) as TileLayerNo;
          setLayerTileAt(map, layer, index, write.value === CLEAR ? TILE.EMPTY : write.value);
          if (layer === 1 && !layer2Cells.has(index)) setLayerTileAt(map, 2, index, TILE.EMPTY);
          const points = written.get(layer) ?? [];
          points.push({ x: write.x, y: write.y });
          written.set(layer, points);
        }
        counts[key] += 1;
      }
    }
    // 자동타일은 바닥 층(1·2층)의 것이다 — 찍은 층 배열에서 그 층 이웃 기준으로 모양을 잡는다. 3·4층 물체는 찍은 번호 그대로.
    // 1층을 찍은 칸은 2층도 비웠으므로 그 둘레 2층 장식의 가장자리도 다시 잡는다.
    const reshapePoints = new Map<1 | 2, Point[]>([
      [1, written.get(1) ?? []],
      [2, [...(written.get(2) ?? []), ...(map.lowerOverlayTiles ? written.get(1) ?? [] : [])]],
    ]);
    for (const layer of reshape ? [1, 2] as const : [] as const) {
      const points = reshapePoints.get(layer)!;
      if (points.length === 0) continue;
      const view = autotileLayerView(map, layer);
      for (const group of autotileGroupsForTileset(tileset)) shapeAutotileGroupAround(view, group, points);
    }
    compactMapLayers(map);

    const touched = [...new Map([...written.values()].flat().map((p) => [`${p.x},${p.y}`, p] as const)).values()];
    const warning = touched.length > 0 ? passabilityWarning(draft, map, touched) : null;
    const parts = STAMP_LAYER_KEYS.filter((key) => counts[key] > 0).map((key) => `${key === "shadow" ? "그림자" : `${key}층`} ${counts[key]}칸`);
    const rows = Math.max(...[...plan.values()].flat().map((w) => w.y)) - y0 + 1;
    const cols = Math.max(...[...plan.values()].flat().map((w) => w.x)) - x0 + 1;
    return {
      summary: `${map.name} (${x0},${y0}) 에 층 블록 찍기 — ${parts.join(" · ")}`,
      ...(warning ? { warnings: [warning] } : {}),
      data: { x: x0, y: y0, width: cols, height: rows, cells: counts, reshaped: reshape },
    };
  },
};

const QUARTER_BITS = { tl: 1, tr: 2, bl: 4, br: 8 } as const;
type Quarter = keyof typeof QUARTER_BITS;
const SHADOW_EXAMPLE = { mapId: "map_1", cells: [{ x: 5, y: 4, quarters: ["tl", "bl"] }, { x: 6, y: 4, bits: 15 }], mode: "set" };

const paintShadow: ToolDefinition = {
  name: "paint_shadow",
  description:
    "그림자 사분면을 칠한다 — 벽·절벽 아래 바닥 칸에 드리우는 반투명 검정(칸을 넷으로 나눈 조각). "
    + `${FOUR_LAYER_GUIDANCE_SHORT} `
    + "cells[{x,y,quarters?:[\"tl\"|\"tr\"|\"bl\"|\"br\"], bits?:0~15}] — quarters 또는 bits(1=좌상 2=우상 4=좌하 8=우하, 합). "
    + "mode: set(기본, 그 칸 그림자를 이것으로)|add(더하기)|clear(빼기 — quarters/bits 가 없으면 그 칸 그림자 전부 지움). 맵 밖 칸이 하나라도 있으면 아무것도 쓰지 않는다.",
  mode: "write",
  domains: ["map", "tile"],
  invalidArgsExample: SHADOW_EXAMPLE,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      cells: {
        type: "array",
        description: "[{x,y,quarters?,bits?}...]",
        items: {
          type: "object",
          properties: {
            x: { type: "integer" },
            y: { type: "integer" },
            quarters: { type: "array", items: { type: "string", enum: ["tl", "tr", "bl", "br"] } },
            bits: { type: "integer", minimum: 0, maximum: 15 },
          },
          required: ["x", "y"],
        },
      },
      mode: { type: "string", enum: ["set", "add", "clear"], description: "기본 set" },
    },
    required: ["mapId", "cells"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const mode = args.mode === undefined ? "set" : args.mode;
    if (mode !== "set" && mode !== "add" && mode !== "clear") shadowInvalid("mode 는 set/add/clear 중 하나여야 합니다.", map.id);
    const cells = args.cells;
    if (!Array.isArray(cells) || cells.length === 0) shadowInvalid("cells 배열이 필요합니다.", map.id);
    // 전부 검사한 뒤에 쓴다(부분 쓰기 없음).
    const plan = cells.map((raw, i) => {
      if (typeof raw !== "object" || raw === null) shadowInvalid(`cells[${i}] 는 {x,y,…} 객체여야 합니다.`, map.id);
      const cell = raw as Record<string, unknown>;
      const x = cell.x, y = cell.y;
      if (typeof x !== "number" || typeof y !== "number" || !Number.isInteger(x) || !Number.isInteger(y)) shadowInvalid(`cells[${i}].x/y 는 정수여야 합니다.`, map.id);
      if (!inMapBounds(map, x, y)) {
        throw new ToolError(`cells[${i}] (${x},${y}) 가 맵(${map.width}×${map.height}) 밖입니다 — 아무 칸도 쓰지 않았습니다.`, { code: "region-out-of-bounds", mapId: map.id, x, y });
      }
      let bits: number | null = null;
      if (cell.bits !== undefined) {
        if (typeof cell.bits !== "number" || !Number.isInteger(cell.bits) || cell.bits < 0 || cell.bits > 15) shadowInvalid(`cells[${i}].bits 는 0~15 정수여야 합니다.`, map.id);
        bits = cell.bits;
      }
      if (cell.quarters !== undefined) {
        if (!Array.isArray(cell.quarters) || cell.quarters.some((q) => typeof q !== "string" || !Object.hasOwn(QUARTER_BITS, q))) shadowInvalid(`cells[${i}].quarters 는 "tl"|"tr"|"bl"|"br" 배열이어야 합니다.`, map.id);
        bits = (bits ?? 0) | (cell.quarters as Quarter[]).reduce((sum, q) => sum | QUARTER_BITS[q], 0);
      }
      if (bits === null && mode !== "clear") shadowInvalid(`cells[${i}] 에 quarters 또는 bits 가 필요합니다(clear 모드만 생략 가능).`, map.id);
      return { x, y, bits };
    });
    let changed = 0;
    for (const cell of plan) {
      const index = cell.y * map.width + cell.x;
      const before = shadowAt(map, index);
      const next = mode === "set" ? cell.bits! : mode === "add" ? before | cell.bits! : cell.bits === null ? 0 : before & ~cell.bits;
      setShadowAt(map, index, next);
      if (shadowAt(map, index) !== before) changed += 1;
    }
    compactMapLayers(map);
    return {
      summary: `${map.name} 그림자 ${mode} — ${plan.length}칸 중 ${changed}칸 바뀜`,
      data: { mode, cells: plan.length, changed },
    };
  },
};

function shadowInvalid(message: string, mapId: string): never {
  throw new ToolError(`${message} 예: ${JSON.stringify(SHADOW_EXAMPLE)}`, { code: "invalid-args", mapId });
}

export const LAYER_TOOLS: readonly ToolDefinition[] = [stampLayerBlock, paintShadow];
