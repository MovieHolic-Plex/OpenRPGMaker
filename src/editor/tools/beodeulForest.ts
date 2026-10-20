// editor/tools/beodeulForest.ts — 버들항 숲 composer 정의를 고르고 접지 칸을 대상 칩셋에 이식한다(2026-10-20 woodland r2).
//
// 숲 종류(forestType): broadleaf 활엽 · conifer 침엽 · mixed 혼효. 그림은 모두 beodeul_city 원본 키트 칸이다
// (src/assets/beodeulForestComposer.json, 빌더 scripts/content/build-beodeul-forest-composer.py).
// 접지(TreeComposerGround, #3058 r6): 숲 바닥 그늘(1층)·숲 둘레 땅 그늘(2층) 칸은 공용 기초 칩셋 beodeul_ground 에 있어
// translateTiles 로 대상 칩셋에 이식한 번호로 바꿔 넘긴다(통행·우선순위는 source 그대로 — 둘 다 걸을 수 있다).
import data from "@/assets/beodeulForestComposer.json";
import { createBeodeulGroundTileset, ensureBeodeulGroundReferences } from "@/project/defaults/beodeulGround";
import { translateTiles } from "@/project/objectStamp";
import type { GameMap, Project, TilesetDef, TreeComposerDef } from "@/project/types";
import { composeTreesInMask } from "@/project/defaults/treeComposer";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";

export const BEODEUL_FOREST_TYPES = ["broadleaf", "conifer", "mixed"] as const;
export type BeodeulForestType = (typeof BEODEUL_FOREST_TYPES)[number];
export const BEODEUL_FOREST_TYPE_LABEL: Record<BeodeulForestType, string> = { broadleaf: "활엽수림", conifer: "침엽수림", mixed: "혼효림" };

export function parseBeodeulForestType(value: unknown, fallback: BeodeulForestType = "broadleaf"): BeodeulForestType {
  if (value === undefined || value === null || value === "") return fallback;
  if ((BEODEUL_FOREST_TYPES as readonly string[]).includes(String(value))) return value as BeodeulForestType;
  throw new Error(`forestType 은 ${BEODEUL_FOREST_TYPES.join("|")} 중 하나입니다(받은 값 ${String(value)}).`);
}

/**
 * 대상 칩셋(beodeul_city 계열)에서 쓸 composer 정의 — 접지 칸 번호를 이식해 채운다.
 * grassBases: 둘레 그늘을 깔 1층 잔디 칸(기본 민무늬 잔디 737). 둘레 그늘은 투명 덧칸이라 어느 잔디 위에서나 같은 칸을 쓴다.
 */
export function beodeulForestComposer(project: Project, target: TilesetDef, type: BeodeulForestType,
  grassBases: readonly number[] = data.ground.apronBases): TreeComposerDef {
  const { groundShadeCover, groundShadeRows, ...rest } = structuredClone(data.types[type]);
  const def = rest as unknown as TreeComposerDef;
  const g = data.ground;
  const common = project.tilesets.beodeul_ground ??= createBeodeulGroundTileset();
  ensureBeodeulGroundReferences(common);
  const tr = translateTiles(common, target, [...g.floorTiles, ...g.floorEdgeTiles, ...g.apronTiles].filter((n) => n >= 0)).map;
  const to = (n: number) => (n >= 0 ? tr.get(n) ?? -1 : -1);
  def.ground = {
    shadeBits: g.shadeBits.map((b) => [...b]), shadeCover: groundShadeCover ?? g.shadeCover, shadeCoverBase: g.shadeCoverBase, shadeRows: groundShadeRows,
    floorTiles: g.floorTiles.map(to), apronLayer: g.apronLayer, apronBases: [...grassBases], apronTiles: grassBases.flatMap(() => g.apronTiles.map(to)),
  };
  edgeFloor.set(def, new Map(g.floorTiles.map((n, k) => [to(n), to(g.floorEdgeTiles[k]!)] as const)));
  return def;
}

const edgeFloor = new WeakMap<TreeComposerDef, Map<number, number>>();

/**
 * 버들항 숲 한 번 짓기: composer(나무 + 접지) → 숲 가장자리 칸의 바닥을 「그늘 코드만」 변형으로 바꾼다.
 * 숲 속 바닥은 어디나 적어도 옅은 그늘(×0.82)이라 숲 속 빈 틈이 밝게 비치지 않는다. 그 바닥을 가장자리까지 깔면
 * 숲 칸 경계가 잔디와 곧은 네모 선으로 갈려서, 8이웃 중 숲 밖이 있는 칸은 나무 그늘만 진 바닥을 쓴다.
 */
export function composeBeodeulForest(project: Project, map: GameMap, target: TilesetDef, type: BeodeulForestType,
  forest: (x: number, y: number) => boolean, hold: (x: number, y: number) => boolean, seed: number,
  write: (x: number, y: number) => boolean = hold, grassBases?: readonly number[]): TreeComposerDef {
  const def = beodeulForestComposer(project, target, type, grassBases);
  composeTreesInMask(map, def, forest, hold, seed, write);
  const edge = edgeFloor.get(def)!;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    if (!forest(x, y) || !write(x, y)) continue;
    let rim = false;
    for (let dy = -1; dy <= 1 && !rim; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < map.width && ny < map.height && !forest(nx, ny)) { rim = true; break; }
    }
    if (!rim) continue;
    const i = y * map.width + x, t = edge.get(layerTileAt(map, 1, i));
    if (t !== undefined && t >= 0) setLayerTileAt(map, 1, i, t);
  }
  return def;
}
