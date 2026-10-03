// 조수가 큰 변경(새 마을 맵 등)을 적용한 직후 맵 위에서 재생하는 「시공 연출」의 계획.
//
// 왜(2026-10-03 사용자): 「마을 만들어 줘」는 도구 한 번(author_beodeul_town)이 맵 전체를 짓고 체크포인트 하나로
// 적용된다 — 실제 칸은 이미 스토어에 있고, 화면에는 완성본이 한 번에 「짠」 하고 뜬다. 사용자는 바로바로 깔리는 것을
// 화려하게 보고 싶어 했다. 적용을 늦추지 않고(다음 도구·체크포인트 ACK 를 잡지 않는다) 덮개만 씌웠다가
// 바닥 → 물 → 길 → 건물 → 나무·소품 → 이벤트 순으로 걷어 «지어지는» 모습을 보여 준다.
//
// 이 파일은 순수 계획(칸 → 단계·시각)과 요청 버스만 둔다. 그리기는 `agentConstructionRevealRenderer.ts`.
// 연출은 저장·적용 증거가 아니다 — 덮개 아래 칸은 이미 적용된 실제 칸이다.

import type { GameMap, MapId, TilesetDef } from "@/project/types";

export type ConstructionPhase = "ground" | "water" | "road" | "building" | "detail" | "event";

export const CONSTRUCTION_PHASES: readonly ConstructionPhase[] = ["ground", "water", "road", "building", "detail", "event"];

export interface ConstructionRevealCell {
  /** y*width+x */
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly phase: ConstructionPhase;
  /** 연출 시작부터 이 칸의 덮개가 걷히기 시작하는 시각(ms). */
  readonly at: number;
}

export interface ConstructionRevealBuilding {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly at: number;
}

/** 덮개 없이 빛만 내는 자리 — 나무·소품은 바닥과 같이 드러나고, 소품 단계에서 반짝임으로 「돋는다」. */
export interface ConstructionRevealSparkle {
  readonly x: number;
  readonly y: number;
  readonly at: number;
}

export interface ConstructionRevealPlan {
  readonly mapId: MapId;
  readonly width: number;
  readonly height: number;
  readonly cells: readonly ConstructionRevealCell[];
  readonly buildings: readonly ConstructionRevealBuilding[];
  readonly sparkles: readonly ConstructionRevealSparkle[];
  /** 마지막 칸이 걷히고 마무리 빛이 끝나는 시각(ms). */
  readonly durationMs: number;
  readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly phaseStartMs: Readonly<Record<ConstructionPhase, number>>;
}

/** 이보다 적게 바뀌면 연출하지 않는다 — 몇 칸 고치기는 기존 「✓ 반영됨」 강조로 충분하다. */
export const CONSTRUCTION_REVEAL_MIN_CELLS = 48;
/** 덮개 한 칸이 걷히는 데 걸리는 시간. */
export const CONSTRUCTION_CELL_FADE_MS = 220;
/** 시작 직후 청사진 위를 훑는 빛줄기 시간. 바닥은 이 빛이 지나간 뒤 깔린다. */
export const CONSTRUCTION_SCAN_MS = 520;
const PHASE_SPAN_MS: Readonly<Record<ConstructionPhase, number>> = {
  ground: 900, water: 750, road: 1200, building: 1600, detail: 900, event: 300,
};
const PHASE_GAP_MS = 120;
const BUILDING_STAGGER_MAX_MS = 140;
const FINISH_HOLD_MS = 650;

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

function upperChanged(before: GameMap | undefined, after: GameMap, index: number): boolean {
  const upper = after.upperTiles[index] ?? 0;
  const overlay = layerAt(after.upperOverlayTiles, index);
  const stack = stackKey(after.upperTileStacks, index);
  const hasUpper = upper > 0 || overlay >= 0 || stack !== "";
  if (!hasUpper) return false;
  if (!before || before.width !== after.width || before.height !== after.height) return true;
  return before.upperTiles[index] !== upper || layerAt(before.upperOverlayTiles, index) !== overlay
    || stackKey(before.upperTileStacks, index) !== stack;
}

