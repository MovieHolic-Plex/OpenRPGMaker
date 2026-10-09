// editor/tools/v3/rowArrangement.ts
// 축 기반 줄 배치 (타일 툴 v3 — arrange_rows).
//
// 통로 하나를 두고 좌우(또는 상하)로 같은 줄이 반복되는 결정론적 격자 배치. 교회 신도석·
// 극장 좌석·강의실 책상·도서관 책장열·병영 침상이 전부 이 문법이다. 기존 시공 프리미티브에는
// 면 채우기(fill_region)와 랜덤 산포(place_props)만 있어서 "좌우로 줄지어 앉히는" 문법 자체가
// 없었다 — place_props 로는 좌표를 지정할 수 없고 fill_region 은 지형 그룹만 받는다.
//
// 핵심은 어휘 그룹에서 원자(atom)를 파생하는 것이다. patternGrammar 를 rect 에 그대로
// 전개하면(expandWall 방식) 깨진다 — 벤치(327|328)는 repeatBody 가 없어서 중간 칸이 leftCap
// 으로 폴백되고, hard adjacency 규칙(327 은 328 바로 왼쪽)을 위반한 327 327 327 328 이 나온다.
// 그래서 그룹을 "고정 크기 원자"와 "1×N 신축 원자"로 나눠 읽고, 줄은 원자를 반복해 채운다.
//
// 전부 순수 함수 + 결정론(RNG 없음). rmTypeExpander 는 파츠 타일이 여럿일 때 좌표 해시로
// 고르지만(자연 산포 규약), 줄 배치는 반복 규칙성이 핵심이라 언제나 파츠의 첫 타일을 쓴다.

import type { ClusterRule, TileGroupMetadata, TilesetDef } from "@/project/types";
import { ToolError } from "../types";
import type { Rect } from "./rmTypeExpander";

/** 통로가 뻗는 방향. 줄은 언제나 통로와 수직으로 놓인다. */
export type AisleAxis = "horizontal" | "vertical";

/** 통로 기준 어느 쪽 블록인지 — b 쪽이 symmetric 거울 교체 대상이다. */
export type RowSide = "a" | "b";

export interface RowAtomCell {
  readonly dx: number;
  readonly dy: number;
  readonly tile: number;
}

/** 크기가 고정된 원자 — 벤치(2×1)·세로 의자(1×2)·단독 의자(1×1)·반복 블록. */
export interface FixedRowAtom {
  readonly kind: "fixed";
  readonly w: number;
  readonly h: number;
  readonly cells: readonly RowAtomCell[];
  readonly shape: string;
}

/** 한 축으로 무한 신축하는 1×N 원자 — 탁자(234/235/236)·돌계단(111/112/113). */
export interface StretchRowAtom {
  readonly kind: "stretch";
  readonly axis: AisleAxis;
  readonly head: number;
  readonly body: number;
  readonly tail: number;
  readonly minLength: number;
  readonly shape: string;
}

export type RowAtom = FixedRowAtom | StretchRowAtom;

export interface RowLine {
  readonly rect: Rect;
  readonly side: RowSide;
}

export interface RowPlan {
  readonly lines: readonly RowLine[];
  readonly aisle: Rect | null;
  /** 줄이 뻗는 방향 = 통로 축과 수직. */
  readonly runAxis: AisleAxis;
  readonly thickness: number;
}

export interface RunCell {
  readonly x: number;
  readonly y: number;
  readonly tile: number;
}

export interface RunFill {
  /**
   * 원자 단위 묶음. 통행 보호 셀에 걸린 원자는 통째로 버려야 한다 — 벤치 2칸 중 한 칸만
   * 남기면 hard adjacency 규칙(327 은 328 바로 왼쪽)을 위반한 반쪽 벤치가 된다.
   */
  readonly units: readonly (readonly RunCell[])[];
  readonly cells: readonly RunCell[];
  /** 원자 크기로 나눠떨어지지 않아 비워둔 칸 수. */
  readonly leftover: number;
  readonly atoms: number;
}

type PatternGrammar = NonNullable<TileGroupMetadata["patternGrammar"]>;
type PartRole = PatternGrammar["parts"][number]["role"];
type ClusterRelation = "aAboveB" | "aBelowB" | "aLeftOfB" | "aRightOfB";

