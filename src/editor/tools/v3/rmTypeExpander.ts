// editor/tools/v3/rmTypeExpander.ts
// RM-TYPE 시공 전개기 (타일 툴 v3, 2026-07-07 설계 축 5 — V3B).
//
// 승인된 어휘 그룹의 patternGrammar를 실제 맵 셀-타일 매핑으로 전개한다. 전부 순수 함수 +
// 결정론(RNG 없음 — 파츠에 타일이 여럿이면 좌표 해시로 고른다). 레이어는 어휘의 속성
// (layerHome, perCell은 tileLayerHome 판정)이며 프리미티브는 layer 인자를 받지 않는다.
//
// 오토타일 재계산은 기존 엔진(project/defaults/autotileEngine.ts)의 8-이웃 마스크/variantMap
// 조회를 그대로 재사용한다. 8비트 inner corner variantMap 생성기는 기존에 없어 여기 추가한다.

import {
  AUTOTILE_DIR,
  autotileNeighborMask,
  autotileVariantForMask,
  type AutotileMapView,
} from "@/project/defaults/autotileEngine";
import type { EdgeCornerTileSet } from "@/project/defaults/autotileEngine";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { groupLayerHome, type VocabLayerHome } from "@/project/tileVocabulary";
import type { AutotileGroup, TileGroupMetadata, TilesetDef } from "@/project/types";
import { ToolError } from "../types";
import type { GrammarProfile } from "./grammarProfiles";

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

// placementStructure.StructureCellEdit 셰이프 선례를 따른다.
export interface CellEdit {
  readonly x: number;
  readonly y: number;
  readonly layer: "lower" | "upper";
  readonly tile: number;
}

export interface Expansion {
  readonly edits: readonly CellEdit[];
  readonly region: Rect;
}

type PatternGrammar = NonNullable<TileGroupMetadata["patternGrammar"]>;
type PartRole = PatternGrammar["parts"][number]["role"];

function partTiles(grammar: PatternGrammar, role: PartRole): readonly number[] {
  return grammar.parts.find((part) => part.role === role)?.tileIds ?? [];
}

// 좌표 해시 결정론 선택 — 같은 rect/그룹이면 항상 같은 결과(Math.random 금지).
function pickTile(tiles: readonly number[], x: number, y: number): number | undefined {
  if (tiles.length === 0) return undefined;
  return tiles[((x * 31 + y * 17) >>> 0) % tiles.length];
}

// 어휘 홈 레이어 결정: 그룹 layerHome → defaultLayer 유도 → 프로파일 role 폴백.
export function vocabLayerHomeFor(group: TileGroupMetadata, profile: GrammarProfile): VocabLayerHome {
  if (group.layerHome) return group.layerHome;
  if (group.defaultLayer === "lower" || group.defaultLayer === "upper") return group.defaultLayer;
  const derived = groupLayerHome(group);
  return derived === "perCell" ? profile.layerHomeByRole[group.role] : derived;
}

// perCell이면 타일별(투명 배경 칩 = upper) 판정 — 처마/사선 지붕 오버레이 규약.
export function layerForVocabTile(tileset: TilesetDef, home: VocabLayerHome, tile: number): "lower" | "upper" {
  if (home !== "perCell") return home;
  return tileLayerHome(tileset, tile) === "upper" ? "upper" : "lower";
}

function requireGrammar(group: TileGroupMetadata, example: Record<string, unknown>): PatternGrammar {
  const grammar = group.patternGrammar;
  if (!grammar || grammar.parts.length === 0) {
    throw new ToolError(
      `타일 그룹 '${group.name}'(${group.id})에 패턴 파츠(patternGrammar.parts)가 정의돼 있지 않아 전개할 수 없습니다. ` +
        `T1b 위저드나 어휘 카드에서 패턴을 정의한 뒤 다시 시도하세요. — 다시 보낼 형식 예시: ${JSON.stringify(example)}`,
      { code: "pattern-undefined" }
    );
  }
  return grammar;
}

