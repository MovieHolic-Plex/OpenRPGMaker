// editor/flatGridTerrain.ts
// 안 A: 1칸=1칸 진짜 타일 다중 언덕(1~3단 적층) · 지형 깎기 · 돌계단 · 나무다리 엔진 (map.relief Y-오프셋 없음).
// 화면 좌표 (x, y) 와 타일 데이터 좌표 (x, y) 가 모든 단(0~3단)에서 100% 일치한다:
// - 평지에서 「언덕」을 끌면 1단 언덕 생성/확장, 이미 만들어진 1단 고원 윗면에서 끌면 2단(최대 3단) 적층!
// - 우클릭이나 「땅」 크레용으로 문지르면 3단→2단→1단→0단 순서로 한 단씩 자연스럽게 깎이고 4면 절벽이 다시 감긴다.
// - 「길」 크레용으로 다중 절벽을 넘으면 각 단 절벽마다 돌계단이 연속 시공되고, 강을 건너면 나무다리가 놓인다.

import { autotileEditTriggersGroup, shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { cloneExtraLayers, compactMapLayers, layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { clearTileStack } from "@/project/mapOverlayTiles";
import { reliefIsFlat } from "@/project/relief/edit";
import { store } from "@/project/store";
import { normalizeTerrainDesign, terrainLocked } from "@/project/terrainDesign";
import type { GameMap, MapId, TilesetDef } from "@/project/types";
import { reliefTopGrassTile } from "./reliefActions";
import { lineCells, symmetryVariants, transformPoint, type TerrainPoint } from "./terrainDesignGeometry";
import { softenShore } from "./terrainLandBrush";
import { terrainMaterialTile, terrainRoadTile } from "./terrainMaterials";

export const MAX_FLAT_HILL_TIER = 3;

export interface FlatCliffSpec {
  readonly groundTile: number;
  readonly plateauTile: number;
  readonly rimNW: number;
  readonly rimN: readonly number[];
  readonly rimNE: number;
  readonly rimW: number;
  readonly rimE: number;
  /** 북·좌·우 잔디 테두리를 충돌(X)로 막는 투명 정적 타일(없으면 -1: 테두리 타일 자체가 막힘일 때). */
  readonly solidOverlayTile: number;
  readonly southUpper: readonly number[];
  readonly southLower: readonly number[];
  readonly southSingle: readonly number[];
  readonly stairTop: { readonly single: number; readonly left: number; readonly mid: number; readonly right: number };
  readonly stairBottom: { readonly single: number; readonly left: number; readonly mid: number; readonly right: number };
  readonly rimStepTile: number;
  readonly bridgeDeck: readonly number[];
  readonly hillSignatureSet: ReadonlySet<number>;
  readonly borderAndStairSet: ReadonlySet<number>;
  readonly stairSet: ReadonlySet<number>;
  readonly southUpperSet: ReadonlySet<number>;
  readonly southLowerSet: ReadonlySet<number>;
  readonly rimSet: ReadonlySet<number>;
}

const specCache = new WeakMap<TilesetDef, { outdoor?: FlatCliffSpec | null; dungeon?: FlatCliffSpec | null }>();

function buildSets(base: Omit<FlatCliffSpec, "hillSignatureSet" | "borderAndStairSet" | "stairSet" | "southUpperSet" | "southLowerSet" | "rimSet">): FlatCliffSpec {
  const rimSet = new Set<number>([base.rimNW, ...base.rimN, base.rimNE, base.rimW, base.rimE]);
  const southUpperSet = new Set<number>(base.southUpper);
  const southLowerSet = new Set<number>([...base.southLower, ...base.southSingle]);
  const stairSet = new Set<number>([
    base.stairTop.single, base.stairTop.left, base.stairTop.mid, base.stairTop.right,
    base.stairBottom.single, base.stairBottom.left, base.stairBottom.mid, base.stairBottom.right,
  ]);
  const borderAndStairSet = new Set<number>([...rimSet, ...southUpperSet, ...southLowerSet, ...stairSet]);
  const hillSignatureSet = new Set<number>([base.plateauTile, base.rimStepTile, ...borderAndStairSet]);
  return {
    ...base,
    hillSignatureSet,
    borderAndStairSet,
    stairSet,
    southUpperSet,
    southLowerSet,
    rimSet,
  };
}

function isSolidPass(tileset: TilesetDef, tile: number): boolean {
  if (tile < 0 || tile >= tileset.passability.length) return false;
  const p = tileset.passability[tile];
  return Boolean(p && !p.up && !p.down && !p.left && !p.right);
}

function isOpenPass(tileset: TilesetDef, tile: number): boolean {
  if (tile < 0 || tile >= tileset.passability.length) return false;
  const p = tileset.passability[tile];
  return Boolean(p && p.up && p.down && p.left && p.right);
}

export function resolveFlatCliffSpec(tileset: TilesetDef | undefined, mode: "outdoor" | "dungeon" = "outdoor"): FlatCliffSpec | null {
  if (!tileset) return null;
  let cached = specCache.get(tileset);
  if (!cached) {
    cached = {};
    specCache.set(tileset, cached);
  }
  if (cached[mode] !== undefined) return cached[mode] ?? null;

  // 1. 버들항 야외 정밀 세트 (검증 완료된 원본 풀밭 테두리 + 2단 흙절벽 + 돌계단 + 나무 널다리)
  if (mode === "outdoor" && tileset.id === "beodeul_city" && tileset.count >= 25300) {
    const spec = buildSets({
      groundTile: 737,
      plateauTile: 4618,
      rimNW: 572,
      rimN: [573, 574],
      rimNE: 585,
      rimW: 1332,
      rimE: 4857,
      solidOverlayTile: 557,
      southUpper: [4631, 4632, 4633, 4634],
      southLower: [5018, 5019, 5020, 5021, 5022],
      southSingle: [5130, 5131, 5132, 5133, 5134],
      stairTop: { single: 5256, left: 1858, mid: 1860, right: 1862 },
      stairBottom: { single: 5256, left: 2019, mid: 2021, right: 2022 },
      rimStepTile: 5125,
      bridgeDeck: [24121, 24122, 24123],
    });
    cached[mode] = spec;
    return spec;
  }

  // 2. 버들항 던전 / 3×3 ground-cliff 키트 기반 세트
  const cliffKit = tileset.structureKits?.find((k) =>
    k.width === 3 &&
    k.height === 3 &&
    (mode === "dungeon"
      ? /mining-valley-ground-cliff|snowfield-ground-cliff|ground-cliff/i.test(k.id)
      : /ground-cliff/i.test(k.id)),
  );
  if (cliffKit && cliffKit.rows?.length === 3) {
    const r0 = cliffKit.rows[0]!.tiles;
    const r1 = cliffKit.rows[1]!.tiles;
    const r2 = cliffKit.rows[2]!.tiles;
    const groundTile =
      mode === "dungeon"
        ? (terrainMaterialTile(tileset, "stone") ?? terrainMaterialTile(tileset, "dirt") ?? 0)
        : (reliefTopGrassTile(tileset) ?? terrainMaterialTile(tileset, "grass") ?? 0);
    const plateauCandidate =
      tileset.id === "beodeul_city" && mode === "dungeon"
        ? 25246
        : (terrainMaterialTile(tileset, mode === "dungeon" ? "dirt" : "grass") ?? groundTile);
    const stairSingle = tileset.id === "beodeul_city" ? 5256 : (terrainRoadTile(tileset) ?? plateauCandidate);
    const stairTop = tileset.id === "beodeul_city"
      ? { single: 5256, left: 1858, mid: 1860, right: 1862 }
      : { single: stairSingle, left: stairSingle, mid: stairSingle, right: stairSingle };
    const stairBottom = tileset.id === "beodeul_city"
      ? { single: 5256, left: 2019, mid: 2021, right: 2022 }
      : { single: stairSingle, left: stairSingle, mid: stairSingle, right: stairSingle };
    const bridgeDeck = tileset.id === "beodeul_city"
      ? [24121, 24122, 24123]
      : [terrainRoadTile(tileset) ?? plateauCandidate];
    const spec = buildSets({
      groundTile,
      plateauTile: plateauCandidate === groundTile && isOpenPass(tileset, plateauCandidate + 1) ? plateauCandidate + 1 : plateauCandidate,
      rimNW: r0[0] ?? r1[1]!,
      rimN: [r0[1] ?? r1[1]!],
      rimNE: r0[2] ?? r1[1]!,
      rimW: r1[0] ?? r1[1]!,
      rimE: r1[2] ?? r1[1]!,
      solidOverlayTile: -1,
      southUpper: [r1[1] ?? r2[1]!],
      southLower: [r2[1] ?? r1[1]!],
      southSingle: [r2[1] ?? r1[1]!],
      stairTop,
      stairBottom,
      rimStepTile: terrainRoadTile(tileset) ?? stairSingle,
      bridgeDeck,
    });
    cached[mode] = spec;
    return spec;
  }

  // 3. 범용 폴백
  const groundTile = reliefTopGrassTile(tileset) ?? terrainMaterialTile(tileset, "grass") ?? terrainMaterialTile(tileset, "stone") ?? 0;
  let cliffTile = -1;
  let stairTile = -1;
  let bridgeTile = -1;
  for (let i = 0; i < (tileset.tileMeta?.length ?? 0); i += 1) {
    const m = tileset.tileMeta?.[i];
    if (!m || m.defaultLayer === "upper") continue;
    const text = `${m.role ?? ""} ${m.label ?? ""} ${(m.tags ?? []).join(" ")}`;
    if (cliffTile < 0 && isSolidPass(tileset, i) && /cliff|절벽|옹벽|바위|석축|wall/i.test(text)) cliffTile = i;
    if (stairTile < 0 && isOpenPass(tileset, i) && /stair|계단|비탈|경사/i.test(text)) stairTile = i;
    if (bridgeTile < 0 && isOpenPass(tileset, i) && /bridge|다리|잔교|널판|plank/i.test(text)) bridgeTile = i;
  }
  if (cliffTile < 0) {
    for (let i = 0; i < tileset.passability.length; i += 1) {
      if (isSolidPass(tileset, i)) { cliffTile = i; break; }
    }
  }
  if (cliffTile < 0) {
    cached[mode] = null;
    return null;
  }
  const roadFallback = terrainRoadTile(tileset) ?? groundTile;
  const resolvedStair = stairTile >= 0 ? stairTile : roadFallback;
  const resolvedBridge = bridgeTile >= 0 ? bridgeTile : roadFallback;
  const spec = buildSets({
    groundTile,
    plateauTile: groundTile,
    rimNW: cliffTile,
    rimN: [cliffTile],
    rimNE: cliffTile,
    rimW: cliffTile,
    rimE: cliffTile,
    solidOverlayTile: -1,
    southUpper: [cliffTile],
    southLower: [cliffTile],
    southSingle: [cliffTile],
    stairTop: { single: resolvedStair, left: resolvedStair, mid: resolvedStair, right: resolvedStair },
    stairBottom: { single: resolvedStair, left: resolvedStair, mid: resolvedStair, right: resolvedStair },
    rimStepTile: roadFallback,
    bridgeDeck: [resolvedBridge],
  });
  cached[mode] = spec;
  return spec;
}

function isBorderOrStairCell(map: GameMap, spec: FlatCliffSpec, index: number): boolean {
  const l1 = layerTileAt(map, 1, index);
  const l2 = layerTileAt(map, 2, index);
  return spec.borderAndStairSet.has(l1) || (spec.solidOverlayTile >= 0 && l2 === spec.solidOverlayTile);
}

/**
 * 어니언 필링(양파 껍질 벗기기) BFS로 1:1 타일 격자에서 0~3단 다중 언덕 레벨을 무상태 역추론한다:
 * - 바깥 평지/물(0단)에서 출발해 첫 번째 절벽+계단 폐곡선 고리(ring_1)와 그 안쪽 테라스 평면(terrace_1)을 찾으면 1단.
 * - terrace_1 안쪽에 또 다른 닫힌 절벽+계단 고리(ring_2)가 있으면 그 내부는 2단, 한 번 더 있으면 3단.
 */
export function inferFlatHillLevels(map: GameMap, spec: FlatCliffSpec): Uint8Array {
  const w = map.width;
  const h = map.height;
  const total = w * h;
  const isRingTile = new Uint8Array(total);

  for (let i = 0; i < total; i += 1) {
    if ((map.terrainDesign?.waterDepth?.[i] ?? 0) > 0) continue;
    if (isBorderOrStairCell(map, spec, i)) isRingTile[i] = 1;
  }

  // Step 0: 0단(외부 평지/물) 판별
  const assigned = new Int8Array(total).fill(-1);
  const queue = new Int32Array(total);
  let qEnd = 0;

  const seedZero = (i: number): void => {
    if (assigned[i] !== -1 || isRingTile[i]) return;
    const l1 = layerTileAt(map, 1, i);
    if (spec.plateauTile !== spec.groundTile && l1 === spec.plateauTile) return;
    assigned[i] = 0;
    queue[qEnd++] = i;
  };

  for (let x = 0; x < w; x += 1) {
    seedZero(x);
    seedZero((h - 1) * w + x);
  }
  for (let y = 0; y < h; y += 1) {
    seedZero(y * w);
    seedZero(y * w + (w - 1));
  }
  for (let i = 0; i < total; i += 1) {
    if (assigned[i] !== -1 || isRingTile[i]) continue;
    const l1 = layerTileAt(map, 1, i);
    if ((map.terrainDesign?.waterDepth?.[i] ?? 0) > 0 || l1 === spec.groundTile || l1 < 0) {
      assigned[i] = 0;
      queue[qEnd++] = i;
    }
  }

  for (let q = 0; q < qEnd; q += 1) {
    const cur = queue[q]!;
    const cx = cur % w;
    const cy = Math.floor(cur / w);
    const nbrs = [
      cx > 0 ? cur - 1 : -1,
      cx + 1 < w ? cur + 1 : -1,
      cy > 0 ? cur - w : -1,
      cy + 1 < h ? cur + w : -1,
    ];
    for (const ni of nbrs) {
      if (ni < 0 || assigned[ni] !== -1 || isRingTile[ni]) continue;
      if (spec.plateauTile !== spec.groundTile && layerTileAt(map, 1, ni) === spec.plateauTile) continue;
      assigned[ni] = 0;
      queue[qEnd++] = ni;
    }
  }

  // Step 1..MAX_FLAT_HILL_TIER: 각 단의 외곽 절벽 고리(ring_k)와 테라스(terrace_k)를 차례로 벗겨낸다.
  for (let tier = 1; tier <= MAX_FLAT_HILL_TIER; tier += 1) {
    const prevTier = tier - 1;
    const inCurrentRing = new Uint8Array(total);

    // prevTier 에 8방향으로 맞닿은 절벽/테두리/계단 칸은 현재 단의 외곽 고리(ring_tier)다.
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = y * w + x;
        if (assigned[i] !== -1 || !isRingTile[i]) continue;
        let touchesPrev = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        for (let dy = -1; dy <= 1 && !touchesPrev; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < w && ny < h && assigned[ny * w + nx] === prevTier) {
              touchesPrev = true;
              break;
            }
          }
        }
        if (touchesPrev) inCurrentRing[i] = 1;
      }
    }

    // 2줄짜리 남쪽 절벽/계단의 윗줄(southUpper / stairTop)도 바로 아랫칸이 ring_tier 면 같은 고리에 포함한다.
    for (let y = h - 2; y >= 0; y -= 1) {
      for (let x = 0; x < w; x += 1) {
        const i = y * w + x;
        const below = (y + 1) * w + x;
        if (assigned[i] !== -1 || inCurrentRing[i] || !isRingTile[i] || !inCurrentRing[below]) continue;
        const l1 = layerTileAt(map, 1, i);
        if (spec.southUpperSet.has(l1) || spec.stairSet.has(l1)) {
          inCurrentRing[i] = 1;
        }
      }
    }

    for (let i = 0; i < total; i += 1) {
      if (inCurrentRing[i]) assigned[i] = tier;
    }

    if (tier === MAX_FLAT_HILL_TIER) {
      for (let i = 0; i < total; i += 1) {
        if (assigned[i] === -1) assigned[i] = tier;
      }
      break;
    }

    // ring_tier 안쪽에 맞닿은 비-테두리 평면 칸에서 시작해 다음 내부 절벽 고리(ring_{tier+1}) 전까지 terrace_tier 를 채운다.
    let tEnd = 0;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = y * w + x;
        if (assigned[i] !== -1 || isRingTile[i]) continue;
        const touchesRing =
          (x > 0 && inCurrentRing[i - 1] === 1) ||
          (x + 1 < w && inCurrentRing[i + 1] === 1) ||
          (y > 0 && inCurrentRing[i - w] === 1) ||
          (y + 1 < h && inCurrentRing[i + w] === 1);
        if (touchesRing) {
          assigned[i] = tier;
          queue[tEnd++] = i;
        }
      }
    }
    for (let q = 0; q < tEnd; q += 1) {
      const cur = queue[q]!;
      const cx = cur % w;
      const cy = Math.floor(cur / w);
      const nbrs = [
        cx > 0 ? cur - 1 : -1,
        cx + 1 < w ? cur + 1 : -1,
        cy > 0 ? cur - w : -1,
        cy + 1 < h ? cur + w : -1,
      ];
      for (const ni of nbrs) {
        if (ni < 0 || assigned[ni] !== -1 || isRingTile[ni]) continue;
        assigned[ni] = tier;
        queue[tEnd++] = ni;
      }
    }
  }

  const out = new Uint8Array(total);
  for (let i = 0; i < total; i += 1) {
    out[i] = Math.max(0, assigned[i]!);
  }
  return out;
}

