// 맵 증분(고스트 재료). 워커가 툴마다 «바뀐 칸만» 보내고 브라우저가 초안 맵을 복원한다.
//
// 왜 필요한가 (2026-09-17): Pi 경로는 루프가 Bun 워커에 있고 결과 프로젝트가 **맨 끝 `done`
// 에만** 실린다. 그래서 base↔초안 diff 로 굴러가던 캔버스 시공 표시(고스트)가 턴 내내 먹을
// 재료가 없었다 — 조수 채팅이 Pi 로 이사한 뒤 「AI 가 실시간으로 맵에 뭘 까는 게」 통째로
// 안 보였던 이유다. 고스트 기계 자체는 멀쩡했다.
//
// 왜 맵만인가: 고스트가 읽는 면은 타일 층·스택·이벤트·맵 크기뿐이다(agentGhostPreview
// 의 mapDiffPreview). 최상위 키를 통째로 나르는 설계는 실측으로 기각됐다 — tilesets 1,501 KB ·
// database 485 KB 로 툴 한 번에 0.5~1.5 MB 다. 맵 밖 변경(데이터베이스·퀘스트·스위치)은
// 캔버스에 그릴 자리가 없으므로 여기 담지 않는다.
//
// 인코딩: 바뀐 칸이 층의 일부면 칸 목록(`cells`), 너무 많으면 층 배열을 통째로(`full`).
// 칸 하나는 JSON 으로 약 16바이트이고 배열 한 칸은 약 2바이트라, 8분의 1을 넘으면 통째가 싸다.
//
// 층: 1층(lower)·3층(upper)은 늘 있다. 2층(layer2)·4층(layer4)·그림자(shadow)는 선택 칸이라(mapLayers.ts)
// 두 맵 어느 쪽에도 없으면 증분에 층 항목이 아예 없다 — 옛 맵의 증분은 이 층들이 생기기 전과 JSON 이 같다.
// 선택 칸이 사라지면(compactMapLayers) `absent: true` 로 알린다.

import type { GameEvent, GameMap, MapId } from "@/project/types";
import { cropExtraLayers } from "@/project/mapLayers";

export type PiMapDeltaLayer = "lower" | "upper" | "layer2" | "layer4" | "shadow";
type ExtraDeltaLayer = Exclude<PiMapDeltaLayer, "lower" | "upper">;

/** 칸 하나: `i` = y*width+x, `t` = 타일 id. */
export interface PiMapCellDelta {
  readonly i: number;
  readonly t: number;
}

/** 스택 하나: `s` 가 null 이면 그 칸의 스택이 사라졌다는 뜻. */
export interface PiMapStackDelta {
  readonly i: number;
  readonly s: readonly number[] | null;
}

export interface PiMapLayerDelta {
  readonly layer: PiMapDeltaLayer;
  /** 바뀐 칸만. `full` 이 있으면 없다. */
  readonly cells?: readonly PiMapCellDelta[];
  /** 층 배열 전체 — 크기가 바뀌었거나 변경이 너무 많을 때. */
  readonly full?: readonly number[];
  readonly stacks?: readonly PiMapStackDelta[];
  /** 선택 층(2·4층·그림자)이 맵에서 사라졌다 — 적용하면 키를 지운다. 다른 필드는 없다. */
  readonly absent?: true;
}

/** 맵 뼈대. 새 맵이거나 크기·타일셋이 바뀌었을 때만 실린다. */
export interface PiMapShapeDelta {
  readonly width: number;
  readonly height: number;
  readonly tilesetId: string;
  readonly tileSize: number;
  readonly name: string;
}

export interface PiMapDelta {
  readonly mapId: string;
  /** 맵이 사라졌다. 다른 필드는 없다. */
  readonly removed?: true;
  readonly shape?: PiMapShapeDelta;
  readonly layers?: readonly PiMapLayerDelta[];
  readonly events?: {
    readonly upserts?: readonly GameEvent[];
    readonly removed?: readonly string[];
  };
}

/** 칸 목록 대신 층 배열을 통째로 보내는 문턱 — 층의 이 비율을 넘으면 통째가 더 싸다. */
const FULL_LAYER_RATIO = 1 / 8;

type MapsRecord = Readonly<Record<string, GameMap>>;