const AXIS_ROLES: Readonly<Record<AisleAxis, { head: readonly PartRole[]; tail: readonly PartRole[]; body: readonly PartRole[] }>> = {
  horizontal: { head: ["leftCap", "left"], tail: ["rightCap", "right"], body: ["repeatBody", "center"] },
  vertical: { head: ["top", "topCap"], tail: ["bottom", "bottomCap"], body: ["repeatBody", "center"] },
};

const SOURCE_RECT_ROLES: readonly (readonly [PartRole, number, number])[] = [
  ["topLeft", 0, 0],
  ["topRight", 1, 0],
  ["bottomLeft", 0, 1],
  ["bottomRight", 1, 1],
];

// 줄 배치를 지원하지 않는 문법 — 지형/건물 전용이라 다른 프리미티브로 안내한다.
const UNSUPPORTED_KIND_HINT: Readonly<Record<string, string>> = {
  animated_terrain: "애니메이션 지형(물)이라 면으로 채워야 합니다 — fill_region 을 쓰세요",
  autotile_3x3: "오토타일 지형이라 면으로 채워야 합니다 — 바닥은 fill_region, 길은 lay_path 를 쓰세요",
  nine_slice_expandable: "9분할 건물 어휘라 벽으로 세워야 합니다 — build_wall 을 쓰세요",
};

function partTile(group: TileGroupMetadata, role: PartRole): number | null {
  const tiles = group.patternGrammar?.parts.find((part) => part.role === role)?.tileIds ?? [];
  return tiles.length > 0 ? tiles[0] : null;
}

function firstRoleTile(group: TileGroupMetadata, roles: readonly PartRole[]): number | null {
  for (const role of roles) {
    const tile = partTile(group, role);
    if (tile !== null) return tile;
  }
  return null;
}

/**
 * 어휘 그룹 → 줄 배치 원자. axis/symmetric 은 방향 타일이 여럿인 그룹(탁자 옆 의자
 * 175/176/205/206)에서 어느 방향을 기본으로 쓸지 고르는 데만 쓴다.
 */
export function atomFromGroup(
  tileset: TilesetDef,
  group: TileGroupMetadata,
  options: { readonly axis: AisleAxis; readonly symmetric: boolean },
  example: Record<string, unknown>,
): RowAtom {
  const grammar = group.patternGrammar;
  if (!grammar || grammar.parts.length === 0) return singleAtom(tileset, group, options);
  switch (grammar.kind) {
    case "horizontal_expandable":
      return axisAtom(tileset, group, grammar, "horizontal", options);
    case "vertical_expandable":
      return axisAtom(tileset, group, grammar, "vertical", options);
    case "repeatable_block":
      return blockAtom(group, grammar, example);
    case "source_rect":
      return sourceRectAtom(tileset, group, options);
    case "single":
    case "overlay_detail":
    case "event_required_object":
      return singleAtom(tileset, group, options);
    default: {
      const hint = UNSUPPORTED_KIND_HINT[grammar.kind] ?? `'${grammar.kind}' 문법은 줄 배치를 지원하지 않습니다`;
      throw new ToolError(
        `'${group.name}'은(는) ${hint}. — 다시 보낼 형식 예시: ${JSON.stringify(example)}`,
        { code: "pattern-unsupported" },
      );
    }
  }
}

function axisAtom(
  tileset: TilesetDef,
  group: TileGroupMetadata,
  grammar: PatternGrammar,
  axis: AisleAxis,
  options: { readonly axis: AisleAxis; readonly symmetric: boolean },
): RowAtom {
  const roles = AXIS_ROLES[axis];
  const head = firstRoleTile(group, roles.head);
  const tail = firstRoleTile(group, roles.tail);
  const body = firstRoleTile(group, roles.body);
  const axisLabel = axis === "horizontal" ? "가로" : "세로";
  if (body !== null) {
    const minSpan = axis === "horizontal" ? grammar.minWidth : grammar.minHeight;
    return {
      kind: "stretch",
      axis,
      head: head ?? body,
      body,
      tail: tail ?? body,
      minLength: Math.max(minSpan ?? 3, 2),
      shape: `${axisLabel} 신축(양 끝 캡 + 본체 반복)`,
    };
  }
  // repeatBody 가 없다 = 캡만으로 이뤄진 고정 원자. 벤치 327|328, 세로 의자 358|388 이 여기.
  const caps = [head, tail].filter((tile): tile is number => tile !== null);
  if (caps.length === 0) return singleAtom(tileset, group, options);
  return {
    kind: "fixed",
    w: axis === "horizontal" ? caps.length : 1,
    h: axis === "horizontal" ? 1 : caps.length,
    cells: caps.map((tile, index) => ({
      dx: axis === "horizontal" ? index : 0,
      dy: axis === "horizontal" ? 0 : index,
      tile,
    })),
    shape: `${axisLabel} ${caps.length}칸 고정`,
  };
}

