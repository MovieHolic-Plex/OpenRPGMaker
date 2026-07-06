// editor/tools/terrainTemplateExtract.ts
// 사람이 깐 맵 영역에서 지형 템플릿 초안을 추출하는 순수 모듈 — 지식뱅크 성장 루프의 심장.
// 행 시그니처 클러스터링 + left/middle/right 패턴 감지 + 위쪽 인접 행으로 mustTouch 초안.
// 결과는 "초안"이다: guessSummary(행별 추측 해석)를 사용자에게 먼저 보여주고,
// 인터뷰 확인을 거쳐 upsert_terrain_template(confirmedByUser=true)로 확정한다.

import type {
  GameMap,
  TerrainTemplateGrammarRule,
  TerrainTemplateRow,
  TilesetDef,
} from "@/project/types";
import { TILE } from "@/project/defaults/constants";
import { knownTileLabel } from "./tileMetadataTools";

export interface ExtractRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TerrainTemplateDraft {
  name: string;
  sourceMapName: string;
  sourceRegion: { mapId: string; x: number; y: number; w: number; h: number };
  rows: TerrainTemplateRow[];
  grammar: TerrainTemplateGrammarRule[];
  rules: string[];
  // 사용자에게 "질문 전에 먼저" 보여줄 행별 구성 추측 — 이미지 리치 인터뷰의 텍스트 짝.
  guessSummary: string[];
  // 검토 모달용 구조화 행 정보(grammar와 1:1, y범위 포함). 저장 시에는 쓰지 않는다.
  rowSpans: TerrainTemplateDraftRowSpan[];
}

export interface TerrainTemplateDraftRowSpan {
  role: string;
  kind: TerrainTemplateGrammarRule["kind"];
  layer: Layer;
  y0: number;
  y1: number;
  sparse: boolean;
  tiles: number[];
  left?: number;
  middle?: number;
  right?: number;
  mustTouch?: string;
  meaning: string;
  // 사람 말 요약(좌표·번호 최소화) — 카드 제목/설명용.
  humanText: string;
}

type Layer = "lower" | "upper";

interface RowPattern {
  layer: Layer;
  y0: number;
  y1: number; // 병합 구간(같은 시그니처 연속 행)
  left?: number;
  middle?: number;
  right?: number;
  sparse: boolean; // 채움 밀도가 낮음 → overlay 후보(창문/장식)
  tiles: number[]; // 등장 타일(중복 제거)
  signature: string;
}

function labelOf(tileset: TilesetDef, tile: number): string {
  return knownTileLabel(tileset, tile) ?? `타일 ${tile}`;
}

function rowTiles(map: GameMap, layer: Layer, region: ExtractRegion, y: number): number[] {
  const source = layer === "lower" ? map.lowerTiles : map.upperTiles;
  const tiles: number[] = [];
  for (let x = region.x; x < region.x + region.w; x += 1) {
    tiles.push(source[y * map.width + x] ?? TILE.EMPTY);
  }
  return tiles;
}

// 한 행의 좌/중/우 패턴을 감지한다. 채움 구간(EMPTY 제외 연속 구간)이 기준.
function analyzeRow(layer: Layer, y: number, tiles: number[]): RowPattern | null {
  const filledIdx = tiles.map((tile, index) => ({ tile, index })).filter((cell) => cell.tile !== TILE.EMPTY);
  if (filledIdx.length === 0) return null;
  const filled = filledIdx.map((cell) => cell.tile);
  const density = filledIdx.length / tiles.length;
  const distinct = [...new Set(filled)];
  // 최빈값을 middle로.
  const counts = new Map<number, number>();
  for (const tile of filled) counts.set(tile, (counts.get(tile) ?? 0) + 1);
  const middle = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const first = filled[0];
  const last = filled[filled.length - 1];
  const sparse = density < 0.5 && distinct.length <= 3;
  const pattern: RowPattern = {
    layer,
    y0: y,
    y1: y,
    middle,
    sparse,
    tiles: distinct,
    signature: "",
  };
  if (!sparse && filled.length >= 3) {
    if (first !== middle) pattern.left = first;
    if (last !== middle) pattern.right = last;
  }
  pattern.signature = `${layer}:${pattern.left ?? "-"}/${pattern.middle}/${pattern.right ?? "-"}:${sparse ? "sparse" : "run"}:${distinct.slice().sort((a, b) => a - b).join(",")}`;
  return pattern;
}

// 같은 시그니처가 연속되는 행을 병합한다(벽 중단부 반복 등).
function mergeRows(patterns: (RowPattern | null)[]): RowPattern[] {
  const merged: RowPattern[] = [];
  for (const pattern of patterns) {
    if (!pattern) continue;
    const previous = merged[merged.length - 1];
    if (previous && previous.signature === pattern.signature && previous.y1 === pattern.y0 - 1) {
      previous.y1 = pattern.y0;
    } else {
      merged.push({ ...pattern });
    }
  }
  return merged;
}

function roleNameFor(pattern: RowPattern, index: number): string {
  if (pattern.sparse) return `overlay-${index + 1}`;
  return `${pattern.layer === "upper" ? "upper" : "lower"}-row-${index + 1}`;
}

