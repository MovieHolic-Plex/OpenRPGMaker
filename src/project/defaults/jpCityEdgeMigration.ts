import type { AutotileGroup, GameMap, TilesetDef } from "../types";
import { autotileGroupLayerView, autotileNeighborMask, autotileVariantForMask } from "./autotileEngine";

/**
 * jp_city 지면 오토타일 7그룹이 `edgeConnects: true` 로 바뀐 것(2026-10-20)에 맞춰 이미 저장된 맵의 둘레 칸을 다시 맞춘다.
 *
 * 맵은 변형 타일 번호를 구워 저장하고, 엔진은 칠하거나 도구를 쓸 때만 이웃을 다시 센다(렌더 때 재계산 없음).
 * 그래서 타일셋 플래그만 고치면 저장된 맵의 둘레 톱니(맵 밖을 다른 재료로 센 가장자리 그림)는 그대로 남는다.
 *
 * 둘레 칸을 이웃에서 통째로 다시 세면 안 된다 — 안쪽 칸은 나중에 올린 개울·길 같은 비그룹 타일 곁에서도 "꽉 찬" 그림을 그대로 두는데,
 * 둘레 칸만 엄격히 다시 세면 그 곁에서 회색 가장자리가 새로 생긴다. 그래서 **맵 밖 방향 비트만** 바꾼다:
 * 지금 그림이 뜻하는 이웃 모양에 "맵 밖은 같은 재료"만 더해 다시 고른다. 안쪽 칸·저자가 둔 다른 칸은 건드리지 않고,
 * 같은 입력엔 같은 결과(멱등)이며, 바뀐 칸이 있을 때만 true 를 돌려준다.
 */
export function reshapeJpCityMapBorders(project: { maps: Record<string, GameMap>; tilesets: Record<string, TilesetDef> }): boolean {
  const tileset = project.tilesets.jp_city;
  const groups = (tileset?.autotileGroups ?? []).filter((group) => group.edgeConnects === true && group.id.startsWith("jp-"));
  if (groups.length === 0) return false;
  const reverse = new Map<string, Map<number, number[]>>();
  for (const group of groups) reverse.set(group.id, masksByVariant(group));
  let changed = false;
  for (const map of Object.values(project.maps)) {
    if (map.tilesetId !== "jp_city") continue;
    const { width, height } = map;
    if (!(width > 0 && height > 0)) continue;
    for (const group of groups) {
      const view = autotileGroupLayerView(map, group);
      const members = new Set<number>(group.memberTileIds);
      const connect = new Set<number>(group.connectTileIds ?? group.memberTileIds);
      const isConnected = (tile: number): boolean => connect.has(tile);
      const neighborhood = group.neighborhood ?? 4;
      const interior = new Set((group.interiorVariants ?? []).flat());
      const byVariant = reverse.get(group.id)!;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (x !== 0 && y !== 0 && x !== width - 1 && y !== height - 1) continue;
          const index = y * width + x;
          const current = view.lowerTiles[index];
          if (typeof current !== "number" || !members.has(current) || interior.has(current)) continue;
          const candidates = byVariant.get(current);
          if (!candidates || candidates.length === 0) continue;
          const maskOld = autotileNeighborMask(view, x, y, isConnected, neighborhood, false);
          const maskNew = autotileNeighborMask(view, x, y, isConnected, neighborhood, true);
          const outside = maskNew & ~maskOld;
          if (outside === 0) continue;
          let shown = candidates[0]!;
          for (const candidate of candidates) if (bitCount(candidate ^ maskOld) < bitCount(shown ^ maskOld)) shown = candidate;
          const variant = autotileVariantForMask(group, shown | outside);
          if (typeof variant === "number" && variant !== current) {
            view.lowerTiles[index] = variant;
            changed = true;
          }
        }
      }
    }
  }
  return changed;
}

function masksByVariant(group: AutotileGroup): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const [key, value] of Object.entries(group.variantMap)) {
    if (typeof value !== "number") continue;
    const list = out.get(value) ?? [];
    list.push(Number(key));
    out.set(value, list);
  }
  return out;
}

function bitCount(value: number): number {
  let n = 0;
  for (let v = value; v > 0; v >>>= 1) n += v & 1;
  return n;
}
