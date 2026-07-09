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
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { groupLayerHome, type VocabLayerHome } from "@/project/tileVocabulary";
import type { AutotileGroup, TileGroupMetadata, TilesetDef } from "@/project/types";
import { ToolError } from "../types";
import type { GrammarPatternKind, GrammarProfile } from "./grammarProfiles";

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
  const resolved = resolveRoofGrammar(tileset, group, profile, example);
  const { grammar, home, group: roofGroup } = resolved;
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
    return { edits: expandNineSlice(tileset, roofGroup, relaxed, region, home, example), region };
  }
  if (grammar.kind === "horizontal_expandable") {
    return { edits: expandHorizontal(tileset, roofGroup, grammar, region, home, example), region };
  }
  if (grammar.kind === "vertical_expandable") {
    return { edits: expandVertical(tileset, roofGroup, grammar, region, home, example), region };
  }
  return { edits: expandHorizontal(tileset, roofGroup, syntheticHorizontalRoofGrammar(roofGroup), region, home, example), region };
}

function resolveRoofGrammar(
  tileset: TilesetDef,
  group: TileGroupMetadata,
  profile: GrammarProfile,
  example: Record<string, unknown>
): { readonly group: TileGroupMetadata; readonly grammar: PatternGrammar; readonly home: VocabLayerHome } {
  const grammar = requireGrammar(group, example);
  const home = vocabLayerHomeFor(group, profile);
  if (grammar.kind === "nine_slice_expandable" || grammar.kind === "horizontal_expandable" || grammar.kind === "vertical_expandable") {
    return { group, grammar, home };
  }
  const sibling = (tileset.tileGroups ?? []).find((candidate) => {
    const kind = candidate.patternGrammar?.kind;
    return candidate.id !== group.id
      && candidate.role === "roof"
      && (kind === "nine_slice_expandable" || kind === "horizontal_expandable" || kind === "vertical_expandable")
      && (candidate.patternGrammar?.parts.length ?? 0) > 0;
  });
  if (sibling?.patternGrammar) {
    return { group: sibling, grammar: sibling.patternGrammar, home: vocabLayerHomeFor(sibling, profile) };
  }
  return { group, grammar: syntheticHorizontalRoofGrammar(group), home };
}