function blockAtom(group: TileGroupMetadata, grammar: PatternGrammar, example: Record<string, unknown>): RowAtom {
  const blockWidth = grammar.blockWidth ?? 0;
  const blockHeight = grammar.blockHeight ?? 0;
  const tiles = grammar.parts.find((part) => part.role === "repeatBody")?.tileIds ?? [];
  if (blockWidth < 1 || blockHeight < 1 || tiles.length !== blockWidth * blockHeight) {
    throw new ToolError(
      `'${group.name}' 반복 블록에는 blockWidth×blockHeight와 같은 수의 repeatBody 타일이 필요합니다. — 다시 보낼 형식 예시: ${JSON.stringify(example)}`,
      { code: "pattern-underspecified" },
    );
  }
  return {
    kind: "fixed",
    w: blockWidth,
    h: blockHeight,
    cells: tiles.map((tile, index) => ({ dx: index % blockWidth, dy: Math.floor(index / blockWidth), tile })),
    shape: `${blockWidth}×${blockHeight} 블록`,
  };
}

function sourceRectAtom(
  tileset: TilesetDef,
  group: TileGroupMetadata,
  options: { readonly axis: AisleAxis; readonly symmetric: boolean },
): RowAtom {
  const cells: RowAtomCell[] = [];
  for (const [role, dx, dy] of SOURCE_RECT_ROLES) {
    const tile = partTile(group, role);
    if (tile !== null) cells.push({ dx, dy, tile });
  }
  if (cells.length === 0) return singleAtom(tileset, group, options);
  return { kind: "fixed", w: 2, h: 2, cells, shape: "2×2 고정" };
}

function singleAtom(
  tileset: TilesetDef,
  group: TileGroupMetadata,
  options: { readonly axis: AisleAxis; readonly symmetric: boolean },
): RowAtom {
  const tiles = group.tileIds.filter((tile) => tile > 0);
  if (tiles.length === 0) {
    throw new ToolError(`'${group.name}'에 배치할 타일이 없습니다 — 어휘 카드에서 타일을 채워 주세요.`, {
      code: "pattern-underspecified",
    });
  }
  return {
    kind: "fixed",
    w: 1,
    h: 1,
    cells: [{ dx: 0, dy: 0, tile: preferredFacingTile(tileset, group, tiles, options) }],
    shape: "1칸",
  };
}

/**
 * 방향 타일이 섞인 그룹에서 기본 타일을 고른다. symmetric 이면 대칭축과 정합한 대립쌍의
 * 앞쪽(통로 쪽을 보는 타일)을 골라, 반대 블록이 거울 교체로 마주보게 만든다.
 */
function preferredFacingTile(
  tileset: TilesetDef,
  group: TileGroupMetadata,
  tiles: readonly number[],
  options: { readonly axis: AisleAxis; readonly symmetric: boolean },
): number {
  if (!options.symmetric) return tiles[0];
  for (const tile of tiles) {
    if (mirrorTile(tileset, group, tile, options.axis) !== null) return tile;
  }
  return tiles[0];
}

// 라벨 대립쌍 — 방향은 구조화 필드가 아니라 타일 라벨 문자열에만 있다(mirror_region 도
// 좌표만 반전하고 타일은 그대로 둔다). 라벨을 치환해 같은 그룹 안에서 완전 일치하는 타일을
// 찾고, 없으면 null 을 돌려 호출측이 원본을 유지하도록 한다.
//
// 키는 통로 축이고 값은 그 통로에서 블록이 갈리는 방향의 대립쌍이다 — 통로가 세로로
// 뻗으면(vertical) 줄이 좌우로 갈리므로 좌우 대립쌍을 쓴다.
const MIRROR_WORDS: Readonly<Record<AisleAxis, readonly (readonly [string, string])[]>> = {
  vertical: [["우향", "좌향"], ["오른", "왼"], ["right", "left"], ["동향", "서향"]],
  horizontal: [["앞모습", "뒷모습"], ["위쪽", "아래쪽"], ["up", "down"], ["북향", "남향"]],
};

