/**
 * 번들 칩셋 꼬리와 프로젝트 이식 칸(tileGrafts)이 겹칠 때, 프로젝트 쪽 칸을 새 번들 끝 뒤로 통째로 옮긴다(2026-10-22).
 *
 * 왜: 번들 시트는 끝에 칸을 덧붙이며 자란다(버들항 농장 27,648~ · 던전 천장 28,416~ · 성벽 28,544~ …). 사본을 저장하던 때의
 * 번들 끝 바로 뒤에는 그 프로젝트의 이식 칸(민가·형태·허용 건물·바닥·공방 칸 — translateTiles·bakeWorkshopObject 가 붙인 것)이 있다.
 * 예전에는 겹치면 새 꼬리를 받지 않았다 → 기존 프로젝트 대부분(이식 칸이 28,544 부터)이 성벽을 못 받았다.
 *
 * 무엇을: 사본의 번들 끝(= 번들 바탕 이후 첫 이식 칸, 없으면 칸 수) B 가 지금 번들 끝 E 보다 앞이면 [B, count) 를 통째로
 * S(= E−B 를 한 줄 폭 배수로 올림)만큼 민다. 칸 표(통행·층·지형·이름표), 이식 목록, 애니메이션 띠, 킷·오토타일·칸 묶음·팔레트·재료 슬롯·
 * 카운터·턱·미끄럼 표, 그리고 그 칩셋을 쓰는 맵의 네 층·겹침 스택·두들 묶음·지형 기록·절벽 장식, 그 맵을 겨누는 changeTile 명령,
 * 같은 칩셋의 지형 도장까지 같은 번호 변환으로 고친다. B 앞 칸은 손대지 않는다 — 원래 그림 그대로다.
 * 옮긴 뒤 [B, E) 는 비어 있으므로 호출자가 번들 칸 표로 채운다(덧붙이기 전용 번들이라 이미 깔린 번들 칸 번호는 그대로).
 *
 * 앞으로 번들이 또 자라도 같은 함수가 다시 민다 — 예약 구간을 두지 않고 매번 옮긴다(번호만 바뀌고 그림은 같다).
 */
import type { TilesetDef } from "../types";

type AnyRecord = Record<string, unknown>;
type MapLike = AnyRecord & { tilesetId?: string };
export type RelocationProject = { tilesets: Record<string, TilesetDef>; maps?: Readonly<Record<string, unknown>>; commonEvents?: unknown; terrainStamps?: unknown };

export interface LocalTailRelocation { readonly from: number; readonly to: number; readonly shift: number; readonly cells: number; readonly maps: number }

/** 사본의 번들 끝: 번들 바탕(bundleBase) 이후 첫 이식 칸, 없으면 칸 수. */
export function copyBundleEnd(tileset: TilesetDef, bundleBase: number): number {
  let end = tileset.count;
  for (const graft of tileset.tileGrafts ?? []) if (graft.targetTile >= bundleBase && graft.targetTile < end) end = graft.targetTile;
  return end;
}

/**
 * 사본의 로컬 꼬리 [B, count) 를 bundleEnd 뒤로 민다. 옮길 것이 없으면 null.
 * 이식 칸이 하나도 없는 꼬리(빈 칸만)는 옮기지 않는다 — 호출자가 그냥 번들 표로 덮는다.
 */
