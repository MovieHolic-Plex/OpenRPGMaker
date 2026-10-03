// 조수가 큰 변경(새 마을 맵 등)을 적용한 직후 맵 위에서 재생하는 「밑그림 시공」 계획.
//
// 왜(2026-10-03 사용자): 「마을 만들어 줘」는 도구 한 번(author_beodeul_town)이 맵 전체를 짓고 체크포인트 하나로
// 적용된다 — 화면에는 완성본이 한 번에 「짠」 하고 떴다. 예전(09-21)에는 밑그림을 먼저 긋고 연필이 칸을 착착 까는
// 고스트 공개가 있었는데, 실시간 적용(#1130) 뒤로 그 공개가 no-op 이 되어 사라졌다. 사용자는 화려한 효과가 아니라
// 그 「계획적으로 착착 까는」 모습을 원했다.
//
// 적용은 늦추지 않는다(다음 도구·체크포인트 ACK 를 잡지 않는다). 실제 칸은 이미 스토어에 있고, 그 위를 빈 종이로
// 덮었다가 ① 밑그림(길 자국·집 자리 테두리를 한 채씩) → ② 연필이 왼쪽에서 오른쪽으로 바닥·길·물·나무를 깐다
// → ③ 집을 읽는 순서(위→아래, 왼→오른)로 한 채씩 놓는다. 이 파일은 순수 계획과 요청 버스만 둔다.
// 그리기는 `agentConstructionRevealRenderer.ts`. 연출은 저장·적용 증거가 아니다.

import type { GameMap, MapId, TilesetDef } from "@/project/types";

/** sweep = 연필이 지나가며 까는 칸, building = 한 채씩 놓는 집 칸. */
export type ConstructionPhase = "sweep" | "building";

export interface ConstructionRevealCell {
  /** y*width+x */
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly phase: ConstructionPhase;
  /** 연출 시작부터 이 칸의 종이가 걷히는 시각(ms). */
  readonly at: number;
  /** 밑그림에 길·물 자국으로 미리 표시할 칸인가. */
  readonly sketch?: "road" | "water";
}

export interface ConstructionRevealBuilding {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** 밑그림 단계에서 이 집 자리 테두리가 그어지는 시각. */
  readonly sketchAt: number;
  /** 이 집이 놓이는 시각. */
  readonly at: number;
}