function nineSliceRole(rect: Rect, x: number, y: number): PartRole {
  const top = y === rect.y;
  const bottom = y === rect.y + rect.h - 1;
  const left = x === rect.x;
  const right = x === rect.x + rect.w - 1;
  if (top && left) return "topLeft";
  if (top && right) return "topRight";
  if (bottom && left) return "bottomLeft";
  if (bottom && right) return "bottomRight";
  if (top) return "top";
  if (bottom) return "bottom";
  if (left) return "left";
  if (right) return "right";
  return "center";
}

function expandNineSlice(tileset: TilesetDef, group: TileGroupMetadata, grammar: PatternGrammar, rect: Rect, home: VocabLayerHome, example: Record<string, unknown>): CellEdit[] {
  const minW = grammar.minWidth ?? 3;
  const minH = grammar.minHeight ?? 3;
  if (rect.w < minW || rect.h < minH) {
    throw new ToolError(
      `'${group.name}' 9분할 패턴은 최소 ${minW}×${minH}가 필요합니다(요청 ${rect.w}×${rect.h}). — 다시 보낼 형식 예시: ${JSON.stringify(example)}`,
      { code: "rect-too-small" }
    );
  }
  const edits: CellEdit[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      const role = nineSliceRole(rect, x, y);
      const tile = pickTile(partTiles(grammar, role), x, y);
      if (tile === undefined) {
        throw new ToolError(
          `'${group.name}' 패턴에 '${role}' 파츠 타일이 없습니다 — 어휘 카드/T1b에서 9분할 파츠를 채워 주세요.`,
          { code: "pattern-part-missing" }
        );
      }
      edits.push({ x, y, layer: layerForVocabTile(tileset, home, tile), tile });
    }
  }
  return edits;
}

// 기둥(1×N 세로 전개). cap 규약: top/topCap 캡 → repeatBody(없으면 bottom 반복) → bottom/bottomCap 캡.
function expandVertical(tileset: TilesetDef, group: TileGroupMetadata, grammar: PatternGrammar, rect: Rect, home: VocabLayerHome, example: Record<string, unknown>): CellEdit[] {
  const minH = grammar.minHeight ?? 2;
  if (rect.h < minH) {
    throw new ToolError(
      `'${group.name}' 기둥 패턴은 최소 높이 ${minH}가 필요합니다(요청 ${rect.h}). — 다시 보낼 형식 예시: ${JSON.stringify(example)}`,
      { code: "rect-too-small" }
    );
  }
  const topTiles = firstNonEmpty(grammar, ["top", "topCap"]) ?? [group.tileIds[0]];
  const bottomTiles = firstNonEmpty(grammar, ["bottom", "bottomCap"]) ?? topTiles;
  const bodyTiles = firstNonEmpty(grammar, ["repeatBody"]) ?? bottomTiles;
  const edits: CellEdit[] = [];
  for (let x = rect.x; x < rect.x + rect.w; x += 1) {
    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
      const tiles = y === rect.y ? topTiles : y === rect.y + rect.h - 1 ? bottomTiles : bodyTiles;
      const tile = pickTile(tiles, x, y);
      if (tile === undefined) continue;
      edits.push({ x, y, layer: layerForVocabTile(tileset, home, tile), tile });
    }
  }
  return edits;
}

