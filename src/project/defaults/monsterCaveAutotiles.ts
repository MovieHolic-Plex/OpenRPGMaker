import { MONSTER_CAVE_MANIFEST } from "@/assets/scarloxyPack";
import type { AutotileGroup } from "../types";

// 몬스터 동굴 칩셋(scarloxy_chipset_monster_cave)의 47칸 블롭 네 세트를 8방 오토타일로 등록한다.
// 대각 이웃은 양옆 직교가 모두 이어졌을 때만 모양을 바꾸므로 256 마스크가 47 모양으로 줄어든다.
// 마스크→칸 표는 scripts/content/build-monster-cave.py 가 매니페스트에 적는다(대표 마스크만).
// 솟은 세트(바위 벽·고지대)는 절벽 앞면 칸도 이어진 이웃으로 본다 — 앞면이 남쪽에 붙어도
// 윗면이 남쪽 외곽선을 한 번 더 그리지 않는다. 바위 벽과 고지대는 서로를 이웃으로 본다(둘 다 솟은 면이라
// 사이에 흙 띠가 비치지 않는다). 바위 벽은 맵 가장자리 밖도 벽으로 본다. 앞면을 찍으면 그 위 윗면이 다시 모양을 잡도록
// triggerTileIds 는 생략한다(= connectTileIds).

export const MONSTER_CAVE_AUTOTILE_PREFIX = "harness-scarloxy-monster_cave-v1-blob-";

const BITS = MONSTER_CAVE_MANIFEST.blobMaskBits;

/** 8비트 이웃 마스크 → 47 대표 마스크. */
export function reduceBlobMask(mask: number): number {
  let reduced = mask & (BITS.N | BITS.E | BITS.S | BITS.W);
  if (mask & BITS.NE && mask & BITS.N && mask & BITS.E) reduced |= BITS.NE;
  if (mask & BITS.SE && mask & BITS.S && mask & BITS.E) reduced |= BITS.SE;
  if (mask & BITS.SW && mask & BITS.S && mask & BITS.W) reduced |= BITS.SW;
  if (mask & BITS.NW && mask & BITS.N && mask & BITS.W) reduced |= BITS.NW;
  return reduced;
}

function blockTiles(name: string): number[] {
  const block = MONSTER_CAVE_MANIFEST.blocks.find((entry) => entry.name === name);
  if (!block) throw new Error(`몬스터 동굴 매니페스트에 블록이 없습니다: ${name}`);
  const tiles: number[] = [];
  for (let dy = 0; dy < block.h; dy += 1) for (let dx = 0; dx < block.w; dx += 1) tiles.push((block.row + dy) * 30 + block.col + dx);
  return tiles;
}

const SETS = [
  { key: "wall", name: "동굴 바위 벽", connects: ["face", "high"], edgeConnects: true },
  { key: "high", name: "고지대 바닥", connects: ["face", "wall"], edgeConnects: false },
  { key: "water", name: "동굴 물", connects: [], edgeConnects: false },
  { key: "gravel", name: "자갈 바닥", connects: [], edgeConnects: false },
] as const;

/** 절벽 앞면 두 줄에 끼우는 칸(앞면·사다리·굴·출구·오르는 계단). */
export function monsterCaveFaceRowTiles(): number[] {
  return ["cliff-face", "ladder-up", "tunnel-dark", "exit-bright", "stairs-up"].flatMap(blockTiles);
}

export function createMonsterCaveAutotileGroups(): AutotileGroup[] {
  const face = monsterCaveFaceRowTiles();
  const members = (key: "wall" | "high" | "water" | "gravel"): number[] => [...new Set(Object.values(MONSTER_CAVE_MANIFEST.blobs[key].masks))];
  return SETS.map((set) => {
    const masks = MONSTER_CAVE_MANIFEST.blobs[set.key].masks;
    const memberTileIds = members(set.key);
    const extra = (set.connects as readonly string[]).flatMap((key) => (key === "face" ? face : members(key as "wall" | "high")));
    const variantMap: Record<string, number> = {};
    for (let mask = 0; mask < 256; mask += 1) {
      const tile = masks[String(reduceBlobMask(mask))];
      if (tile === undefined) throw new Error(`${set.key}: 마스크 ${mask} 의 칸이 없습니다`);
      variantMap[String(mask)] = tile;
    }
    return {
      id: `${MONSTER_CAVE_AUTOTILE_PREFIX}${set.key}`,
      name: set.name,
      neighborhood: 8,
      memberTileIds,
      connectTileIds: [...memberTileIds, ...extra],
      variantMap,
      ...(set.edgeConnects ? { edgeConnects: true } : {}),
    };
  });
}