export function inferFlatHillMask(map: GameMap, spec: FlatCliffSpec): Uint8Array {
  const levels = inferFlatHillLevels(map, spec);
  const mask = new Uint8Array(levels.length);
  for (let i = 0; i < levels.length; i += 1) mask[i] = levels[i]! > 0 ? 1 : 0;
  return mask;
}

/**
 * 첫 클릭 위치 (x, y) 의 작업 목표 단차를 결정한다:
 * - action === "raise":
 *   - 평지(0단) 또는 현재 단의 절벽 테두리 위에서 시작 → 그 단(최소 1단)을 넓히기
 *   - 이미 만들어진 고원의 안쪽 평면(잔디/길) 위에서 시작 → 한 단 더 높은 언덕(최대 3단) 적층!
 * - action === "flatten":
 *   - 고원(k단) 위에서 시작 → (k - 1)단으로 한 단 깎아 내리기 (평지면 0단 유지)
 */
export function resolveFlatHillTargetTier(
  map: GameMap,
  tileset: TilesetDef | undefined,
  x: number,
  y: number,
  action: "raise" | "flatten",
  contextMode: "outdoor" | "dungeon" = "outdoor",
): number {
  const spec = resolveFlatCliffSpec(tileset, contextMode);
  if (!spec || x < 0 || y < 0 || x >= map.width || y >= map.height) {
    return action === "raise" ? 1 : 0;
  }
  const idx = y * map.width + x;
  const levels = inferFlatHillLevels(map, spec);
  const curLevel = levels[idx] ?? 0;

  if (action === "flatten") {
    return Math.max(0, curLevel - 1);
  }

  if (curLevel === 0) return 1;
  // 절벽 벽면이나 테두리를 잡고 바깥으로 끌 때는 같은 단을 넓히고, 고원 안쪽 바닥을 누르고 끌 때는 한 단 위로 쌓는다!
  if (isBorderOrStairCell(map, spec, idx)) {
    return curLevel;
  }
  return Math.min(MAX_FLAT_HILL_TIER, curLevel + 1);
}