export interface ConstructionRevealPlan {
  readonly mapId: MapId;
  readonly width: number;
  readonly height: number;
  readonly cells: readonly ConstructionRevealCell[];
  readonly buildings: readonly ConstructionRevealBuilding[];
  /** 연필 바닥 깔기 구간. */
  readonly sweepStartMs: number;
  readonly sweepEndMs: number;
  /** 마지막 칸이 걷히고 잠깐 머무른 뒤 끝나는 시각(ms). */
  readonly durationMs: number;
  readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

/** 이보다 적게 바뀌면 연출하지 않는다 — 몇 칸 고치기는 기존 「✓ 반영됨」 강조로 충분하다. */
export const CONSTRUCTION_REVEAL_MIN_CELLS = 48;
/** 칸 하나의 종이가 걷히는 시간(예전 고스트의 내려앉기와 같은 220ms). */
export const CONSTRUCTION_CELL_FADE_MS = 220;
/** 밑그림(집 자리 테두리를 한 채씩 긋기) 구간. 예전 청사진은 구역마다 120ms 간격이었다. */
const SKETCH_MS = 900;
const SKETCH_STEP_MAX_MS = 120;
/** 연필 바닥 깔기 — 예전 와이프 1.8초, 넓은 맵은 조금 더 천천히. */
const SWEEP_MIN_MS = 1800;
const SWEEP_MAX_MS = 3000;
const BUILD_GAP_MS = 200;
/** 집 한 채 놓는 간격 상한과 집 단계 전체 상한. */
const BUILDING_STEP_MAX_MS = 220;
const BUILDING_SPAN_MAX_MS = 3200;
/** 예전 고스트 공개 뒤 머무름(GHOST_WIPE_HOLD_MS). */
const FINISH_HOLD_MS = 450;

const WATER_TAGS = new Set(["water", "lava", "bog"]);
const ROAD_TAGS = new Set(["road", "plaza", "bridge", "stair", "gate", "pier", "sand", "path"]);

function tagsOf(tileset: TilesetDef | undefined, tile: number | undefined): readonly string[] {
  if (!tileset || tile === undefined || tile < 0) return [];
  return tileset.tileMeta?.[tile]?.tags ?? [];
}

function layerAt(layer: readonly number[] | undefined, index: number): number {
  return layer?.[index] ?? -1;
}

function stackKey(stacks: Record<number, number[]> | undefined, index: number): string {
  const stack = stacks?.[index];
  return stack && stack.length ? stack.join(",") : "";
}

/** 칸 하나가 이번 적용에서 바뀌었는가. 크기가 다르거나 새 맵이면 모든 칸이 새 칸이다. */
function cellChanged(before: GameMap | undefined, after: GameMap, index: number): boolean {
  if (!before || before.width !== after.width || before.height !== after.height) return true;
  return before.lowerTiles[index] !== after.lowerTiles[index]
    || before.upperTiles[index] !== after.upperTiles[index]
    || layerAt(before.lowerOverlayTiles, index) !== layerAt(after.lowerOverlayTiles, index)
    || layerAt(before.upperOverlayTiles, index) !== layerAt(after.upperOverlayTiles, index)
    || stackKey(before.lowerTileStacks, index) !== stackKey(after.lowerTileStacks, index)
    || stackKey(before.upperTileStacks, index) !== stackKey(after.upperTileStacks, index);
}

/**
 * 적용 전/후 맵 → 밑그림 시공 계획. 바뀐 칸이 적으면 null.
 * 집 자리(이번에 새로 생긴 structurePlacements) 칸은 그 집이 놓일 때 바닥과 함께 드러난다.
 */
export function planConstructionReveal(
  before: GameMap | undefined,
  after: GameMap,
  tileset: TilesetDef | undefined,
): ConstructionRevealPlan | null {
  const { width, height } = after;
  if (width <= 0 || height <= 0) return null;
  const changed: number[] = [];
  for (let i = 0; i < width * height; i++) if (cellChanged(before, after, i)) changed.push(i);
  if (changed.length < CONSTRUCTION_REVEAL_MIN_CELLS) return null;
  const changedSet = new Set(changed);

  const beforePlacementIds = new Set((before?.structurePlacements ?? []).map(p => p.id));
  const rects = (after.structurePlacements ?? [])
    .filter(p => !beforePlacementIds.has(p.id))
    .map(p => ({ x: Math.max(0, p.x), y: Math.max(0, p.y), w: Math.min(p.w, width - Math.max(0, p.x)), h: Math.min(p.h, height - Math.max(0, p.y)) }))
    .filter(r => r.w > 0 && r.h > 0)
    // 읽는 순서: 위 → 아래, 같은 줄이면 왼 → 오른. 「계획대로 차례차례」.
    .sort((a, b) => (a.y + a.h) - (b.y + b.h) || a.x - b.x);
  const buildingOf = new Map<number, number>();
  rects.forEach((r, b) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const i = y * width + x;
      if (changedSet.has(i) && !buildingOf.has(i)) buildingOf.set(i, b);
    }
  });
  const used = [...new Set(buildingOf.values())].sort((a, b) => a - b);

  const sketchStep = used.length ? Math.min(SKETCH_STEP_MAX_MS, SKETCH_MS / used.length) : 0;
  const sweepStartMs = used.length ? Math.round(SKETCH_MS * 0.6 + used.length * sketchStep * 0.4) : 300;
  let minX = width, maxX = -1, minY = height, maxY = -1;
  for (const i of changed) {
    const x = i % width, y = Math.floor(i / width);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const spanCols = Math.max(1, maxX - minX);
  const sweepMs = Math.round(Math.min(SWEEP_MAX_MS, Math.max(SWEEP_MIN_MS, spanCols * 28)));
  const sweepEndMs = sweepStartMs + sweepMs;
  const buildStartMs = sweepEndMs + BUILD_GAP_MS;
  const buildStep = used.length > 1 ? Math.min(BUILDING_STEP_MAX_MS, BUILDING_SPAN_MAX_MS / (used.length - 1)) : 0;
  const buildingAt = new Map<number, number>();
  const sketchAt = new Map<number, number>();
  used.forEach((b, n) => {
    sketchAt.set(b, Math.round(n * sketchStep));
    buildingAt.set(b, Math.round(buildStartMs + n * buildStep));
  });

  const cells: ConstructionRevealCell[] = [];
  let last = 0;
  for (const i of changed) {
    const x = i % width, y = Math.floor(i / width);
    const b = buildingOf.get(i);
    if (b !== undefined) {
      const at = buildingAt.get(b)!;
      last = Math.max(last, at);
      cells.push({ index: i, x, y, phase: "building", at });
      continue;
    }
    // 예전 와이프처럼 열 단위로 왼쪽에서 오른쪽 — 같은 열 안에서는 위에서 아래로 살짝 늦게.
    const at = Math.round(sweepStartMs + ((x - minX) / spanCols) * sweepMs + (y - minY) / Math.max(1, maxY - minY) * 90);
    last = Math.max(last, at);
    const overlay = layerAt(after.lowerOverlayTiles, i);
    const tags = [...tagsOf(tileset, after.lowerTiles[i]), ...tagsOf(tileset, overlay)];
    const sketch = tags.some(t => WATER_TAGS.has(t)) ? "water" as const : tags.some(t => ROAD_TAGS.has(t)) ? "road" as const : undefined;
    cells.push({ index: i, x, y, phase: "sweep", at, ...(sketch ? { sketch } : {}) });
  }
  cells.sort((a, b) => a.at - b.at);
  const buildings = used.map(b => ({ ...rects[b]!, sketchAt: sketchAt.get(b)!, at: buildingAt.get(b)! }));
  return {
    mapId: after.id,
    width,
    height,
    cells,
    buildings,
    sweepStartMs,
    sweepEndMs,
    durationMs: last + CONSTRUCTION_CELL_FADE_MS + FINISH_HOLD_MS,
    bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
  };
}

// ── 요청 버스 ── 씬(EditScene)이 구독한다. agentFocus 와 같은 모양이다.

type Listener = (plan: ConstructionRevealPlan) => void;
const listeners = new Set<Listener>();

export function subscribeAgentConstructionReveal(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 구독자가 있으면 true — 없으면(헤드리스·테스트) 호출부가 기존 강조로 돌아간다. */
export function requestAgentConstructionReveal(plan: ConstructionRevealPlan): boolean {
  if (!listeners.size) return false;
  for (const listener of listeners) listener(plan);
  return true;
}