function syntheticHorizontalRoofGrammar(group: TileGroupMetadata): PatternGrammar {
  const first = group.tileIds[0];
  const middle = group.tileIds[Math.floor(group.tileIds.length / 2)] ?? first;
  const last = group.tileIds[group.tileIds.length - 1] ?? middle;
  if (first === undefined || middle === undefined || last === undefined) {
    throw new ToolError(`타일 그룹 '${group.name}'(${group.id})에 지붕 폴백으로 쓸 타일이 없습니다.`, { code: "pattern-underspecified" });
  }
  return {
    axis: "horizontal",
    kind: "horizontal_expandable",
    minWidth: 1,
    parts: [
      { role: "leftCap", tileIds: [first] },
      { role: "repeatBody", tileIds: [middle] },
      { role: "rightCap", tileIds: [last] },
    ],
    preserveCaps: true,
    repeat: "body",
  };
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

// ── 승인 시 패턴 파츠 자동 생성 (2026-07-07 타일 시공 흐름 재설계 §2.1.2) ────────────
// 불변식: origin:"user" + 전개형 patternKind 그룹은 반드시 patternGrammar.parts를 갖는다.
// propose_tile_vocabulary 수락(approveGroupItem)이 커밋 직전에 이 함수로 파츠를 채운다.
// 파츠의 정의(여기)와 소비(expandWall/expandRoof/resolveAutotile)를 같은 파일에 둔다.

// 전개기가 소비하는 patternKind — 이 목록의 그룹은 파츠 없이 승인 완료될 수 없다.
export const EXPANDABLE_PATTERN_KINDS = [
  "nine_slice_expandable",
  "vertical_expandable",
  "horizontal_expandable",
  "autotile_3x3",
] as const;

export type ExpandablePatternKind = (typeof EXPANDABLE_PATTERN_KINDS)[number];

export function isExpandablePatternKind(kind: string | undefined): kind is ExpandablePatternKind {
  return kind !== undefined && (EXPANDABLE_PATTERN_KINDS as readonly string[]).includes(kind);
}

// nine_slice/autotile의 3×3 row-major 역할 순서(TL,T,TR / L,C,R / BL,B,BR).
const NINE_ROLES: readonly PartRole[] = [
  "topLeft", "top", "topRight",
  "left", "center", "right",
  "bottomLeft", "bottom", "bottomRight",
];

function underspecified(message: string): ToolError {
  return new ToolError(message, { code: "pattern-underspecified" });
}

function nineParts(tileIds: readonly number[]): PatternGrammar["parts"] {
  const parts = NINE_ROLES.map((role, index) => ({ role, tileIds: [tileIds[index]] }));
  // 9개 초과분은 center 변형 타일로 편입한다(선례: 흙길 center [BODY, BODY_ALT] —
  // pickTile 좌표 해시가 결정론으로 고른다).
  for (const extra of tileIds.slice(9)) parts[4].tileIds.push(extra);
  return parts;
}

// 세로(기둥) 파츠: 3의 배수 tileIds를 row-major 상/중(반복)/하 행으로 3등분.
// 2개는 1×2 문/입구 규약(top/bottom — doorLikeEdits가 소비)으로 허용한다.
function verticalParts(tileIds: readonly number[], label: string): PatternGrammar["parts"] {
  if (tileIds.length === 2) {
    return [
      { role: "top", tileIds: [tileIds[0]] },
      { role: "bottom", tileIds: [tileIds[1]] },
    ];
  }
  if (tileIds.length < 3 || tileIds.length % 3 !== 0) {
    throw underspecified(
      `${label}: 기둥(vertical_expandable) 패턴은 tileIds 2개(상/하 1×2 규약) 또는 3의 배수(상/중(반복)/하 행 row-major)가 필요합니다 — 현재 ${tileIds.length}개.`
    );
  }
  const columns = tileIds.length / 3;
  return [
    { role: "top", tileIds: [...tileIds.slice(0, columns)] },
    { role: "repeatBody", tileIds: [...tileIds.slice(columns, columns * 2)] },
    { role: "bottom", tileIds: [...tileIds.slice(columns * 2)] },
  ];
}

// 가로(처마/울타리 행) 파츠: 3의 배수 tileIds를 row-major 좌/중(반복)/우 열로 분배.
function horizontalParts(tileIds: readonly number[], label: string): PatternGrammar["parts"] {
  if (tileIds.length === 2) {
    return [
      { role: "leftCap", tileIds: [tileIds[0]] },
      { role: "rightCap", tileIds: [tileIds[1]] },
    ];
  }
  if (tileIds.length < 3 || tileIds.length % 3 !== 0) {
    throw underspecified(
      `${label}: 가로(horizontal_expandable) 패턴은 tileIds 2개(좌/우 캡) 또는 3의 배수(좌/중(반복)/우 열 row-major)가 필요합니다 — 현재 ${tileIds.length}개.`
    );
  }
  const left: number[] = [];
  const body: number[] = [];
  const right: number[] = [];
  tileIds.forEach((tile, index) => {
    if (index % 3 === 0) left.push(tile);
    else if (index % 3 === 1) body.push(tile);
    else right.push(tile);
  });
  return [
    { role: "leftCap", tileIds: left },
    { role: "repeatBody", tileIds: body },
    { role: "rightCap", tileIds: right },
  ];
}

// autotile_3x3 승인 시 8-이웃 variantMap 오토타일 그룹을 타일셋에 등록한다 —
// lay_path가 autotileGroupForVocab로 이 정의를 찾아 소비한다(승인 = 시공 가능 보장).
function registerAutotileGroup(
  tileset: TilesetDef,
  identity: { readonly groupId: string; readonly name: string },
  tileIds: readonly number[],
  variantMap: Record<string, number>
): void {
  if (!tileset.autotileGroups || tileset.autotileGroups.length === 0) {
    // 내장 기본 그룹(흙길/모래)이 폴백으로 살아있는 타일셋이면, 새 등록이 폴백을
    // 가리지 않도록(autotileGroupsForTileset은 자체 정의가 있으면 그것만 쓴다) 먼저 승계한다.
    tileset.autotileGroups = autotileGroupsForTileset(tileset).map((group) => ({
      ...group,
      memberTileIds: [...group.memberTileIds],
      connectTileIds: group.connectTileIds ? [...group.connectTileIds] : undefined,
      triggerTileIds: group.triggerTileIds ? [...group.triggerTileIds] : undefined,
      variantMap: { ...group.variantMap },
    }));
  }
  const entry: AutotileGroup = {
    id: identity.groupId,
    name: identity.name,
    neighborhood: 8,
    memberTileIds: [...new Set([...tileIds, ...Object.values(variantMap)])],
    variantMap,
  };
  const index = tileset.autotileGroups.findIndex((group) => group.id === identity.groupId);
  if (index >= 0) tileset.autotileGroups[index] = entry;
  else tileset.autotileGroups.push(entry);
}

// 승인 대상 그룹의 patternKind + tileIds에서 전개 가능한 patternGrammar를 결정론으로 파생한다.
// - nine_slice_expandable: 9개 row-major {TL,T,TR,L,C,R,BL,B,BR}. 9개 미만이면 pattern-underspecified.
// - vertical_expandable: 3의 배수 행 3등분(top/repeatBody/bottom), 2개는 1×2 문 규약.
// - horizontal_expandable: 3의 배수 열 분배(leftCap/repeatBody/rightCap), 2개는 좌/우 캡.
// - autotile_3x3: 9개 row-major(NW,N,NE,W,C,E,SW,S,SE) → buildEightNeighborVariantMap으로
//   variantMap 생성 + (identity가 있으면) 타일셋 오토타일 그룹 등록.
// - 그 외(미지원) patternKind: undefined 반환 — 승인은 가능하되 호출측이 "전개 불가"를 명시한다.
export function derivePatternGrammar(
  patternKind: GrammarPatternKind,
  tileIds: readonly number[],
  tileset: TilesetDef,
  identity?: { readonly groupId: string; readonly name: string }
): TileGroupMetadata["patternGrammar"] | undefined {
  const label = identity ? `그룹 '${identity.name}'(${identity.groupId})` : "그룹";
  if (patternKind === "nine_slice_expandable") {
    if (tileIds.length < 9) {
      throw underspecified(
        `${label}: 9분할(nine_slice_expandable) 패턴은 tileIds 9개(row-major TL,T,TR,L,C,R,BL,B,BR)가 필요합니다 — 현재 ${tileIds.length}개. 타일을 채워 다시 제안하세요.`
      );
    }
    return { axis: "both", kind: "nine_slice_expandable", minWidth: 3, minHeight: 3, parts: nineParts(tileIds), preserveCaps: true, repeat: "center" };
  }
  if (patternKind === "vertical_expandable") {
    return { axis: "vertical", kind: "vertical_expandable", minHeight: 2, parts: verticalParts(tileIds, label), preserveCaps: true, repeat: "body" };
  }
  if (patternKind === "horizontal_expandable") {
    return { axis: "horizontal", kind: "horizontal_expandable", minWidth: 2, parts: horizontalParts(tileIds, label), preserveCaps: true, repeat: "body" };
  }
  if (patternKind === "autotile_3x3") {
    if (tileIds.length < 9) {
      throw underspecified(
        `${label}: 오토타일(autotile_3x3) 패턴은 tileIds 9개(row-major NW,N,NE,W,C,E,SW,S,SE)가 필요합니다 — 현재 ${tileIds.length}개.`
      );
    }
    const variantMap = buildEightNeighborVariantMap({
      cornerNW: tileIds[0], edgeN: tileIds[1], cornerNE: tileIds[2],
      edgeW: tileIds[3], body: tileIds[4], edgeE: tileIds[5],
      cornerSW: tileIds[6], edgeS: tileIds[7], cornerSE: tileIds[8],
    });
    if (identity) registerAutotileGroup(tileset, identity, tileIds, variantMap);
    return { axis: "both", kind: "autotile_3x3", minWidth: 1, minHeight: 1, parts: nineParts(tileIds), preserveCaps: true, repeat: "center" };
  }
  return undefined;
}