function openRectangles(mask: Uint8Array, width: number, height: number, minW = 3, minH = 4): Uint8Array {
  const out = new Uint8Array(width * height);
  if (width < minW || height < minH) return out;
  for (let y0 = 0; y0 <= height - minH; y0 += 1) {
    for (let x0 = 0; x0 <= width - minW; x0 += 1) {
      let full = true;
      for (let dy = 0; dy < minH && full; dy += 1) {
        const rowOffset = (y0 + dy) * width + x0;
        for (let dx = 0; dx < minW; dx += 1) {
          if (!mask[rowOffset + dx]) {
            full = false;
            break;
          }
        }
      }
      if (!full) continue;
      for (let dy = 0; dy < minH; dy += 1) {
        const rowOffset = (y0 + dy) * width + x0;
        for (let dx = 0; dx < minW; dx += 1) {
          out[rowOffset + dx] = 1;
        }
      }
    }
  }
  return out;
}

/**
 * 상위 단(k단)이 하위 단(k-1단) 위에 자연스럽게 얹히려면:
 * 좌·우·북쪽에 최소 2칸(외곽 테두리 1 + 걸을 수 있는 테라스 1), 남쪽에 최소 3칸(걸을 수 있는 테라스 1 + 남쪽 2단 절벽 2)의 받침이 필요하다.
 * - expandBase === true (적층 그리기 중): 상위 단에 맞춰 하위 단 받침을 자동으로 살짝 넓혀 준다.
 * - expandBase === false (깎기 중): 하위 단이 깎여 받침을 잃은 상위 단 가장자리를 함께 깎아 내린다.
 */