/** 결정적인 흩뿌림 순서 — 같은 맵은 매번 같은 순서로 반짝인다. */
function scatter(index: number): number {
  let h = (index + 1) * 2654435761;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** 집합 안에서 8방향 BFS 깊이. 씨앗은 맵 가장자리 칸(없으면 첫 칸). 덩이마다 따로 흐른다. */
function floodDepth(set: ReadonlySet<number>, width: number, height: number): Map<number, number> {
  const depth = new Map<number, number>();
  const order = [...set].sort((a, b) => a - b);
  const onEdge = (i: number) => {
    const x = i % width, y = Math.floor(i / width);
    return x === 0 || y === 0 || x === width - 1 || y === height - 1;
  };
  const seedsFor = (start: number): number[] => {
    // 이 덩이의 가장자리 칸을 씨앗으로 — 길은 맵 밖에서 들어오고, 강은 가장자리에서 흘러든다.
    const comp: number[] = [];
    const seen = new Set<number>([start]);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head]!;
      comp.push(i);
      for (const n of neighbours(i, width, height)) if (set.has(n) && !seen.has(n)) { seen.add(n); queue.push(n); }
    }
    const edge = comp.filter(onEdge);
    return edge.length ? edge : [comp.reduce((a, b) => Math.min(a, b))];
  };
  for (const start of order) {
    if (depth.has(start)) continue;
    const seeds = seedsFor(start);
    const queue: number[] = [];
    for (const s of seeds) { depth.set(s, 0); queue.push(s); }
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head]!;
      const d = depth.get(i)!;
      for (const n of neighbours(i, width, height)) {
        if (!set.has(n) || depth.has(n)) continue;
        depth.set(n, d + 1);
        queue.push(n);
      }
    }
  }
  return depth;
}

function neighbours(i: number, width: number, height: number): number[] {
  const x = i % width, y = Math.floor(i / width);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < width && ny < height) out.push(ny * width + nx);
  }
  return out;
}

