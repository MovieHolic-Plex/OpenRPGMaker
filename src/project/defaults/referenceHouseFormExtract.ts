// project/defaults/referenceHouseFormExtract.ts
// 완성 맵 참고 사례(regionReferences/*.json)에서 건물을 잘라 저작 집 형태(셀 레시피)로 만든다.
//
// 왜 필요한가(2026-09-17): 「성벽으로 둘러싸인 정주지」「왕궁이 있는 이중 성벽 도시」의 집은
// 삼각 앞박공·계단식 박공·쌍박공처럼 날개 문법(한 열 = 지붕 하나 + 벽 밴드 하나)으로는
// 못 만드는 배열이다. 참고 카드는 그림과 규칙 문장만 보여 주고 시공기에 닿는 선이 없어서,
// 어떤 프로젝트에서 마을을 지어도 이 스타일이 나오지 않았다. 여기서 셀 그대로 잘라
// authoredHouseFormCatalog 에 합치면 author_house 와 마을 시공기 양쪽이 같은 형태를 쓴다.
//
// 규칙:
//  · 건물 칸 = 하위가 지붕/벽/문 타일이거나 상위가 지붕 오버레이(캡·트림·용마루)·창문·문·굴뚝인 칸.
//    4방향으로 이어진 덩어리 하나가 집 하나다. 깃발·등불·나무 같은 소품은 집합에 없어 떨어진다.
//  · 문은 146(아래)·116(위) 두 칸 — 하위든 상위든. 레시피에서는 그 칸을 벽 타일로 두고
//    doorAt 만 남긴다(문 렌더링은 시공 기계 소관 — authoredHouseFormCatalog 머리 규칙).
//  · 같은 래스터는 한 번만 남긴다(왕궁 도시의 4×6 회벽집은 여러 채가 같은 그림이다).
//  · 명목 킷은 벽 재료로, 층수는 열마다 이어진 벽 칸 수로 정한다(3→1층, 5→2층, 7→3층).

import type { AuthoredHouseFormDef, AuthoredHouseFormRow } from "./authoredHouseFormCatalog";
import type { HouseKitId } from "@/editor/houseKit";

export interface ReferenceSnapshotMap {
  readonly width: number;
  readonly height: number;
  readonly lowerTiles: readonly number[];
  readonly upperTiles: readonly number[];
}

export interface ReferenceExtractOptions {
  /** regionReferences 항목 id — 폼의 reference.id 와 태그에 남는다. */
  readonly referenceId: string;
  /** 폼 id 접두어(예: ref-castle). 순번이 붙는다. */
  readonly idPrefix: string;
  /** 사람이 읽는 출처 표기(예: 왕궁 도시). */
  readonly label: string;
}

const ROOF_LOWER = new Set([404, 405, 406, 407, 467, 374, 375, 376, 377, 436, 437]);
const BLUE_ROOF = new Set([406, 407, 436, 437, 467, 356, 357, 386, 387]);
const WALL_FAMILIES: readonly { readonly kitId: HouseKitId; readonly word: string; readonly top: readonly number[]; readonly mid: readonly number[]; readonly bottom: readonly number[] }[] = [
  { kitId: "blue-stone", word: "회벽", top: [15, 16, 17], mid: [45, 46, 47], bottom: [75, 76, 77] },
  { kitId: "bright-plaster", word: "돌벽", top: [12, 13, 14], mid: [42, 43, 44], bottom: [72, 73, 74] },
  { kitId: "amber-wood", word: "통나무", top: [102, 103, 104], mid: [132, 133, 134], bottom: [162, 163, 164] },
  { kitId: "timber-hall", word: "목조", top: [196], mid: [226], bottom: [256] },
];
const WALL = new Set(WALL_FAMILIES.flatMap((family) => [...family.top, ...family.mid, ...family.bottom]));
const DOOR_TOP = 116;
const DOOR_BOTTOM = 146;
const OVERLAY_UPPER = new Set([354, 355, 356, 357, 384, 385, 386, 387, 374, 376, 377, 85, 87, DOOR_TOP, DOOR_BOTTOM, 326]);