function normalizeMultiTierMasks(
  masks: Uint8Array[],
  width: number,
  height: number,
  locks: Pick<GameMap, "terrainDesign">,
  expandBase: boolean,
): void {
  if (expandBase) {
    // 위에서 아래로: 상위 단을 먼저 3×4 정리한 뒤, 하위 단이 상위 단 둘레(좌우2, 북2, 남3)를 품도록 자동 확장한다.
    for (let k = masks.length - 1; k >= 1; k -= 1) {
      masks[k] = openRectangles(masks[k]!, width, height, 3, 4);
      if (k > 1) {
        const upper = masks[k]!;
        const lower = masks[k - 1]!;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            if (!upper[y * width + x]) continue;
            for (let dy = -2; dy <= 3; dy += 1) {
              for (let dx = -2; dx <= 2; dx += 1) {
                const nx = Math.min(width - 1, Math.max(0, x + dx));
                const ny = Math.min(height - 1, Math.max(0, y + dy));
                const ni = ny * width + nx;
                if (!terrainLocked(locks.terrainDesign, ni)) lower[ni] = 1;
              }
            }
          }
        }
      }
    }
  }

  // 아래에서 위로: 하위 단(3×4 정리) 안쪽 여백 안에 실제로 들어오는 상위 단만 남기고 다시 3×4 정리한다.
  for (let k = 1; k < masks.length; k += 1) {
    if (k > 1) {
      const lower = masks[k - 1]!;
      const upper = masks[k]!;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = y * width + x;
          if (!upper[i]) continue;
          let supported = true;
          for (let dy = -2; dy <= 3 && supported; dy += 1) {
            for (let dx = -2; dx <= 2; dx += 1) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= width || ny >= height || !lower[ny * width + nx]) {
                supported = false;
                break;
              }
            }
          }
          if (!supported) upper[i] = 0;
        }
      }
    }
    masks[k] = openRectangles(masks[k]!, width, height, 3, 4);
  }
}

function expandHillAdditionCells(
  map: Pick<GameMap, "width" | "height" | "terrainDesign">,
  cells: readonly number[],
): number[] {
  if (!cells.length) return [];
  let minX = map.width;
  let maxX = -1;
  let minY = map.height;
  let maxY = -1;
  for (const i of cells) {
    const x = i % map.width;
    const y = Math.floor(i / map.width);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const spanW = maxX - minX + 1;
  const spanH = maxY - minY + 1;
  const padL = spanW < 3 ? Math.ceil((3 - spanW) / 2) : 0;
  const padR = spanW < 3 ? Math.floor((3 - spanW) / 2) : 0;
  const padT = spanH < 4 ? Math.floor((4 - spanH) / 2) : 0;
  const padB = spanH < 4 ? Math.ceil((4 - spanH) / 2) : 0;

  const out = new Set<number>();
  for (const i of cells) {
    const cx = i % map.width;
    const cy = Math.floor(i / map.width);
    for (let dy = -padT; dy <= padB; dy += 1) {
      for (let dx = -padL; dx <= padR; dx += 1) {
        const x = Math.min(map.width - 1, Math.max(0, cx + dx));
        const y = Math.min(map.height - 1, Math.max(0, cy + dy));
        const idx = y * map.width + x;
        if (!terrainLocked(map.terrainDesign, idx)) out.add(idx);
      }
    }
  }
  return [...out];
}

function neighbourhood(map: Pick<GameMap, "width" | "height">, cells: Iterable<number>): { x: number; y: number; layer: "lower" }[] {
  const dirty = new Map<number, { x: number; y: number; layer: "lower" }>();
  for (const i of cells) {
    const cx = i % map.width;
    const cy = Math.floor(i / map.width);
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && y >= 0 && x < map.width && y < map.height) {
          dirty.set(y * map.width + x, { x, y, layer: "lower" });
        }
      }
    }
  }
  return [...dirty.values()];
}

function clearLegacyReliefCells(draft: GameMap, indices: Iterable<number>): void {
  if (!draft.relief) return;
  const levels = draft.relief.levels.slice();
  const ramps = draft.relief.ramps?.slice();
  let changed = false;
  for (const i of indices) {
    if (levels[i]) { levels[i] = 0; changed = true; }
    if (ramps && ramps[i]) { ramps[i] = 0; changed = true; }
  }
  if (!changed) return;
  const nextRelief = { ...draft.relief, levels, ...(ramps ? { ramps } : {}) };
  if (reliefIsFlat(nextRelief)) delete draft.relief;
  else draft.relief = nextRelief;
}

function stampSouthStairSpan(
  nextL1: Int32Array,
  nextL2: Int32Array,
  width: number,
  x0: number,
  x1: number,
  yTop: number,
  yBot: number,
  spec: FlatCliffSpec,
): void {
  const span = x1 - x0 + 1;
  for (let x = x0; x <= x1; x += 1) {
    const topIdx = yTop * width + x;
    const botIdx = yBot * width + x;
    if (span === 1) {
      nextL1[topIdx] = spec.stairTop.single;
      nextL1[botIdx] = spec.stairBottom.single;
    } else if (x === x0) {
      nextL1[topIdx] = spec.stairTop.left;
      nextL1[botIdx] = spec.stairBottom.left;
    } else if (x === x1) {
      nextL1[topIdx] = spec.stairTop.right;
      nextL1[botIdx] = spec.stairBottom.right;
    } else {
      nextL1[topIdx] = spec.stairTop.mid;
      nextL1[botIdx] = spec.stairBottom.mid;
    }
    nextL2[topIdx] = -1;
    nextL2[botIdx] = -1;
  }
}