const EXTRA_DELTA_LAYERS: readonly ExtraDeltaLayer[] = ["layer2", "layer4", "shadow"];

function extraKey(layer: ExtraDeltaLayer): "lowerOverlayTiles" | "upperOverlayTiles" | "shadowBits" {
  return layer === "layer2" ? "lowerOverlayTiles" : layer === "layer4" ? "upperOverlayTiles" : "shadowBits";
}

/** 선택 층의 빈칸 값 — 타일 층은 -1, 그림자는 0(mapLayers.ts 와 같다). */
function extraEmpty(layer: ExtraDeltaLayer): number {
  return layer === "shadow" ? 0 : -1;
}

function layerTiles(map: GameMap, layer: "lower" | "upper"): readonly number[] {
  return (layer === "lower" ? map.lowerTiles : map.upperTiles) ?? [];
}

function layerStacks(map: GameMap, layer: "lower" | "upper"): Record<number, number[]> | undefined {
  return layer === "lower" ? map.lowerTileStacks : map.upperTileStacks;
}

function sameStack(a: readonly number[] | undefined, b: readonly number[] | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function sameShape(before: GameMap, after: GameMap): boolean {
  return before.width === after.width
    && before.height === after.height
    && before.tilesetId === after.tilesetId
    && before.tileSize === after.tileSize
    && before.name === after.name;
}

function shapeOf(map: GameMap): PiMapShapeDelta {
  return { width: map.width, height: map.height, tilesetId: map.tilesetId, tileSize: map.tileSize, name: map.name };
}

function stacksDelta(before: GameMap | null, after: GameMap, layer: "lower" | "upper"): PiMapStackDelta[] {
  const beforeStacks = before ? layerStacks(before, layer) : undefined;
  const afterStacks = layerStacks(after, layer);
  if (!beforeStacks && !afterStacks) return [];
  const indices = new Set<number>();
  for (const key of Object.keys(beforeStacks ?? {})) indices.add(Number(key));
  for (const key of Object.keys(afterStacks ?? {})) indices.add(Number(key));
  const out: PiMapStackDelta[] = [];
  for (const index of indices) {
    const a = beforeStacks?.[index];
    const b = afterStacks?.[index];
    if (sameStack(a, b)) continue;
    out.push({ i: index, s: b ? [...b] : null });
  }
  return out;
}

function layerDelta(before: GameMap | null, after: GameMap, layer: "lower" | "upper"): PiMapLayerDelta | null {
  const afterTiles = layerTiles(after, layer);
  const stacks = stacksDelta(before, after, layer);
  // 크기가 달라지면 인덱스 의미가 바뀐다 — 칸 목록으로는 복원할 수 없으니 통째로 보낸다.
  const reindexed = !before || before.width !== after.width || before.height !== after.height;
  if (reindexed) {
    if (afterTiles.length === 0 && stacks.length === 0) return null;
    return { layer, full: [...afterTiles], ...(stacks.length > 0 ? { stacks } : {}) };
  }
  const beforeTiles = layerTiles(before, layer);
  const cells: PiMapCellDelta[] = [];
  const length = Math.max(beforeTiles.length, afterTiles.length);
  for (let index = 0; index < length; index += 1) {
    const a = beforeTiles[index];
    const b = afterTiles[index];
    if (a === b) continue;
    cells.push({ i: index, t: typeof b === "number" ? b : 0 });
  }
  if (cells.length === 0 && stacks.length === 0) return null;
  if (afterTiles.length !== beforeTiles.length || cells.length > afterTiles.length * FULL_LAYER_RATIO) {
    return { layer, full: [...afterTiles], ...(stacks.length > 0 ? { stacks } : {}) };
  }
  return { layer, cells, ...(stacks.length > 0 ? { stacks } : {}) };
}

/**
 * 선택 층(2·4층·그림자) 증분. 없는 칸은 빈칸 값으로 읽는다. 두 맵 모두 칸이 없으면 null —
 * 옛 맵은 여기서 아무것도 만들지 않는다. 스택은 1·3층에만 있다.
 */
function extraLayerDelta(before: GameMap | null, after: GameMap, layer: ExtraDeltaLayer): PiMapLayerDelta | null {
  const key = extraKey(layer);
  const beforeTiles = before?.[key];
  const afterTiles = after[key];
  if (!afterTiles) return beforeTiles ? { layer, absent: true } : null;
  // 크기가 달라지면 인덱스 의미가 바뀐다 — 1·3층과 같이 통째로 보낸다.
  const reindexed = !before || before.width !== after.width || before.height !== after.height;
  if (reindexed || (beforeTiles && beforeTiles.length !== afterTiles.length)) return { layer, full: [...afterTiles] };
  const empty = extraEmpty(layer);
  const cells: PiMapCellDelta[] = [];
  for (let index = 0; index < afterTiles.length; index += 1) {
    const a = beforeTiles?.[index] ?? empty;
    const b = afterTiles[index] ?? empty;
    if (a === b) continue;
    cells.push({ i: index, t: b });
  }
  // 칸은 같지만 키가 새로 생겼다(아직 정리 전의 빈 층) — 받는 쪽도 키를 갖게 통째로 보낸다.
  if (cells.length === 0) return beforeTiles ? null : { layer, full: [...afterTiles] };
  if (cells.length > afterTiles.length * FULL_LAYER_RATIO) return { layer, full: [...afterTiles] };
  return { layer, cells };
}

function eventsDelta(before: GameMap | null, after: GameMap): PiMapDelta["events"] | null {
  const beforeEvents = new Map((before?.events ?? []).map((event) => [event.id, event]));
  const upserts: GameEvent[] = [];
  for (const event of after.events ?? []) {
    const old = beforeEvents.get(event.id);
    // 같은 객체면 확실히 안 바뀌었다 — 툴은 제자리 변형이라 이 지름길이 대부분을 먹는다.
    if (old === event) { beforeEvents.delete(event.id); continue; }
    if (!old || JSON.stringify(old) !== JSON.stringify(event)) upserts.push(event);
    beforeEvents.delete(event.id);
  }
  const removed = [...beforeEvents.keys()];
  if (upserts.length === 0 && removed.length === 0) return null;
  return { ...(upserts.length > 0 ? { upserts } : {}), ...(removed.length > 0 ? { removed } : {}) };
}

/** 두 맵 사전 사이의 증분. 고스트가 읽는 면(타일 1~4층·그림자·스택·이벤트·뼈대)만 담는다. */
export function diffMapsForDelta(before: MapsRecord, after: MapsRecord): PiMapDelta[] {
  const out: PiMapDelta[] = [];
  const ids = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const mapId of ids) {
    const beforeMap = before?.[mapId];
    const afterMap = after?.[mapId];
    if (!afterMap) {
      if (beforeMap) out.push({ mapId, removed: true });
      continue;
    }
    // 같은 객체면 이 맵은 손대지 않았다. 43맵 프로젝트에서 이 한 줄이 비교 대부분을 건너뛴다.
    if (beforeMap === afterMap) continue;
    const base = beforeMap ?? null;
    const layers: PiMapLayerDelta[] = [];
    for (const layer of ["lower", "upper"] as const) {
      const delta = layerDelta(base, afterMap, layer);
      if (delta) layers.push(delta);
    }
    for (const layer of EXTRA_DELTA_LAYERS) {
      const delta = extraLayerDelta(base, afterMap, layer);
      if (delta) layers.push(delta);
    }
    const events = eventsDelta(base, afterMap);
    const shapeChanged = !base || !sameShape(base, afterMap);
    if (!shapeChanged && layers.length === 0 && !events) continue;
    out.push({
      mapId,
      ...(shapeChanged ? { shape: shapeOf(afterMap) } : {}),
      ...(layers.length > 0 ? { layers } : {}),
      ...(events ? { events } : {}),
    });
  }
  return out;
}