function kindFor(pattern: RowPattern): TerrainTemplateGrammarRule["kind"] {
  if (pattern.sparse) return "overlay";
  return pattern.layer === "upper" ? "roof-row" : "wall-row";
}

function patternText(tileset: TilesetDef, pattern: RowPattern): string {
  if (pattern.sparse) {
    return pattern.tiles.map((tile) => `${tile}(${labelOf(tileset, tile)})`).join(", ");
  }
  const parts: string[] = [];
  if (pattern.left !== undefined) parts.push(`좌 ${pattern.left}(${labelOf(tileset, pattern.left)})`);
  parts.push(`중 ${pattern.middle}(${labelOf(tileset, pattern.middle ?? TILE.EMPTY)}) 반복`);
  if (pattern.right !== undefined) parts.push(`우 ${pattern.right}(${labelOf(tileset, pattern.right)})`);
  return parts.join(" / ");
}

// 맵 영역 → 지형 템플릿 초안.
export function extractTerrainTemplateDraft(
  tileset: TilesetDef,
  map: GameMap,
  region: ExtractRegion,
  name = "새 구조물 템플릿"
): TerrainTemplateDraft {
  const lowerPatterns: (RowPattern | null)[] = [];
  const upperPatterns: (RowPattern | null)[] = [];
  for (let y = region.y; y < region.y + region.h; y += 1) {
    lowerPatterns.push(analyzeRow("lower", y, rowTiles(map, "lower", region, y)));
    upperPatterns.push(analyzeRow("upper", y, rowTiles(map, "upper", region, y)));
  }
  // 위→아래 순서(상위/하위 행을 y 기준으로 정렬)로 병합 목록을 만든다.
  const merged = [...mergeRows(upperPatterns), ...mergeRows(lowerPatterns)].sort((a, b) => a.y0 - b.y0 || (a.layer === "upper" ? -1 : 1));

  const grammar: TerrainTemplateGrammarRule[] = [];
  const rows: TerrainTemplateRow[] = [];
  const guessSummary: string[] = [];
  const rowSpans: TerrainTemplateDraftRowSpan[] = [];

  const kindKorean = (pattern: RowPattern): string => {
    if (pattern.sparse) return "장식·산재";
    return pattern.layer === "upper" ? "지붕/상부 행" : "벽/바닥 행";
  };

  merged.forEach((pattern, index) => {
    const role = roleNameFor(pattern, index);
    // mustTouch 초안: 같은 레이어에서 바로 위 구간(병합 행)의 역할.
    const abovePattern = merged
      .filter((candidate) => candidate.layer === pattern.layer && candidate.y1 === pattern.y0 - 1)
      .sort((a, b) => b.y1 - a.y1)[0];
    const mustTouch = !pattern.sparse && abovePattern && !abovePattern.sparse
      ? roleNameFor(abovePattern, merged.indexOf(abovePattern))
      : undefined;
    const meaning = `y=${pattern.y0}${pattern.y1 !== pattern.y0 ? `~${pattern.y1}` : ""} (${pattern.layer}) — ${patternText(tileset, pattern)}. (초안: 인터뷰로 의미를 확정하세요)`;
    grammar.push({
      kind: kindFor(pattern),
      role,
      layer: pattern.layer,
      ...(pattern.sparse
        ? { tiles: pattern.tiles }
        : { left: pattern.left, middle: pattern.middle, right: pattern.right }),
      meaning,
      ...(mustTouch ? { mustTouch } : {}),
    });
    rows.push({
      section: pattern.sparse ? "overlay" : `${pattern.layer}-row`,
      coord: `y=${pattern.y0}${pattern.y1 !== pattern.y0 ? `~${pattern.y1}` : ""}`,
      lower: pattern.layer === "lower" ? pattern.tiles : [],
      upper: pattern.layer === "upper" ? pattern.tiles : [],
      stack: [],
      meaning,
    });
    const heightNote = pattern.y1 !== pattern.y0 ? ` ×${pattern.y1 - pattern.y0 + 1}행 반복` : "";
    guessSummary.push(
      `${index + 1}. [${pattern.layer}${pattern.sparse ? "·산재" : ""}] y=${pattern.y0}${pattern.y1 !== pattern.y0 ? `~${pattern.y1}` : ""}: ${patternText(tileset, pattern)}${heightNote}${mustTouch ? ` — 바로 위는 ${mustTouch}` : ""}`
    );
    rowSpans.push({
      role,
      kind: kindFor(pattern),
      layer: pattern.layer,
      y0: pattern.y0,
      y1: pattern.y1,
      sparse: pattern.sparse,
      tiles: pattern.tiles,
      left: pattern.left,
      middle: pattern.middle,
      right: pattern.right,
      mustTouch,
      meaning,
      humanText: `${kindKorean(pattern)}${heightNote} — ${patternText(tileset, pattern)}`,
    });
  });

  return {
    name,
    sourceMapName: map.name,
    sourceRegion: { mapId: map.id, ...region },
    rows,
    grammar,
    rowSpans,
    rules: [
      `이 초안은 맵 '${map.name}' 영역 (${region.x},${region.y}) ${region.w}×${region.h}에서 추출되었다.`,
      "행별 추측(guessSummary)을 사용자에게 먼저 보여주고, 확인된 의미로 meaning을 다듬은 뒤 저장하라.",
    ],
    guessSummary,
  };
}