/**
 * 적용 전/후 맵 → 시공 연출 계획. 바뀐 칸이 적으면 null.
 * 칸 하나의 덮개는 그 칸에서 가장 늦게 드러날 층의 단계에 걷힌다(집이 설 칸은 집이 내려앉을 때 바닥과 같이 드러난다).
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

  // 건물: 이번에 새로 생긴 배치(새 맵이면 전부)만. 덮인 칸이 하나라도 있어야 연출한다.
  const beforePlacementIds = new Set((before?.structurePlacements ?? []).map(p => p.id));
  const buildingRects = (after.structurePlacements ?? [])
    .filter(p => !beforePlacementIds.has(p.id))
    .map(p => ({ x: Math.max(0, p.x), y: Math.max(0, p.y), w: Math.min(p.w, width - Math.max(0, p.x)), h: Math.min(p.h, height - Math.max(0, p.y)) }))
    .filter(r => r.w > 0 && r.h > 0);
  const buildingOf = new Map<number, number>();
  buildingRects.forEach((r, b) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const i = y * width + x;
      if (changedSet.has(i) && !buildingOf.has(i)) buildingOf.set(i, b);
    }
  });

  const phaseOf = new Map<number, ConstructionPhase>();
  const eventCells = new Set<number>();
  const beforeEvents = new Map((before?.events ?? []).map(e => [e.id, JSON.stringify(e)]));
  for (const event of after.events) {
    if (beforeEvents.get(event.id) === JSON.stringify(event)) continue;
    if (event.x < 0 || event.y < 0 || event.x >= width || event.y >= height) continue;
    eventCells.add(event.y * width + event.x);
  }
  for (const i of changed) {
    if (buildingOf.has(i)) { phaseOf.set(i, "building"); continue; }
    if (eventCells.has(i) && !upperChanged(before, after, i)) { phaseOf.set(i, "event"); continue; }
    if (upperChanged(before, after, i)) { phaseOf.set(i, "detail"); continue; }
    const overlay = layerAt(after.lowerOverlayTiles, i);
    const tags = [...tagsOf(tileset, after.lowerTiles[i]), ...tagsOf(tileset, overlay)];
    if (tags.some(t => WATER_TAGS.has(t))) phaseOf.set(i, "water");
    else if (tags.some(t => ROAD_TAGS.has(t))) phaseOf.set(i, "road");
    else phaseOf.set(i, "ground");
  }

  const byPhase = new Map<ConstructionPhase, number[]>();
  for (const [i, phase] of phaseOf) {
    const list = byPhase.get(phase) ?? [];
    list.push(i);
    byPhase.set(phase, list);
  }

  // 단계 시작 시각 — 빈 단계는 시간을 쓰지 않는다.
  const phaseStartMs = {} as Record<ConstructionPhase, number>;
  let clock = CONSTRUCTION_SCAN_MS * 0.6;
  const spans = new Map<ConstructionPhase, number>();
  for (const phase of CONSTRUCTION_PHASES) {
    phaseStartMs[phase] = clock;
    const count = byPhase.get(phase)?.length ?? 0;
    if (!count) { spans.set(phase, 0); continue; }
    const span = phase === "building"
      ? Math.min(PHASE_SPAN_MS.building, Math.max(1, buildingRects.length - 1) * BUILDING_STAGGER_MAX_MS)
      : Math.min(PHASE_SPAN_MS[phase], 200 + count * 6);
    spans.set(phase, span);
    clock += span + PHASE_GAP_MS;
  }

  const cx = (width - 1) / 2, cy = (height - 1) / 2;
  const maxRadius = Math.hypot(cx, cy) || 1;
  const timeOf = new Map<number, number>();
  const spread = (phase: ConstructionPhase, list: number[], key: (i: number) => number) => {
    const span = spans.get(phase) ?? 0;
    const keys = list.map(key);
    const max = Math.max(...keys, 0) || 1;
    list.forEach((i, n) => timeOf.set(i, phaseStartMs[phase] + (keys[n]! / max) * span));
  };
  // 바닥: 가운데서 바깥으로 번진다.
  const ground = byPhase.get("ground") ?? [];
  spread("ground", ground, i => Math.hypot((i % width) - cx, Math.floor(i / width) - cy) / maxRadius + scatter(i) * 0.08);
  // 물·길: 가장자리에서 흘러들어 이어진다(BFS 깊이).
  for (const phase of ["water", "road"] as const) {
    const list = byPhase.get(phase) ?? [];
    if (!list.length) continue;
    const depth = floodDepth(new Set(list), width, height);
    spread(phase, list, i => depth.get(i) ?? 0);
  }
  // 건물: 가운데에 가까운 집부터 한 채씩 내려앉는다.
  const buildingOrder = buildingRects
    .map((r, b) => ({ b, d: Math.hypot(r.x + r.w / 2 - cx, r.y + r.h / 2 - cy) }))
    .sort((a, b) => a.d - b.d);
  const buildingAt = new Map<number, number>();
  const buildingSpan = spans.get("building") ?? 0;
  buildingOrder.forEach(({ b }, n) => {
    buildingAt.set(b, phaseStartMs.building + (buildingOrder.length > 1 ? (n / (buildingOrder.length - 1)) * buildingSpan : 0));
  });
  for (const i of byPhase.get("building") ?? []) timeOf.set(i, buildingAt.get(buildingOf.get(i)!) ?? phaseStartMs.building);
  // 나무·소품·이벤트: 흩뿌려 톡톡 돋는다.
  spread("detail", byPhase.get("detail") ?? [], scatter);
  spread("event", byPhase.get("event") ?? [], scatter);
  // 나무·소품 칸의 덮개는 바닥과 같이 걷는다 — 소품 단계까지 덮어 두면 바닥 단계 내내 맵이 남색 점으로 얽어 보였다
  // (2026-10-03 화면 확인). 그 칸은 소품 단계에 반짝임만 받는다.
  const sparkles: ConstructionRevealSparkle[] = [];
  for (const i of byPhase.get("detail") ?? []) {
    const x = i % width, y = Math.floor(i / width);
    sparkles.push({ x, y, at: Math.round(timeOf.get(i) ?? 0) });
    const groundAt = phaseStartMs.ground + (Math.hypot(x - cx, y - cy) / maxRadius + scatter(i) * 0.08) * (spans.get("ground") || PHASE_SPAN_MS.ground);
    timeOf.set(i, Math.min(timeOf.get(i) ?? groundAt, groundAt));
  }
  sparkles.sort((a, b) => a.at - b.at);

  let minX = width, minY = height, maxX = -1, maxY = -1, last = 0;
  const cells: ConstructionRevealCell[] = [];
  for (const i of changed) {
    const x = i % width, y = Math.floor(i / width);
    const at = Math.round(timeOf.get(i) ?? 0);
    last = Math.max(last, at);
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    // 나무·소품 칸은 덮개를 바닥과 같이 걷으므로 덮개 빛도 바닥 색이다. 소품 빛은 sparkles 가 따로 낸다.
    const phase = phaseOf.get(i)!;
    cells.push({ index: i, x, y, phase: phase === "detail" ? "ground" : phase, at });
  }
  cells.sort((a, b) => a.at - b.at);
  const usedBuildings = new Set(buildingOf.values());
  const buildings = buildingOrder
    .filter(({ b }) => usedBuildings.has(b))
    .map(({ b }) => ({ ...buildingRects[b]!, at: Math.round(buildingAt.get(b) ?? phaseStartMs.building) }));
  return {
    mapId: after.id,
    width,
    height,
    cells,
    buildings,
    sparkles,
    durationMs: Math.max(last, sparkles.at(-1)?.at ?? 0) + CONSTRUCTION_CELL_FADE_MS + FINISH_HOLD_MS,
    bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    phaseStartMs,
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