function applyHillLevelsToDraft(
  beforeMap: GameMap,
  draft: GameMap,
  tileset: TilesetDef,
  spec: FlatCliffSpec,
  prevLevels: Uint8Array,
  nextLevels: Uint8Array,
  protectedStairMask: Uint8Array,
  forceGroundCells: ReadonlySet<number>,
): Set<number> {
  const w = draft.width;
  const h = draft.height;
  const lvlAt = (x: number, y: number): number => (x >= 0 && y >= 0 && x < w && y < h ? nextLevels[y * w + x]! : 0);
  const changed = new Set<number>();

  const nextL1 = new Int32Array(w * h);
  const nextL2 = new Int32Array(w * h);
  for (let i = 0; i < w * h; i += 1) {
    nextL1[i] = layerTileAt(draft, 1, i);
    nextL2[i] = layerTileAt(draft, 2, i);
  }

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      if (terrainLocked(draft.terrainDesign, i)) continue;
      const curLvl = nextLevels[i]!;

      if (curLvl >= 1) {
        const n = lvlAt(x, y - 1) >= curLvl;
        const s = lvlAt(x, y + 1) >= curLvl;
        const s2 = lvlAt(x, y + 2) >= curLvl;
        const west = lvlAt(x - 1, y) >= curLvl;
        const east = lvlAt(x + 1, y) >= curLvl;

        let targetL1 = spec.plateauTile;
        let targetL2 = -1;

        if (!s) {
          targetL1 = !n
            ? spec.southSingle[Math.abs(x * 3 + y) % spec.southSingle.length]!
            : spec.southLower[Math.abs(x * 3 + y) % spec.southLower.length]!;
        } else if (!s2 && n) {
          targetL1 = spec.southUpper[Math.abs(x) % spec.southUpper.length]!;
        } else if (!n && !west) {
          targetL1 = spec.rimNW;
          targetL2 = spec.solidOverlayTile;
        } else if (!n && !east) {
          targetL1 = spec.rimNE;
          targetL2 = spec.solidOverlayTile;
        } else if (!n) {
          targetL1 = spec.rimN[Math.abs(x + y) % spec.rimN.length]!;
          targetL2 = spec.solidOverlayTile;
        } else if (!west) {
          targetL1 = spec.rimW;
          targetL2 = spec.solidOverlayTile;
        } else if (!east) {
          targetL1 = spec.rimE;
          targetL2 = spec.solidOverlayTile;
        } else {
          const prevTile = layerTileAt(beforeMap, 1, i);
          const keepCustomFloor =
            prevLevels[i] === curLvl &&
            !forceGroundCells.has(i) &&
            prevTile >= 0 &&
            prevTile !== spec.groundTile &&
            !spec.hillSignatureSet.has(prevTile);
          targetL1 = keepCustomFloor ? prevTile : spec.plateauTile;
          targetL2 = -1;
        }

        nextL1[i] = targetL1;
        nextL2[i] = targetL2;
      } else if (prevLevels[i]! >= 1 || forceGroundCells.has(i)) {
        nextL1[i] = spec.groundTile;
        nextL2[i] = -1;
      }
    }
  }

  // 각 단의 남쪽 절벽에 원래 있던 돌계단 보존
  for (let tier = 1; tier <= MAX_FLAT_HILL_TIER; tier += 1) {
    for (let y = 1; y < h; y += 1) {
      let x = 0;
      while (x < w) {
        const botIdx = y * w + x;
        const topIdx = (y - 1) * w + x;
        const isTierSouthWallPair =
          nextLevels[botIdx] === tier &&
          lvlAt(x, y + 1) < tier &&
          nextLevels[topIdx] === tier &&
          (protectedStairMask[botIdx] === 1 || protectedStairMask[topIdx] === 1);
        if (!isTierSouthWallPair) {
          x += 1;
          continue;
        }
        let xEnd = x;
        while (
          xEnd + 1 < w &&
          nextLevels[y * w + (xEnd + 1)] === tier &&
          lvlAt(xEnd + 1, y + 1) < tier &&
          nextLevels[(y - 1) * w + (xEnd + 1)] === tier &&
          (protectedStairMask[y * w + (xEnd + 1)] === 1 || protectedStairMask[(y - 1) * w + (xEnd + 1)] === 1)
        ) {
          xEnd += 1;
        }
        stampSouthStairSpan(nextL1, nextL2, w, x, xEnd, y - 1, y, spec);
        x = xEnd + 1;
      }
    }
  }

  const prevTiles: { index: number; prev: number; next: number }[] = [];
  for (let i = 0; i < w * h; i += 1) {
    const cur1 = layerTileAt(draft, 1, i);
    const cur2 = layerTileAt(draft, 2, i);
    if (cur1 !== nextL1[i] || cur2 !== nextL2[i]) {
      clearTileStack(draft, "lower", i);
      setLayerTileAt(draft, 1, i, nextL1[i]!);
      setLayerTileAt(draft, 2, i, nextL2[i]!);
      prevTiles.push({ index: i, prev: cur1, next: nextL1[i]! });
      changed.add(i);
    }
  }

  if (draft.terrainDesign?.waterDepth) {
    const depth = draft.terrainDesign.waterDepth.slice();
    let depthChanged = false;
    for (let i = 0; i < w * h; i += 1) {
      if ((nextLevels[i]! >= 1 || forceGroundCells.has(i)) && depth[i]! > 0) {
        depth[i] = 0;
        depthChanged = true;
        changed.add(i);
      }
    }
    if (depthChanged) {
      draft.terrainDesign = { ...draft.terrainDesign, waterDepth: depth };
      const norm = normalizeTerrainDesign(draft.terrainDesign, w * h);
      if (norm) draft.terrainDesign = norm;
      else delete draft.terrainDesign;
    }
  }

  if (prevTiles.length) {
    const points = prevTiles.map((e) => ({ x: e.index % w, y: Math.floor(e.index / w) }));
    for (const group of autotileGroupsForTileset(tileset)) {
      if ((group.layer ?? "lower") !== "lower") continue;
      if (prevTiles.some((e) => autotileEditTriggersGroup(group, e.prev, e.next))) {
        shapeAutotileGroupAround(draft, group, points);
      }
    }
  }

  clearLegacyReliefCells(draft, changed);
  compactMapLayers(draft);
  return changed;
}