function tileLabel(tileset: TilesetDef, tile: number): string {
  return tileset.tileMeta?.[tile]?.label ?? "";
}

/** 대칭축(axis)에 맞는 거울상 타일. 방향 구분이 없으면 null. */
export function mirrorTile(
  tileset: TilesetDef,
  group: TileGroupMetadata,
  tile: number,
  axis: AisleAxis,
): number | null {
  const label = tileLabel(tileset, tile);
  if (!label) return null;
  for (const [left, right] of MIRROR_WORDS[axis]) {
    for (const [from, to] of [[left, right], [right, left]] as const) {
      if (!label.includes(from)) continue;
      const target = label.split(from).join(to);
      const match = group.tileIds.find((candidate) => candidate !== tile && tileLabel(tileset, candidate) === target);
      if (match !== undefined) return match;
    }
  }
  return null;
}

/**
 * rect 를 통로 하나 + 줄 여러 개로 나눈다. axis 는 통로가 뻗는 방향이고, 줄은 통로와
 * 수직으로 놓여 통로 축을 따라 rowGap 간격으로 쌓인다. aisleWidth 0 이면 통로 없이 한 블록.
 */
export function planRows(
  rect: Rect,
  axis: AisleAxis,
  aisleWidth: number,
  rowGap: number,
  atom: RowAtom,
): RowPlan {
  const runAxis: AisleAxis = axis === "vertical" ? "horizontal" : "vertical";
  const thickness = rowThickness(atom, runAxis);
  // cross = 줄이 뻗는 축(통로와 수직), stack = 줄이 쌓이는 축(통로와 평행).
  const crossStart = axis === "vertical" ? rect.x : rect.y;
  const crossSize = axis === "vertical" ? rect.w : rect.h;
  const stackStart = axis === "vertical" ? rect.y : rect.x;
  const stackSize = axis === "vertical" ? rect.h : rect.w;

  const aisle = Math.min(Math.max(aisleWidth, 0), crossSize);
  const aisleStart = crossStart + Math.floor((crossSize - aisle) / 2);
  const blocks: { start: number; size: number; side: RowSide }[] = [];
  if (aisle <= 0) {
    blocks.push({ start: crossStart, size: crossSize, side: "a" });
  } else {
    const sizeA = aisleStart - crossStart;
    const sizeB = crossStart + crossSize - (aisleStart + aisle);
    if (sizeA > 0) blocks.push({ start: crossStart, size: sizeA, side: "a" });
    if (sizeB > 0) blocks.push({ start: aisleStart + aisle, size: sizeB, side: "b" });
  }

  const lines: RowLine[] = [];
  const step = thickness + Math.max(rowGap, 0);
  for (let stack = stackStart; stack + thickness <= stackStart + stackSize; stack += step) {
    for (const block of blocks) {
      lines.push({ rect: rectFor(axis, block.start, block.size, stack, thickness), side: block.side });
    }
  }
  return {
    lines,
    aisle: aisle > 0 ? rectFor(axis, aisleStart, aisle, stackStart, stackSize) : null,
    runAxis,
    thickness,
  };
}

function rectFor(axis: AisleAxis, crossStart: number, crossSize: number, stackStart: number, stackSize: number): Rect {
  return axis === "vertical"
    ? { x: crossStart, y: stackStart, w: crossSize, h: stackSize }
    : { x: stackStart, y: crossStart, w: stackSize, h: crossSize };
}

/** 줄 하나가 stack 축으로 차지하는 두께. 최소 1 — planRows 의 전진 폭이라 0이면 멈추지 않는다. */
export function rowThickness(atom: RowAtom, runAxis: AisleAxis): number {
  if (atom.kind === "stretch") return atom.axis === runAxis ? 1 : Math.max(atom.minLength, 1);
  return Math.max(runAxis === "horizontal" ? atom.h : atom.w, 1);
}

