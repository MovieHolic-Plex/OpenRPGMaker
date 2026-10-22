// jp_city 칸 번호 복구 — 2026-10-14~18 낡은 pins.json 굽기로 밀린 번호를 그 판의 자리 키를 따라 지금 번호로 옮긴다.
//
// 왜 자동이 아니고 사람이 고르는가: 프로젝트는 맵을 「어느 시트 판에서 그렸는지」를 저장하지 않는다. jp_city 타일셋 사본은
// 로드할 때마다 ensureJpCityTileset 이 그때 번들 것으로 갈아 끼워, 남는 것은 「마지막으로 연 판」뿐이다. 앞 판에서 그린 맵을
// 다음 판에서 열어 저장했으면 사본은 다음 판인데 맵 번호는 앞 판이다(맵마다 다를 수도 있다). 그래서 확실히 가를 수 없고,
// 확실하지 않으면 옮기지 않는다 — 편집기 「jp_city 칸 번호 복구」 창이 판마다 미리보기를 보여 주고 사람이 고른다(editor/jpCityPinRepairDialog.ts).
//
// 표: src/assets/jpCityPinEras.json — scripts/content/jp-city/maps/bake-pin-eras.mjs 가 pins.json 이력에서 굽는다
// (게시 장소를 옮긴 remap-refs.mjs 와 같은 pinRemap.mjs 로직). 위키: openwiki/jp-city.md 「칸 번호 밀림 사고」.
//
// 계약: jp_city 맵만 고친다. 한 맵은 한 번만 고친다(meta.oprnJpCityPinRepairs 에 남은 맵은 다시 고치지 않는다 — 멱등).
// 되돌리기는 편집기 실행 취소(applyProjectWithHistory)와 로컬 폴더 백업(backups/)이 맡는다.
import type { GameMap, MapId, Project } from "../types";

export const JP_CITY_PIN_REPAIR_TILESET = "jp_city";

export type JpCityPinEra = {
  readonly id: string;
  readonly label: string;
  readonly since: string;
  readonly until: string;
  readonly revs: readonly string[];
  readonly oldCount: number;
  readonly moved: number;
  /** [옛 시작, 새 시작, 길이] — 번호가 바뀐 구간만. */
  readonly runs: readonly (readonly [number, number, number])[];
  /** 지금 시트에 자리 키가 없는 옛 번호(키트에서 뺀 칸). 복구는 그대로 두고 수를 알린다. */
  readonly lost: readonly number[];
};

export type JpCityPinEraTable = { readonly nowCount: number; readonly eras: readonly JpCityPinEra[] };

export type JpCityPinRepairRecord = {
  readonly mapId: MapId;
  readonly era: string;
  readonly at: string;
  /** 옮긴 칸 수(층 합계). */
  readonly moved: number;
  /** 지금 시트에 없는 번호라 그대로 둔 칸 수. */
  readonly lost: number;
  /** 같이 옮긴 「타일 바꾸기」 명령 수. */
  readonly commands: number;
};

const LAYER_KEYS = ["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles"] as const;

/** 판 표로 번호 하나를 옮기는 함수. 바뀌지 않는 번호는 그대로 돌려준다. */
export function jpCityEraRemapper(era: JpCityPinEra): { readonly to: (tile: number) => number; readonly isLost: (tile: number) => boolean } {
  const table = new Map<number, number>();
  for (const [from, to, len] of era.runs) for (let i = 0; i < len; i += 1) table.set(from + i, to + i);
  const lost = new Set(era.lost);
  return {
    to: (tile) => (tile >= 0 ? table.get(tile) ?? tile : tile),
    isLost: (tile) => lost.has(tile),
  };
}

export type JpCityMapRemap = { readonly map: GameMap; readonly moved: number; readonly lost: number };

/** 맵 칸 번호를 옮긴 사본. 원본은 건드리지 않는다. 층 4개·칸 더미·기물 묶음(놓은 칸·밑 칸)을 옮긴다. */
export function remapJpCityMap(map: GameMap, era: JpCityPinEra): JpCityMapRemap {
  const { to, isLost } = jpCityEraRemapper(era);
  let moved = 0;
  let lost = 0;
  const one = (tile: number): number => {
    if (typeof tile !== "number" || tile < 0) return tile;
    if (isLost(tile)) { lost += 1; return tile; }
    const next = to(tile);
    if (next !== tile) moved += 1;
    return next;
  };
  const next: GameMap = { ...map };
  for (const key of LAYER_KEYS) {
    const tiles = map[key];
    if (Array.isArray(tiles)) (next as unknown as Record<string, unknown>)[key] = tiles.map(one);
  }
  for (const key of ["lowerTileStacks", "upperTileStacks"] as const) {
    const stacks = map[key];
    if (!stacks) continue;
    const out: Record<number, number[]> = {};
    for (const [index, list] of Object.entries(stacks)) out[Number(index)] = list.map(one);
    next[key] = out;
  }
  if (map.doodadGroups) {
    next.doodadGroups = map.doodadGroups.map((group) => ({
      ...group,
      cells: group.cells.map((cell) => ({ ...cell, tile: one(cell.tile), before: cell.before < 0 ? cell.before : to(cell.before) })),
    }));
  }
  return { map: next, moved, lost };
}