/** 증분에 실제로 담긴 칸 수 — 로그·계측용. */
export function mapDeltaCellCount(deltas: readonly PiMapDelta[]): number {
  let total = 0;
  for (const delta of deltas) {
    for (const layer of delta.layers ?? []) {
      total += layer.full ? layer.full.length : (layer.cells?.length ?? 0);
      total += layer.stacks?.length ?? 0;
    }
    total += delta.events?.upserts?.length ?? 0;
    total += delta.events?.removed?.length ?? 0;
  }
  return total;
}

function emptyMap(mapId: string, shape: PiMapShapeDelta): GameMap {
  const size = Math.max(0, shape.width * shape.height);
  return {
    id: mapId as MapId,
    name: shape.name,
    width: shape.width,
    height: shape.height,
    tilesetId: shape.tilesetId as GameMap["tilesetId"],
    tileSize: shape.tileSize,
    lowerTiles: new Array<number>(size).fill(0),
    upperTiles: new Array<number>(size).fill(0),
    events: [],
  };
}

function applyExtraLayer(map: GameMap, delta: PiMapLayerDelta, layer: ExtraDeltaLayer): void {
  const key = extraKey(layer);
  if (delta.absent) { delete map[key]; return; }
  if (delta.full) {
    map[key] = [...delta.full];
  } else if (delta.cells && delta.cells.length > 0) {
    const tiles = map[key] ? [...map[key]!] : new Array<number>(map.width * map.height).fill(extraEmpty(layer));
    for (const cell of delta.cells) tiles[cell.i] = cell.t;
    map[key] = tiles;
  }
}