/**
 * 1:1 다중 언덕 그리기("raise") 및 순차 지형 깎기("flatten"):
 * - mode === "raise": targetTier(1~3단) 마스크에 칠한 칸을 추가하고 하위 받침 테라스까지 정돈해 다중 절벽을 만든다.
 * - mode === "flatten": 칠한 칸을 targetTier(0~2단) 이하로 한 단 깎아 내리고 남은 각 단 절벽을 다시 감싼다.
 */
export function paintFlatHillOrGroundCells(
  mapId: MapId,
  cells: readonly number[],
  mode: "raise" | "flatten",
  contextMode: "outdoor" | "dungeon" = "outdoor",
  targetTier?: number,
): boolean {
  const project = store.getCurrent();
  const map = project.maps[mapId];
  if (!map || !cells.length) return false;
  const tileset = project.tilesets[map.tilesetId];
  const spec = resolveFlatCliffSpec(tileset, contextMode);
  if (!tileset || !spec) return false;

  const editable = cells.filter((i) => i >= 0 && i < map.width * map.height && !terrainLocked(map.terrainDesign, i));
  if (!editable.length) return false;

  const prevLevels = inferFlatHillLevels(map, spec);
  const masks: Uint8Array[] = [new Uint8Array(prevLevels.length)];
  for (let k = 1; k <= MAX_FLAT_HILL_TIER; k += 1) {
    const m = new Uint8Array(prevLevels.length);
    for (let i = 0; i < prevLevels.length; i += 1) m[i] = prevLevels[i]! >= k ? 1 : 0;
    masks.push(m);
  }

  const touchedSet = new Set<number>();
  const resolvedTier = targetTier !== undefined
    ? Math.max(0, Math.min(MAX_FLAT_HILL_TIER, targetTier))
    : (mode === "raise" ? 1 : 0);

  if (mode === "raise") {
    const tier = Math.max(1, resolvedTier);
    const expanded = expandHillAdditionCells(map, editable);
    for (const i of expanded) {
      for (let k = 1; k <= tier; k += 1) masks[k]![i] = 1;
      touchedSet.add(i);
    }
    normalizeMultiTierMasks(masks, map.width, map.height, map, true);
  } else {
    const capTier = Math.max(0, resolvedTier);
    for (const i of editable) {
      for (let k = capTier + 1; k <= MAX_FLAT_HILL_TIER; k += 1) {
        masks[k]![i] = 0;
      }
      touchedSet.add(i);
    }
    normalizeMultiTierMasks(masks, map.width, map.height, map, false);
  }

  const nextLevels = new Uint8Array(prevLevels.length);
  for (let k = 1; k <= MAX_FLAT_HILL_TIER; k += 1) {
    const m = masks[k]!;
    for (let i = 0; i < nextLevels.length; i += 1) {
      if (m[i]) nextLevels[i] = k;
    }
  }

  const protectedStairMask = new Uint8Array(map.width * map.height);
  for (let i = 0; i < map.width * map.height; i += 1) {
    if (!touchedSet.has(i) && spec.stairSet.has(layerTileAt(map, 1, i))) {
      protectedStairMask[i] = 1;
    }
  }

  const forceGround = mode === "flatten" && resolvedTier === 0 ? new Set<number>(editable) : new Set<number>();
  let anyDiff = false;
  for (let i = 0; i < nextLevels.length; i += 1) {
    if (prevLevels[i] !== nextLevels[i]) { anyDiff = true; break; }
  }
  if (!anyDiff && forceGround.size > 0) {
    anyDiff = editable.some((i) =>
      layerTileAt(map, 1, i) !== spec.groundTile ||
      layerTileAt(map, 2, i) >= 0 ||
      (map.terrainDesign?.waterDepth?.[i] ?? 0) > 0 ||
      (map.relief?.levels[i] ?? 0) > 0,
    );
  }
  if (!anyDiff) return false;

  const dirtyEstimate = new Set<number>(touchedSet);
  for (let i = 0; i < nextLevels.length; i += 1) {
    if (prevLevels[i] !== nextLevels[i]) dirtyEstimate.add(i);
  }

  let didChange = false;
  store.updateMapTiles(
    mapId,
    (draft) => {
      const changed = applyHillLevelsToDraft(map, draft, tileset, spec, prevLevels, nextLevels, protectedStairMask, forceGround);
      didChange = changed.size > 0;
    },
    {
      label: mode === "raise" ? `지형 · ${Math.max(1, resolvedTier)}단 언덕` : "지형 · 땅(깎기)",
      cells: neighbourhood(map, dirtyEstimate),
      ...(map.relief ? { relief: true } : {}),
    },
  );
  return didChange;
}