// 처마/울타리 행(가로 전개). cap 규약: leftCap → repeatBody → rightCap.
function expandHorizontal(tileset: TilesetDef, group: TileGroupMetadata, grammar: PatternGrammar, rect: Rect, home: VocabLayerHome, example: Record<string, unknown>): CellEdit[] {
  const minW = grammar.minWidth ?? 2;
  if (rect.w < minW) {
    throw new ToolError(
      `'${group.name}' 가로 패턴은 최소 너비 ${minW}가 필요합니다(요청 ${rect.w}). — 다시 보낼 형식 예시: ${JSON.stringify(example)}`,
      { code: "rect-too-small" }
    );
  }
  const leftTiles = firstNonEmpty(grammar, ["leftCap", "left"]) ?? [group.tileIds[0]];
  const rightTiles = firstNonEmpty(grammar, ["rightCap", "right"]) ?? leftTiles;
  const bodyTiles = firstNonEmpty(grammar, ["repeatBody", "center"]) ?? leftTiles;
  const edits: CellEdit[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      const tiles = x === rect.x ? leftTiles : x === rect.x + rect.w - 1 ? rightTiles : bodyTiles;
      const tile = pickTile(tiles, x, y);
      if (tile === undefined) continue;
      edits.push({ x, y, layer: layerForVocabTile(tileset, home, tile), tile });
    }
  }
  return edits;
}

function firstNonEmpty(grammar: PatternGrammar, roles: readonly PartRole[]): readonly number[] | undefined {
  for (const role of roles) {
    const tiles = partTiles(grammar, role);
    if (tiles.length > 0) return tiles;
  }
  return undefined;
}

// 벽 전개: nine_slice(9분할) 또는 vertical_expandable(기둥) / horizontal_expandable(울타리 행).
export function expandWall(tileset: TilesetDef, group: TileGroupMetadata, rect: Rect, profile: GrammarProfile, example: Record<string, unknown>): Expansion {
  const grammar = requireGrammar(group, example);
  const home = vocabLayerHomeFor(group, profile);
  if (grammar.kind === "nine_slice_expandable") {
    return { edits: expandNineSlice(tileset, group, grammar, rect, home, example), region: rect };
  }
  if (grammar.kind === "vertical_expandable") {
    return { edits: expandVertical(tileset, group, grammar, rect, home, example), region: rect };
  }
  if (grammar.kind === "horizontal_expandable") {
    return { edits: expandHorizontal(tileset, group, grammar, rect, home, example), region: rect };
  }
  throw new ToolError(
    `타일 그룹 '${group.name}'의 패턴 '${grammar.kind}'은(는) 벽 전개를 지원하지 않습니다(지원: nine_slice_expandable/vertical_expandable/horizontal_expandable).`,
    { code: "pattern-unsupported" }
  );
}

// 지붕 전개: 벽 영역 바로 위에 얹는다. nine_slice = 지붕면 다열, horizontal = 처마 1행.
// perCell 규약(프로파일 roof: perCell)에 따라 투명 오버레이 타일은 upper로 간다.
export function expandRoof(tileset: TilesetDef, group: TileGroupMetadata, wallRegion: Rect, profile: GrammarProfile, example: Record<string, unknown>): Expansion {
  const grammar = requireGrammar(group, example);
  const home = vocabLayerHomeFor(group, profile);
  const rows = grammar.kind === "horizontal_expandable" ? 1 : Math.max(grammar.minHeight ?? 2, 1);
  const top = Math.max(0, wallRegion.y - rows);
  const height = wallRegion.y - top;
  if (height < 1) {
    throw new ToolError(
      `벽 위(y<${wallRegion.y})에 지붕을 놓을 공간이 없습니다 — 벽을 아래쪽에 짓거나 wallRect를 조정하세요.`,
      { code: "no-roof-space" }
    );
  }
  const region: Rect = { x: wallRegion.x, y: top, w: wallRegion.w, h: height };
  if (grammar.kind === "nine_slice_expandable") {
    // 지붕면은 세로 최소치를 벽 위 공간에 맞춰 완화한다(1~2행 지붕이 일반적).
    const relaxed: PatternGrammar = { ...grammar, minWidth: Math.min(grammar.minWidth ?? 3, region.w), minHeight: Math.min(grammar.minHeight ?? 3, region.h) };
    return { edits: expandNineSlice(tileset, group, relaxed, region, home, example), region };
  }
  if (grammar.kind === "horizontal_expandable") {
    return { edits: expandHorizontal(tileset, group, grammar, region, home, example), region };
  }
  if (grammar.kind === "vertical_expandable") {
    return { edits: expandVertical(tileset, group, grammar, region, home, example), region };
  }
  throw new ToolError(
    `타일 그룹 '${group.name}'의 패턴 '${grammar.kind}'은(는) 지붕 전개를 지원하지 않습니다.`,
    { code: "pattern-unsupported" }
  );
}