/** 이 맵에 쓸 판 후보 — 옮길 칸이 하나라도 있는 판만. 이미 고친 맵·jp_city 가 아닌 맵은 빈 목록. */
export function jpCityPinRepairCandidates(project: Pick<Project, "maps" | "meta">, mapId: MapId, table: JpCityPinEraTable): { readonly era: JpCityPinEra; readonly moved: number; readonly lost: number }[] {
  const map = project.maps[mapId];
  if (!map || map.tilesetId !== JP_CITY_PIN_REPAIR_TILESET || jpCityPinRepairRecordFor(project, mapId)) return [];
  const out: { era: JpCityPinEra; moved: number; lost: number }[] = [];
  for (const era of table.eras) {
    const { moved, lost } = remapJpCityMap(map, era);
    if (moved > 0) out.push({ era, moved, lost });
  }
  return out;
}

export function jpCityPinRepairRecords(project: Pick<Project, "meta">): readonly JpCityPinRepairRecord[] {
  const list = (project.meta as { oprnJpCityPinRepairs?: unknown }).oprnJpCityPinRepairs;
  return Array.isArray(list) ? (list as JpCityPinRepairRecord[]) : [];
}

export function jpCityPinRepairRecordFor(project: Pick<Project, "meta">, mapId: MapId): JpCityPinRepairRecord | undefined {
  return jpCityPinRepairRecords(project).find((record) => record.mapId === mapId);
}

/**
 * 프로젝트(사본)의 맵 하나를 고른 판에서 지금 번호로 옮기고 meta.oprnJpCityPinRepairs 에 남긴다.
 * 이 맵을 가리키는 「타일 바꾸기」 명령(맵 이벤트·공통 이벤트 어디서든)의 칸 번호도 같이 옮긴다.
 * jp_city 맵이 아니거나 이미 고친 맵이거나 그 판으로 옮길 칸이 없으면 아무것도 하지 않고 null.
 */
export function applyJpCityPinRepair(project: Project, mapId: MapId, era: JpCityPinEra, at: string): JpCityPinRepairRecord | null {
  const map = project.maps[mapId];
  if (!map || map.tilesetId !== JP_CITY_PIN_REPAIR_TILESET || jpCityPinRepairRecordFor(project, mapId)) return null;
  const result = remapJpCityMap(map, era);
  if (result.moved === 0) return null;
  const { to, isLost } = jpCityEraRemapper(era);
  let commands = 0;
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) { for (const item of node) visit(item); return; }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (record.kind === "changeTile" && record.mapId === mapId && typeof record.tile === "number") {
      const tile = record.tile;
      if (tile >= 0 && !isLost(tile) && to(tile) !== tile) { record.tile = to(tile); commands += 1; }
      return;
    }
    for (const value of Object.values(record)) if (value && typeof value === "object") visit(value);
  };
  const maps: Record<MapId, GameMap> = { ...project.maps, [mapId]: { ...result.map, events: structuredClone(map.events) } };
  for (const id of Object.keys(maps)) {
    if (id !== mapId) maps[id] = { ...maps[id]!, events: structuredClone(maps[id]!.events) };
    visit(maps[id]!.events);
  }
  project.maps = maps;
  project.commonEvents = structuredClone(project.commonEvents);
  visit(project.commonEvents);
  const record: JpCityPinRepairRecord = { mapId, era: era.id, at, moved: result.moved, lost: result.lost, commands };
  const meta = project.meta as { oprnJpCityPinRepairs?: JpCityPinRepairRecord[] };
  meta.oprnJpCityPinRepairs = [...jpCityPinRepairRecords(project), record];
  return record;
}

/** 번들 표 — 복구 창을 열 때만 읽는다(37KB). */
export async function loadJpCityPinEras(): Promise<JpCityPinEraTable> {
  const mod = await import("@/assets/jpCityPinEras.json");
  return (mod.default ?? mod) as unknown as JpCityPinEraTable;
}