export function paintFlatWaterCells(
  mapId: MapId,
  cells: readonly number[],
  soften = false,
  contextMode: "outdoor" | "dungeon" = "outdoor",
): boolean {
  const project = store.getCurrent();
  const map = project.maps[mapId];
  if (!map || !cells.length) return false;
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return false;

  const lakeshore = autotileGroupsForTileset(tileset).find((g) => g.id === "beodeul_lakeshore_grass");
  const waterTile = lakeshore ? lakeshore.variantMap["255"] : terrainMaterialTile(tileset, "water");
  if (waterTile === undefined || waterTile < 0) return false;

  const points = (soften ? softenShore(map, cells) : [...cells]).filter(
    (i) => i >= 0 && i < map.width * map.height && !terrainLocked(map.terrainDesign, i),
  );
  if (!points.length) return false;

  const spec = resolveFlatCliffSpec(tileset, contextMode);
  const prevLevels = spec ? inferFlatHillLevels(map, spec) : null;
  let nextLevels: Uint8Array | null = null;
  const protectedStairMask = new Uint8Array(map.width * map.height);

  if (spec && prevLevels) {
    const masks: Uint8Array[] = [new Uint8Array(prevLevels.length)];
    for (let k = 1; k <= MAX_FLAT_HILL_TIER; k += 1) {
      const m = new Uint8Array(prevLevels.length);
      for (let i = 0; i < prevLevels.length; i += 1) m[i] = prevLevels[i]! >= k ? 1 : 0;
      for (const p of points) m[p] = 0;
      masks.push(m);
    }
    normalizeMultiTierMasks(masks, map.width, map.height, map, false);
    nextLevels = new Uint8Array(prevLevels.length);
    for (let k = 1; k <= MAX_FLAT_HILL_TIER; k += 1) {
      const m = masks[k]!;
      for (let i = 0; i < nextLevels.length; i += 1) if (m[i]) nextLevels[i] = k;
    }
    const pointSet = new Set(points);
    for (let i = 0; i < prevLevels.length; i += 1) {
      if (!pointSet.has(i) && spec.stairSet.has(layerTileAt(map, 1, i))) {
        protectedStairMask[i] = 1;
      }
    }
  }

  const depthBefore = map.terrainDesign?.waterDepth;
  const wet = new Set<number>(points);
  for (let i = 0; i < map.width * map.height; i += 1) {
    if ((depthBefore?.[i] ?? 0) > 0) wet.add(i);
  }
  const depth = new Array<number>(map.width * map.height).fill(0);
  const queue: number[] = [];
  for (const i of wet) {
    const x = i % map.width;
    const y = Math.floor(i / map.width);
    const shore = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx!;
      const ny = y + dy!;
      return nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || !wet.has(ny * map.width + nx);
    });
    if (shore) {
      depth[i] = 1;
      queue.push(i);
    }
  }
  for (let n = 0; n < queue.length; n += 1) {
    const i = queue[n]!;
    const x = i % map.width;
    const y = Math.floor(i / map.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const j = ny * map.width + nx;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || !wet.has(j) || depth[j]) continue;
      depth[j] = Math.min(14, depth[i]! + 1);
      queue.push(j);
    }
  }

  const groups = autotileGroupsForTileset(tileset).filter((g) => (g.layer ?? "lower") === "lower");
  const waterGroup = lakeshore ?? groups.find((g) => g.memberTileIds.includes(waterTile));
  const affected = new Set<number>(points);
  if (prevLevels && nextLevels) {
    for (let i = 0; i < prevLevels.length; i += 1) {
      if (prevLevels[i] !== nextLevels[i]) affected.add(i);
    }
  }

  store.updateMapTiles(
    mapId,
    (draft) => {
      if (spec && prevLevels && nextLevels) {
        applyHillLevelsToDraft(map, draft, tileset, spec, prevLevels, nextLevels, protectedStairMask, new Set());
      }
      const prevTiles = points.map((i) => layerTileAt(draft, 1, i));
      const xy = points.map((i) => ({ x: i % draft.width, y: Math.floor(i / draft.width) }));
      for (const i of points) {
        clearTileStack(draft, "lower", i);
        setLayerTileAt(draft, 1, i, waterTile);
        setLayerTileAt(draft, 2, i, -1);
      }
      const nextDepth = depth.map((d, i) => (terrainLocked(map.terrainDesign, i) ? depthBefore?.[i] ?? 0 : d));
      draft.terrainDesign = { ...draft.terrainDesign, waterDepth: nextDepth };
      for (const group of groups) {
        if (group !== waterGroup && prevTiles.some((v) => autotileEditTriggersGroup(group, v, waterTile))) {
          shapeAutotileGroupAround(draft, group, xy);
        }
      }
      if (waterGroup) shapeAutotileGroupAround(draft, waterGroup, xy);
      clearLegacyReliefCells(draft, points);
      compactMapLayers(draft);
    },
    {
      label: "지형 · 물",
      cells: neighbourhood(map, affected),
      ...(map.relief ? { relief: true } : {}),
    },
  );
  return true;
}

function roadFootprint(map: Pick<GameMap, "width" | "height">, points: readonly TerrainPoint[], width: number): TerrainPoint[] {
  const cells = new Map<number, TerrainPoint>();
  const half = Math.floor((width - 1) / 2);
  points.forEach((p, n) => {
    const neighbours = [points[n - 1], points[n + 1]].filter((q): q is TerrainPoint => Boolean(q));
    if (!neighbours.length) neighbours.push({ x: p.x, y: p.y + 1 });
    for (const q of neighbours) {
      for (let side = -half; side < width - half; side += 1) {
        const x = p.x + (q.y !== p.y ? side : 0);
        const y = p.y + (q.x !== p.x ? side : 0);
        if (x >= 0 && y >= 0 && x < map.width && y < map.height) {
          cells.set(y * map.width + x, { x, y });
        }
      }
    }
  });
  return [...cells.values()];
}

function buildWaterTileSet(tileset: TilesetDef): Set<number> {
  const set = new Set<number>();
  const baseWater = terrainMaterialTile(tileset, "water");
  if (baseWater !== undefined && baseWater >= 0) set.add(baseWater);
  for (const g of autotileGroupsForTileset(tileset)) {
    if (/water|river|lake|canal|lakeshore|lava|물|강|호수|운하|용암/i.test(`${g.id} ${g.name}`)) {
      for (const id of g.memberTileIds) set.add(id);
    }
  }
  return set;
}