export function relocateLocalTail(project: RelocationProject, tilesetId: string, bundleBase: number, bundleEnd: number): LocalTailRelocation | null {
  const tileset = project.tilesets[tilesetId];
  if (!tileset) return null;
  const from = copyBundleEnd(tileset, bundleBase);
  if (from >= bundleEnd || from >= tileset.count) return null;
  if (!(tileset.tileGrafts ?? []).some((graft) => graft.targetTile >= from)) return null;
  const perRow = Math.max(1, tileset.tilesPerRow);
  const shift = Math.ceil((bundleEnd - from) / perRow) * perRow;
  const oldCount = tileset.count;
  const re = (tile: number): number => (Number.isInteger(tile) && tile >= from && tile < oldCount ? tile + shift : tile);

  // 칸 표: [from, oldCount) 를 shift 뒤로, 그 사이는 비워 둔다(호출자가 번들 표로 채운다)
  const move = <T>(list: T[] | undefined, blank: () => T): T[] | undefined => {
    if (!list) return list;
    const head = list.slice(0, from);
    while (head.length < from) head.push(blank());
    const gap = Array.from({ length: shift }, blank);
    return [...head, ...gap, ...list.slice(from, oldCount)];
  };
  tileset.passability = move(tileset.passability, () => ({ up: true, down: true, left: true, right: true }))!;
  tileset.priority = move(tileset.priority, () => "lower" as const)!;
  tileset.terrain = move(tileset.terrain, () => 0)!;
  if (tileset.tileMeta) tileset.tileMeta = move(tileset.tileMeta, () => ({ label: "", description: "" }))!;
  tileset.count = oldCount + shift;
  tileset.tileGrafts = (tileset.tileGrafts ?? []).map((graft) => (graft.targetTile >= from ? { ...graft, targetTile: graft.targetTile + shift } : graft));
  if (tileset.animationStrips) tileset.animationStrips = tileset.animationStrips.map((strip) => (strip.baseTile >= from ? { ...strip, baseTile: strip.baseTile + shift } : strip));

  // 칸 번호를 담는 칩셋 쪽 구조(설명 글·참고문서는 숫자를 칸 번호로 쓰지 않으므로 뺀다)
  const deep = (value: unknown): unknown => {
    if (typeof value === "number") return re(value);
    if (Array.isArray(value)) return value.map(deep);
    if (value && typeof value === "object") {
      const out: AnyRecord = {};
      for (const [key, inner] of Object.entries(value as AnyRecord)) out[key] = key === "ai" || key === "spec" || key === "referenceDocuments" || key === "parts" ? inner : deep(inner);
      return out;
    }
    return value;
  };
  if (tileset.structureKits) tileset.structureKits = tileset.structureKits.map((kit) => ({ ...kit, rows: deep(kit.rows) as typeof kit.rows }));
  if (tileset.autotileGroups) tileset.autotileGroups = deep(tileset.autotileGroups) as typeof tileset.autotileGroups;
  if (tileset.tileGroups) tileset.tileGroups = deep(tileset.tileGroups) as typeof tileset.tileGroups;
  if (tileset.palettePresets) tileset.palettePresets = deep(tileset.palettePresets) as typeof tileset.palettePresets;
  if (tileset.materialSlots) tileset.materialSlots = deep(tileset.materialSlots) as typeof tileset.materialSlots;
  if (tileset.counterTiles) tileset.counterTiles = tileset.counterTiles.map(re);
  const rekey = <V>(record: Record<string, V> | undefined): Record<string, V> | undefined =>
    record && Object.fromEntries(Object.entries(record).map(([key, v]) => [String(re(Number(key))), v]));
  if (tileset.ledgeDirections) tileset.ledgeDirections = rekey(tileset.ledgeDirections);
  if (tileset.slideTiles) tileset.slideTiles = rekey(tileset.slideTiles);

  // 그 칩셋을 쓰는 맵
  const users = new Set<string>();
  for (const [mapId, raw] of Object.entries(project.maps ?? {})) {
    const map = raw as MapLike;
    if (!map || map.tilesetId !== tilesetId) continue;
    users.add(mapId);
    for (const key of ["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles"] as const) {
      const layer = map[key] as number[] | undefined;
      if (Array.isArray(layer)) for (let i = 0; i < layer.length; i += 1) layer[i] = re(layer[i]!);
    }
    for (const key of ["lowerTileStacks", "upperTileStacks"] as const) {
      const stacks = map[key] as Record<string, number[]> | undefined;
      if (stacks) for (const k of Object.keys(stacks)) stacks[k] = (stacks[k] ?? []).map(re);
    }
    const groups = map.doodadGroups as { cells: { tile: number; before: number }[] }[] | undefined;
    if (groups) for (const g of groups) for (const c of g.cells) { c.tile = re(c.tile); c.before = re(c.before); }
    const relief = map.relief as { wallDecor?: { tile: number }[] } | undefined;
    if (relief?.wallDecor) for (const d of relief.wallDecor) d.tile = re(d.tile);
    const design = map.terrainDesign as { features?: { patches?: { before: { layers: number[] }; after: { layers: number[] } }[] }[] } | undefined;
    for (const feature of design?.features ?? []) for (const patch of feature.patches ?? []) {
      patch.before.layers = patch.before.layers.map(re); patch.after.layers = patch.after.layers.map(re);
    }
  }
  // 지형 도장(같은 칩셋)
  for (const stamp of (Array.isArray(project.terrainStamps) ? project.terrainStamps : []) as { tilesetId: string; cells: { layers: number[] }[]; wallDecor?: { tile: number }[]; groups?: { cells: { tile: number; before: number }[] }[] }[]) {
    if (stamp.tilesetId !== tilesetId) continue;
    for (const c of stamp.cells) c.layers = c.layers.map(re);
    for (const d of stamp.wallDecor ?? []) d.tile = re(d.tile);
    for (const g of stamp.groups ?? []) for (const c of g.cells) { c.tile = re(c.tile); c.before = re(c.before); }
  }
  // 그 맵들을 겨누는 「타일 바꾸기」 명령(맵 이벤트·공통 이벤트, 분기 안까지)
  if (users.size) {
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) { for (const v of value) walk(v); return; }
      if (!value || typeof value !== "object") return;
      const o = value as AnyRecord;
      if (o.kind === "changeTile" && typeof o.mapId === "string" && users.has(o.mapId) && typeof o.tile === "number") o.tile = re(o.tile);
      for (const inner of Object.values(o)) if (inner && typeof inner === "object") walk(inner);
    };
    for (const raw of Object.values(project.maps ?? {})) walk((raw as MapLike)?.events);
    walk(project.commonEvents);
  }
  return { from, to: from + shift, shift, cells: oldCount - from, maps: users.size };
}