function applyLayer(map: GameMap, delta: PiMapLayerDelta): void {
  if (delta.layer !== "lower" && delta.layer !== "upper") { applyExtraLayer(map, delta, delta.layer); return; }
  const key = delta.layer === "lower" ? "lowerTiles" : "upperTiles";
  if (delta.full) {
    map[key] = [...delta.full];
  } else if (delta.cells && delta.cells.length > 0) {
    const tiles = [...(map[key] ?? [])];
    for (const cell of delta.cells) tiles[cell.i] = cell.t;
    map[key] = tiles;
  }
  if (!delta.stacks || delta.stacks.length === 0) return;
  const stackKey = delta.layer === "lower" ? "lowerTileStacks" : "upperTileStacks";
  const stacks: Record<number, number[]> = { ...(map[stackKey] ?? {}) };
  for (const entry of delta.stacks) {
    if (entry.s === null) delete stacks[entry.i];
    else stacks[entry.i] = [...entry.s];
  }
  map[stackKey] = stacks;
}

/**
 * 증분을 얹어 새 맵 사전을 만든다. 손대지 않은 맵은 **같은 객체 그대로** 돌려준다 —
 * 고스트 diff 가 객체 동일성으로 빠져나갈 수 있게(43맵 프로젝트에서 이게 곧 비용이다).
 */
export function applyMapDeltas(maps: MapsRecord, deltas: readonly PiMapDelta[]): Record<string, GameMap> {
  if (deltas.length === 0) return maps as Record<string, GameMap>;
  const next: Record<string, GameMap> = { ...maps };
  for (const delta of deltas) {
    if (delta.removed) { delete next[delta.mapId]; continue; }
    const current = next[delta.mapId];
    let map: GameMap;
    if (!current) {
      if (!delta.shape) continue; // 뼈대 없이 온 새 맵은 복원할 수 없다 — 조용히 건너뛴다.
      map = emptyMap(delta.mapId, delta.shape);
    } else {
      map = { ...current };
      if (delta.shape) {
        // 크기가 바뀌면 2층·4층·그림자를 resize_map 과 같은 좌상단 기준으로 옮겨 길이를 새 크기에 맞춘다
        // (옛 길이로 남으면 칸이 비껴 그려지고 검증이 깨진다). 같은 증분에 그 층의 `full`/`absent` 가 오면 뒤에서 덮는다
        // — diffMapsForDelta 는 크기가 바뀐 맵의 선택 층을 늘 통째로 보낸다. 손으로 만든 뼈대만의 증분은 이 옮기기가 전부다.
        if (delta.shape.width !== current.width || delta.shape.height !== current.height) {
          cropExtraLayers(map, current.width, current.height, 0, 0, delta.shape.width, delta.shape.height);
        }
        map.name = delta.shape.name;
        map.width = delta.shape.width;
        map.height = delta.shape.height;
        map.tilesetId = delta.shape.tilesetId as GameMap["tilesetId"];
        map.tileSize = delta.shape.tileSize;
      }
    }
    for (const layer of delta.layers ?? []) applyLayer(map, layer);
    if (delta.events) {
      const byId = new Map((map.events ?? []).map((event) => [event.id, event] as const));
      for (const id of delta.events.removed ?? []) byId.delete(id);
      for (const event of delta.events.upserts ?? []) byId.set(event.id, event);
      map.events = [...byId.values()];
    }
    next[delta.mapId] = map;
  }
  return next;
}