interface Component {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly cells: ReadonlySet<number>;
}

function components(map: ReferenceSnapshotMap): Component[] {
  const { width, height, lowerTiles: lower, upperTiles: upper } = map;
  const isBuilding = (index: number): boolean => {
    const low = lower[index] ?? -1;
    const up = upper[index] ?? -1;
    return ROOF_LOWER.has(low) || WALL.has(low) || low === DOOR_TOP || low === DOOR_BOTTOM || OVERLAY_UPPER.has(up);
  };
  const seen = new Set<number>();
  const found: Component[] = [];
  for (let start = 0; start < width * height; start += 1) {
    if (seen.has(start) || !isBuilding(start)) continue;
    const stack = [start];
    seen.add(start);
    const cells = new Set<number>();
    while (stack.length > 0) {
      const index = stack.pop() as number;
      cells.add(index);
      const x = index % width;
      const y = Math.floor(index / width);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (seen.has(next) || !isBuilding(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (const index of cells) {
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    found.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, cells });
  }
  // 위→아래, 왼→오른 순서로 고정 — 순번 id 가 스냅샷 안에서 안정적이다.
  return found.sort((a, b) => a.y - b.y || a.x - b.x);
}

function wallFamilyOf(tile: number): (typeof WALL_FAMILIES)[number] | undefined {
  return WALL_FAMILIES.find((family) => family.top.includes(tile) || family.mid.includes(tile) || family.bottom.includes(tile));
}

/**
 * 명목 킷 = 지붕색 + 벽 재료가 같은 타일을 쓰는 킷. 실내 풍·보호 라벨·재료 고정 마을(kitMix)의
 * 판정에 쓰인다. 주황 지붕 + 회벽(15/45/75)은 timber-hall 이 같은 타일을 쓴다(기둥만 없다).
 */
function nominalKit(blueRoof: boolean, wallKit: HouseKitId): HouseKitId {
  if (wallKit === "amber-wood") return blueRoof ? "slate-wood" : "amber-wood";
  if (wallKit === "bright-plaster") return blueRoof ? "blue-stone" : "bright-plaster";
  if (wallKit === "timber-hall") return blueRoof ? "blue-stone" : "timber-hall";
  return blueRoof ? "blue-stone" : "timber-hall";
}

/** 문 칸에 둘 벽 타일 — 같은 행의 벽 재료를 따르고, 없으면 그 집의 주 재료를 쓴다. */
function wallTileForDoor(rows: number[][], y: number, band: "mid" | "bottom", fallback: (typeof WALL_FAMILIES)[number]): number {
  const row = rows[y] ?? [];
  const family = row.map((tile) => wallFamilyOf(tile)).find((entry) => entry !== undefined) ?? fallback;
  const tiles = band === "mid" ? family.mid : family.bottom;
  return tiles[Math.min(1, tiles.length - 1)] as number;
}

/**
 * 참고 맵 하나에서 집 형태를 뽑는다. 문이 없는 덩어리는 집이 아니라 버린다(성벽·우물 등).
 * 결과는 결정론적이다 — 같은 스냅샷이면 같은 id·이름·셀.
 */
export function extractReferenceHouseForms(map: ReferenceSnapshotMap, options: ReferenceExtractOptions): AuthoredHouseFormDef[] {
  const { width, lowerTiles: lower, upperTiles: upper } = map;
  const forms: AuthoredHouseFormDef[] = [];
  const seenRasters = new Set<string>();
  const nameCounts = new Map<string, number>();
  for (const component of components(map)) {
    const { x: x0, y: y0, w, h, cells } = component;
    const lowerRows: number[][] = [];
    const upperRows: number[][] = [];
    let doorAt: { x: number; y: number } | undefined;
    for (let dy = 0; dy < h; dy += 1) {
      const lowRow: number[] = [];
      const upRow: number[] = [];
      for (let dx = 0; dx < w; dx += 1) {
        const index = (y0 + dy) * width + x0 + dx;
        const inside = cells.has(index);
        const low = inside ? (lower[index] ?? -1) : -1;
        const up = inside ? (upper[index] ?? -1) : -1;
        const lowKept = ROOF_LOWER.has(low) || WALL.has(low) || low === DOOR_TOP || low === DOOR_BOTTOM ? low : -1;
        const upKept = OVERLAY_UPPER.has(up) ? up : -1;
        if (low === DOOR_BOTTOM || up === DOOR_BOTTOM) doorAt = { x: dx, y: dy };
        lowRow.push(lowKept);
        upRow.push(upKept);
      }
      lowerRows.push(lowRow);
      upperRows.push(upRow);
    }
    if (!doorAt) continue;
    const wallTiles = lowerRows.flat().filter((tile) => WALL.has(tile));
    const mainFamily = WALL_FAMILIES
      .map((family) => ({ family, count: wallTiles.filter((tile) => wallFamilyOf(tile) === family).length }))
      .sort((a, b) => b.count - a.count)[0]?.family ?? WALL_FAMILIES[0]!;
    // 문 두 칸을 벽으로 되돌리고 상위 문 타일을 지운다 — 레시피 규약.
    for (const [dy, band] of [[doorAt.y - 1, "mid"], [doorAt.y, "bottom"]] as const) {
      const row = lowerRows[dy];
      if (!row) continue;
      const current = row[doorAt.x] as number;
      if (!WALL.has(current)) row[doorAt.x] = wallTileForDoor(lowerRows, dy, band, mainFamily);
      const upRow = upperRows[dy] as number[];
      if (upRow[doorAt.x] === DOOR_TOP || upRow[doorAt.x] === DOOR_BOTTOM) upRow[doorAt.x] = -1;
    }
    const rasterKey = JSON.stringify([lowerRows, upperRows, doorAt]);
    if (seenRasters.has(rasterKey)) continue;
    seenRasters.add(rasterKey);
    // 층수: 어느 열이든 이어진 벽 칸이 5 이상이면 2층, 7 이상이면 3층.
    let longestWallRun = 0;
    for (let dx = 0; dx < w; dx += 1) {
      let run = 0;
      for (let dy = 0; dy < h; dy += 1) {
        if (WALL.has(lowerRows[dy]?.[dx] ?? -1)) {
          run += 1;
          longestWallRun = Math.max(longestWallRun, run);
        } else run = 0;
      }
    }
    const stories: 1 | 2 | 3 = longestWallRun >= 7 ? 3 : longestWallRun >= 5 ? 2 : 1;
    const blueRoof = lowerRows.flat().some((tile) => BLUE_ROOF.has(tile)) || upperRows.flat().some((tile) => BLUE_ROOF.has(tile));
    const kitId = nominalKit(blueRoof, mainFamily.kitId);
    // 박공: 캡·트림이 첫 행 아래에도 있으면 지붕면이 계단이나 삼각으로 내려온다.
    const gabled = upperRows.some((row, dy) => dy > 0 && row.some((tile) => [354, 355, 356, 357].includes(tile)))
      || lowerRows.flat().includes(375);
    const baseName = `${options.label} · ${blueRoof ? "파랑" : "주황"} ${gabled ? "박공 " : ""}${mainFamily.word}집 ${w}×${h}`;
    const seq = (nameCounts.get(baseName) ?? 0) + 1;
    nameCounts.set(baseName, seq);
    const rows: AuthoredHouseFormRow[] = lowerRows.map((tiles, dy) => {
      const upperTiles = upperRows[dy] as number[];
      return upperTiles.some((tile) => tile !== -1) ? { tiles, upperTiles } : { tiles };
    });
    forms.push({
      id: `${options.idPrefix}-${String(forms.length + 1).padStart(2, "0")}`,
      name: seq > 1 ? `${baseName} ${["②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"][seq - 2] ?? `(${seq})`}` : baseName,
      w,
      h,
      stories,
      kitId,
      doorAt,
      rows,
      reference: { id: options.referenceId, x: x0, y: y0 },
    });
  }
  return forms;
}