/** 줄 하나를 원자로 채운다. 원자 크기로 나눠떨어지지 않는 꼬리 칸은 비워 둔다. */
export function fillRun(atom: RowAtom, line: Rect, runAxis: AisleAxis): RunFill {
  const length = runAxis === "horizontal" ? line.w : line.h;
  if (length <= 0) return { units: [], cells: [], leftover: 0, atoms: 0 };
  if (atom.kind === "stretch" && atom.axis === runAxis) {
    if (length < atom.minLength) return { units: [], cells: [], leftover: length, atoms: 0 };
    // 신축 원자는 줄 전체가 캡+본체 한 덩어리다 — 부분 배치가 무의미하므로 단위도 하나.
    const unit: RunCell[] = [];
    for (let step = 0; step < length; step += 1) {
      const tile = step === 0 ? atom.head : step === length - 1 ? atom.tail : atom.body;
      unit.push(runCell(line, runAxis, step, 0, tile));
    }
    return { units: [unit], cells: unit, leftover: 0, atoms: 1 };
  }
  const span = atom.kind === "stretch" ? 1 : runAxis === "horizontal" ? atom.w : atom.h;
  const count = Math.floor(length / span);
  const units: RunCell[][] = [];
  for (let index = 0; index < count; index += 1) {
    const base = index * span;
    const unit: RunCell[] = [];
    if (atom.kind === "stretch") {
      // 신축 축이 줄 방향과 어긋난다 — 원자를 최소 길이의 교차축 런으로 세워 나란히 놓는다.
      for (let depth = 0; depth < atom.minLength; depth += 1) {
        const tile = depth === 0 ? atom.head : depth === atom.minLength - 1 ? atom.tail : atom.body;
        unit.push(runCell(line, runAxis, base, depth, tile));
      }
    } else {
      for (const cell of atom.cells) {
        const along = runAxis === "horizontal" ? cell.dx : cell.dy;
        const across = runAxis === "horizontal" ? cell.dy : cell.dx;
        unit.push(runCell(line, runAxis, base + along, across, cell.tile));
      }
    }
    units.push(unit);
  }
  return { units, cells: units.flat(), leftover: length - count * span, atoms: count };
}

function runCell(line: Rect, runAxis: AisleAxis, along: number, across: number, tile: number): RunCell {
  return runAxis === "horizontal"
    ? { x: line.x + along, y: line.y + across, tile }
    : { x: line.x + across, y: line.y + along, tile };
}

const RELATION_DELTA: Readonly<Record<ClusterRelation, readonly [number, number]>> = {
  aAboveB: [0, 1],
  aBelowB: [0, -1],
  aLeftOfB: [1, 0],
  aRightOfB: [-1, 0],
};

function integerParam(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function relationParam(value: unknown): ClusterRelation | null {
  return value === "aAboveB" || value === "aBelowB" || value === "aLeftOfB" || value === "aRightOfB" ? value : null;
}

function hardAdjacencyRules(group: TileGroupMetadata): readonly ClusterRule[] {
  return (group.rules ?? []).filter((rule) => rule.kind === "adjacency" && rule.strength === "hard");
}

/**
 * 배치 결과가 그룹의 hard adjacency 규칙을 지키는지 정적으로 검사한다. 벤치를 임의 길이로
 * 늘리는 회귀(327 327 327 328)를 이 검사가 잡는다. 위반이 없으면 null.
 */
export function hardAdjacencyViolation(group: TileGroupMetadata, cells: readonly RunCell[]): string | null {
  const rules = hardAdjacencyRules(group);
  if (rules.length === 0) return null;
  const byKey = new Map(cells.map((cell) => [`${cell.x},${cell.y}`, cell.tile] as const));
  for (const rule of rules) {
    const a = integerParam(rule.params.a);
    const b = integerParam(rule.params.b);
    const relation = relationParam(rule.params.relation);
    if (a === null || b === null || relation === null) continue;
    const allowed = new Set<number>([b]);
    if (Array.isArray(rule.params.bAlt)) {
      for (const alt of rule.params.bAlt) {
        const value = integerParam(alt);
        if (value !== null) allowed.add(value);
      }
    }
    const [dx, dy] = RELATION_DELTA[relation];
    for (const cell of cells) {
      if (cell.tile !== a) continue;
      const companion = byKey.get(`${cell.x + dx},${cell.y + dy}`);
      if (companion === undefined || !allowed.has(companion)) {
        return rule.message
          ?? `'${group.name}' hard 규칙 ${rule.id} 위반: (${cell.x},${cell.y}) 타일 ${a} 의 동반 타일 ${b} 가 없습니다.`;
      }
    }
  }
  return null;
}