export interface AutotilePoint {
  readonly x: number;
  readonly y: number;
}

// 8-이웃 variantMap 재계산 — 칠해진 셀 + 8-이웃 링을 재검사한다(기존 엔진의
// autotileNeighborMask/autotileVariantForMask 재사용). 8비트 마스크 항목이 없으면
// 4비트(외곽) 폴백으로 조회해 부분 정의 variantMap에도 안전하다.
export function resolveAutotile(group: AutotileGroup, paintedCells: readonly AutotilePoint[], map: AutotileMapView): number {
  const members = new Set<number>(group.memberTileIds);
  const connect = new Set<number>(group.connectTileIds ?? group.memberTileIds);
  const isConnected = (tile: number): boolean => connect.has(tile);
  const visited = new Set<string>();
  let changed = 0;
  for (const point of paintedCells) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const cx = point.x + dx;
        const cy = point.y + dy;
        if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) continue;
        const key = `${cx},${cy}`;
        if (visited.has(key)) continue;
        visited.add(key);
        const current = map.lowerTiles[cy * map.width + cx];
        if (!members.has(current)) continue;
        const mask = autotileNeighborMask(map, cx, cy, isConnected, 8);
        const variant = autotileVariantForMask(group, mask) ?? autotileVariantForMask(group, mask & 15);
        if (typeof variant === "number" && variant !== current) {
          map.lowerTiles[cy * map.width + cx] = variant;
          changed += 1;
        }
      }
    }
  }
  return changed;
}

export interface InnerCornerTileSet {
  readonly innerNW?: number;
  readonly innerNE?: number;
  readonly innerSW?: number;
  readonly innerSE?: number;
}

// 8-이웃(256키) variantMap 생성기 — 4방향 외곽 판정 + 4방 모두 연결인데 대각만 빈
// inner corner 케이스를 보강한다(RM-TYPE 필수. 기존 buildEdgeCornerVariantMap은 4비트 전용).
export function buildEightNeighborVariantMap(tiles: EdgeCornerTileSet, inner: InnerCornerTileSet = {}): Record<string, number> {
  const variantMap: Record<string, number> = {};
  for (let mask = 0; mask < 256; mask += 1) {
    const n = (mask & AUTOTILE_DIR.N) !== 0;
    const e = (mask & AUTOTILE_DIR.E) !== 0;
    const s = (mask & AUTOTILE_DIR.S) !== 0;
    const w = (mask & AUTOTILE_DIR.W) !== 0;
    let tile: number;
    if (!n && !w) tile = tiles.cornerNW;
    else if (!n && !e) tile = tiles.cornerNE;
    else if (!s && !w) tile = tiles.cornerSW;
    else if (!s && !e) tile = tiles.cornerSE;
    else if (!n) tile = tiles.edgeN;
    else if (!s) tile = tiles.edgeS;
    else if (!w) tile = tiles.edgeW;
    else if (!e) tile = tiles.edgeE;
    else {
      // 4방 모두 연결 — 대각이 빠졌으면 inner corner(오목) 변형.
      if ((mask & AUTOTILE_DIR.NW) === 0 && inner.innerNW !== undefined) tile = inner.innerNW;
      else if ((mask & AUTOTILE_DIR.NE) === 0 && inner.innerNE !== undefined) tile = inner.innerNE;
      else if ((mask & AUTOTILE_DIR.SW) === 0 && inner.innerSW !== undefined) tile = inner.innerSW;
      else if ((mask & AUTOTILE_DIR.SE) === 0 && inner.innerSE !== undefined) tile = inner.innerSE;
      else tile = tiles.body;
    }
    variantMap[String(mask)] = tile;
  }
  return variantMap;
}