export function paintFlatRoadStroke(
  mapId: MapId,
  rawPoints: readonly TerrainPoint[],
  width: number,
  symmetry: GameMap["terrainDesign"] extends never ? never : import("./editorState").EditorState["terrainSymmetry"],
  contextMode: "outdoor" | "dungeon" = "outdoor",
): { ok: boolean; stairs: number; bridges: number; cells: number } {
  const project = store.getCurrent();
  const map = project.maps[mapId];
  if (!map || rawPoints.length < 2) return { ok: false, stairs: 0, bridges: 0, cells: 0 };
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return { ok: false, stairs: 0, bridges: 0, cells: 0 };

  const spec = resolveFlatCliffSpec(tileset, contextMode);
  const roadTile = terrainRoadTile(tileset) ?? terrainMaterialTile(tileset, "dirt") ?? spec?.rimStepTile ?? 0;
  const waterSet = buildWaterTileSet(tileset);

  const footprintIndices = new Set<number>();
  const centerlineIndices = new Set<number>();
  for (const variant of symmetryVariants(symmetry, map.width, map.height)) {
    const transformed = rawPoints.map((p) => transformPoint(p, map.width, map.height, variant));
    const line = lineCells(transformed);
    for (const lp of line) {
      if (lp.x >= 0 && lp.y >= 0 && lp.x < map.width && lp.y < map.height) {
        centerlineIndices.add(lp.y * map.width + lp.x);
      }
    }
    for (const pt of roadFootprint(map, line, width)) {
      const idx = pt.y * map.width + pt.x;
      if (!terrainLocked(map.terrainDesign, idx)) footprintIndices.add(idx);
    }
  }
  if (!footprintIndices.size) return { ok: false, stairs: 0, bridges: 0, cells: 0 };

  const stairColumnsByBotY = new Map<number, Set<number>>();
  const stairCellSet = new Set<number>();
  const half = Math.floor((width - 1) / 2);

  if (spec) {
    for (const idx of centerlineIndices) {
      const cx = idx % map.width;
      const cy = Math.floor(idx / map.width);
      const t = layerTileAt(map, 1, idx);
      let botY = -1;
      if (spec.southLowerSet.has(t) || spec.stairSet.has(t)) {
        const upIdx = cy > 0 ? (cy - 1) * map.width + cx : -1;
        const upTile = upIdx >= 0 ? layerTileAt(map, 1, upIdx) : -1;
        botY = upIdx >= 0 && (spec.southUpperSet.has(upTile) || spec.stairSet.has(upTile))
          ? cy
          : (cy + 1 < map.height && spec.southLowerSet.has(layerTileAt(map, 1, (cy + 1) * map.width + cx)) ? cy + 1 : cy);
      } else if (spec.southUpperSet.has(t) && cy + 1 < map.height) {
        botY = cy + 1;
      }
      if (botY < 0) continue;
      let set = stairColumnsByBotY.get(botY);
      if (!set) { set = new Set<number>(); stairColumnsByBotY.set(botY, set); }
      for (let side = -half; side < width - half; side += 1) {
        const x = cx + side;
        if (x < 0 || x >= map.width) continue;
        const botTile = layerTileAt(map, 1, botY * map.width + x);
        if (spec.southLowerSet.has(botTile) || spec.stairSet.has(botTile)) {
          set.add(x);
        }
      }
    }
  }

  const nextL1 = new Int32Array(map.width * map.height);
  const nextL2 = new Int32Array(map.width * map.height);
  for (let i = 0; i < map.width * map.height; i += 1) {
    nextL1[i] = layerTileAt(map, 1, i);
    nextL2[i] = layerTileAt(map, 2, i);
  }

  let stairSpans = 0;
  if (spec) {
    for (const [botY, cols] of stairColumnsByBotY) {
      const sorted = [...cols].sort((a, b) => a - b);
      let k = 0;
      while (k < sorted.length) {
        const x0 = sorted[k]!;
        let x1 = x0;
        while (k + 1 < sorted.length && sorted[k + 1] === x1 + 1) {
          k += 1;
          x1 = sorted[k]!;
        }
        const topY = Math.max(0, botY - 1);
        const topHasUpper = topY < botY && (spec.southUpperSet.has(layerTileAt(map, 1, topY * map.width + x0)) || spec.stairSet.has(layerTileAt(map, 1, topY * map.width + x0)));
        if (topHasUpper) {
          stampSouthStairSpan(nextL1, nextL2, map.width, x0, x1, topY, botY, spec);
          for (let x = x0; x <= x1; x += 1) {
            stairCellSet.add(topY * map.width + x);
            stairCellSet.add(botY * map.width + x);
          }
        } else {
          for (let x = x0; x <= x1; x += 1) {
            const bi = botY * map.width + x;
            nextL1[bi] = spec.stairBottom.single;
            nextL2[bi] = -1;
            stairCellSet.add(bi);
          }
        }
        stairSpans += 1;
        k += 1;
      }
    }
  }

  const bridgeCells = new Set<number>();
  const roadCells: number[] = [];

  for (const idx of footprintIndices) {
    if (stairCellSet.has(idx)) continue;
    if (layerTileAt(map, 3, idx) >= 0 || layerTileAt(map, 4, idx) >= 0) continue;
    if (map.events.some((e) => e.x === idx % map.width && e.y === Math.floor(idx / map.width))) continue;

    const cur1 = layerTileAt(map, 1, idx);
    const cur2 = layerTileAt(map, 2, idx);
    const isWet = (map.terrainDesign?.waterDepth?.[idx] ?? 0) > 0 || waterSet.has(cur1);

    if (isWet && spec) {
      const deck = spec.bridgeDeck[Math.abs(idx) % spec.bridgeDeck.length]!;
      nextL1[idx] = deck;
      nextL2[idx] = -1;
      bridgeCells.add(idx);
      continue;
    }

    if (spec && (spec.southUpperSet.has(cur1) || spec.southLowerSet.has(cur1) || spec.stairSet.has(cur1))) {
      continue;
    }

    if (spec && (spec.rimSet.has(cur1) || (spec.solidOverlayTile >= 0 && cur2 === spec.solidOverlayTile))) {
      if (!centerlineIndices.has(idx)) continue;
      nextL1[idx] = roadTile;
      nextL2[idx] = -1;
      roadCells.push(idx);
      stairSpans += 1;
      continue;
    }

    nextL1[idx] = roadTile;
    nextL2[idx] = -1;
    roadCells.push(idx);
  }

  const allTouched = new Set<number>([...stairCellSet, ...bridgeCells, ...roadCells]);
  if (!allTouched.size) return { ok: false, stairs: 0, bridges: 0, cells: 0 };

  store.updateMapTiles(
    mapId,
    (draft) => {
      const prevRoadEdits: { index: number; prev: number; next: number }[] = [];
      for (const idx of allTouched) {
        const prev1 = layerTileAt(draft, 1, idx);
        clearTileStack(draft, "lower", idx);
        setLayerTileAt(draft, 1, idx, nextL1[idx]!);
        setLayerTileAt(draft, 2, idx, nextL2[idx]!);
        if (!stairCellSet.has(idx) && !bridgeCells.has(idx)) {
          prevRoadEdits.push({ index: idx, prev: prev1, next: nextL1[idx]! });
        }
      }

      if (bridgeCells.size > 0 && draft.terrainDesign?.waterDepth) {
        const depth = draft.terrainDesign.waterDepth.slice();
        for (const bi of bridgeCells) depth[bi] = 0;
        draft.terrainDesign = { ...draft.terrainDesign, waterDepth: depth };
        const norm = normalizeTerrainDesign(draft.terrainDesign, draft.width * draft.height);
        if (norm) draft.terrainDesign = norm;
        else delete draft.terrainDesign;
      }

      if (prevRoadEdits.length > 0) {
        const roadPts = prevRoadEdits.map((e) => ({ x: e.index % draft.width, y: Math.floor(e.index / draft.width) }));
        for (const group of autotileGroupsForTileset(tileset)) {
          if ((group.layer ?? "lower") !== "lower") continue;
          if (waterSet.has(group.memberTileIds[0] ?? -1)) continue;
          if (prevRoadEdits.some((e) => autotileEditTriggersGroup(group, e.prev, e.next))) {
            shapeAutotileGroupAround(draft, group, roadPts);
          }
        }
      }

      clearLegacyReliefCells(draft, allTouched);
      compactMapLayers(draft);
    },
    {
      label: "지형 · 길",
      cells: neighbourhood(map, allTouched),
      ...(map.relief ? { relief: true } : {}),
    },
  );

  return {
    ok: true,
    stairs: stairSpans,
    bridges: bridgeCells.size,
    cells: allTouched.size,
  };
}

export { cloneExtraLayers };
