// editor/tools/mapVariantTerrain.ts
// derive_map_variant 시대 겉모습의 「땅·숲」 단계 — 건물 철거만으로는 시대가 구별되지 않는다.
//
// 왜: jrpg-loop-4 R5 ct1 현재·고대·미래 맵이 90% 같은 초록 풀(737)·같은 나무·같은 포석 광장이었다
// (집 몇 채만 지워지고 2×1 폐허 조각이 놓였다). 사용자 판정: 「시대가 달라진 마을들이 다 똑같은 느낌」.
// 이제 맵 전체의 바닥과 숲을 시대 팔레트로 바꾼다. 새 그림은 없다 — 버들항 칩셋에 이미 있는 바닥·물체 킷만 쓴다.
//  - wasteland(ruin·future): 풀 → 잿빛 광재 땅(+자갈·흙 얼룩), 길·광장 → 깨진 돌 부스러기 길, 나무 → 고사목·광재 더미·바위·뼈 더미,
//    꽃·덤불 → 자갈, 물가 풀 가장자리·나무 그림자 덧그림 제거, 잔해 흩뿌리기.
//  - primeval(past): 풀 → 짙은 들풀 땅, 길·광장 → 흙길, 빈 풀밭에 원시림 나무를 더 심고 고사리·버섯·들꽃·돌을 흩뿌린다.
//  - scorched(burned): 불탄 집 자리 둘레(mask)만 — 풀 → 잿빛 광재·재 땅, 나무 → 고사목·그루터기·쓰러진 통나무, 불씨·자갈 흩뿌리기.
//    길·광장은 그대로 둔다(불탄 마을도 길은 남는다). mask 밖은 손대지 않는다.
// 통행 보장: 나무 자리에는 나무보다 막는 칸이 적은 물체만 놓고(나무 칸은 모두 막힘), 새로 심는 나무는 발자국 둘레 한 칸이
// 모두 네 방향 통행 가능한 빈 땅이고 다른 새 나무의 둘레와 겹치지 않을 때만 심는다 — 둘레 고리로 언제나 돌아갈 수 있어 연결이 끊기지 않는다.
// 킷이 없는 칩셋(버들항이 아닌 맵)에서는 아무것도 하지 않는다.

import { BEODEUL_NATURE } from "@/project/defaults/beodeulNature";
import { clearTileStack } from "@/project/mapOverlayTiles";
import type { GameMap, Project, SectionStructureKitDef } from "@/project/types";

type Tileset = Project["tilesets"][string];
export type TerrainProfile = "wasteland" | "primeval" | "scorched";

export type VariantTerrainReport = {
  profile: TerrainProfile;
  groundCells: number;
  pathCells: number;
  treesReplaced: number;
  treesAdded: number;
  scattered: number;
};

type Piece = { readonly kitId: string; readonly w: number; readonly h: number; readonly cells: readonly { dx: number; dy: number; tile: number }[] };

const PROFILES = {
  wasteland: {
    groundBase: "bd-pick-mining-valley-ground-slagg",
    groundPatches: ["bd-pick-mining-valley-ground-yard", "bd-pick-mining-valley-ground-rock", "bd-pick-temple-ruins-floor-dirt"],
    path: ["bd-pick-mining-valley-ground-rock", "bd-pick-temple-ruins-floor-ruin", "bd-pick-mining-valley-ground-yard"],
    treeSwaps: [
      "bd-pick-swamp-stilt-snag", "bd-pick-mining-valley-slagheap", "bd-pick-mountain-pass-boulder-l",
      "bd-pick-aqueduct-sewer-bone-heap", "bd-pick-mining-valley-slagrock", "bd-pick-deep-forest-path-log-fallen", "bd-pick-deep-forest-path-stump",
    ],
    scatter: [
      "bd-pick-mountain-pass-scree-a", "bd-pick-mountain-pass-scree-b", "bd-pick-aqueduct-sewer-rubble", "bd-pick-sea-cave-rubble-cave",
      "bd-pick-volcano-cave-bones", "bd-pick-volcano-cave-ember-a", "bd-pick-castle-catacombs-rubble",
    ],
    scatterRatio: 0.05,
  },
  primeval: {
    groundBase: "bd-pick-mining-valley-ground-meadow",
    groundPatches: ["bd-pick-temple-ruins-floor-grass", "bd-pick-swamp-stilt-ground-mud"],
    path: ["bd-pick-temple-ruins-floor-dirt", "bd-pick-mining-valley-ground-soil"],
    treeSwaps: [] as string[],
    scatter: [
      "bd-pick-deep-forest-path-fern-a", "bd-pick-deep-forest-path-fern-b", "bd-pick-deep-forest-path-fern-c",
      "bd-pick-deep-forest-path-toadstools-a", "bd-pick-deep-forest-path-toadstools-b", "bd-pick-deep-forest-path-wild-a",
      "bd-pick-deep-forest-path-wild-b", "bd-pick-deep-forest-path-heath-a", "bd-pick-deep-forest-path-stones-a", "bd-pick-mountain-pass-alpine-a",
    ],
    scatterRatio: 0.07,
  },
  scorched: {
    groundBase: "bd-pick-temple-ruins-floor-dirt",
    groundPatches: ["bd-pick-mining-valley-ground-yard"],
    path: [] as string[],
    treeSwaps: ["bd-pick-swamp-stilt-snag", "bd-pick-deep-forest-path-log-fallen", "bd-pick-deep-forest-path-stump", "bd-pick-volcano-cave-pillar-broken-a"],
    scatter: [
      "bd-pick-volcano-cave-ember-a", "bd-pick-mountain-pass-scree-a", "bd-pick-mountain-pass-scree-b",
      "bd-pick-aqueduct-sewer-rubble", "bd-pick-castle-catacombs-rubble",
    ],
    scatterRatio: 0.03,
  },
} as const;

/** 황무지에서 나무 덩어리의 남은 칸을 메우는 네 방향 모두 막힌 물체 — 여러 칸짜리를 섞어 넣고 1칸짜리로 마감한다. */
const WASTELAND_WALLS = [
  "bd-pick-mining-valley-slagheap", "bd-pick-mountain-pass-boulder-l", "bd-pick-mountain-pass-boulder-m", "bd-pick-mining-valley-slagrock",
  "bd-pick-deep-forest-path-stump",
];

/** 불탄 숲 덩어리의 남은 칸 — 그루터기·쓰러진 통나무·탄 들보·숯더미(모두 네 방향 막힘). 바위·광재 더미는 불탄 마을에 어울리지 않는다. */
const SCORCHED_WALLS = [
  "bd-pick-deep-forest-path-log-fallen", "bd-pick-volcano-cave-pillar-fallen", "bd-pick-volcano-cave-coal-pile", "bd-pick-deep-forest-path-stump",
];

/** 원시림에 더 심을 나무 — 마을 시공기가 쓰는 버들항 나무 킷(위층만, 모두 막힘). 큰 것부터 시도한다. */
const PRIMEVAL_TREES = [
  "bd-tree-d43edd", "bd-tree-5844f6", "bd-tree-1e09f0", "bd-tree-d61d7e", "bd-tree-bdd36e", "bd-tree-1a786c",
  "bd-tree-3e8732", "bd-tree-a80c85", "bd-tree-7ecdb8", "bd-tree-03a8f7", "bd-tree-0f7ed1", "bd-tree-132848", "bd-tree-47e17a", "bd-tree-cc0fcb",
];

/** 들꽃·고사리·헤더 같은 위층 풀꽃 장식 킷 — 폐허에서는 자갈로 바꾼다. */
const FLORA_KIT = /heath|fern|-wild-|alpine|toadstool/iu;

function hash32(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function tagsOf(tileset: Tileset, tile: number | undefined): readonly string[] {
  if (tile === undefined || tile < 0) return [];
  return tileset.tileMeta?.[tile]?.tags ?? [];
}

function centerTile(kit: SectionStructureKitDef | undefined): number | undefined {
  if (!kit) return undefined;
  const tile = kit.rows[Math.floor(kit.height / 2)]?.tiles[Math.floor(kit.width / 2)];
  return tile !== undefined && tile >= 0 ? tile : undefined;
}

/** 위층만 있는 킷을 실제 그림이 있는 칸으로 잘라 낸다(빈 윗줄 제거). 아래층 칸이 있는 킷은 쓰지 않는다. */
function upperPiece(kit: SectionStructureKitDef | undefined): Piece | undefined {
  if (!kit) return undefined;
  const raw: { x: number; y: number; tile: number }[] = [];
  for (let y = 0; y < kit.height; y += 1) {
    for (let x = 0; x < kit.width; x += 1) {
      if ((kit.rows[y]?.tiles[x] ?? -1) >= 0) return undefined;
      const tile = kit.rows[y]?.upperTiles?.[x] ?? -1;
      if (tile >= 0) raw.push({ x, y, tile });
    }
  }
  if (raw.length === 0) return undefined;
  const minX = Math.min(...raw.map((c) => c.x)), minY = Math.min(...raw.map((c) => c.y));
  const maxX = Math.max(...raw.map((c) => c.x)), maxY = Math.max(...raw.map((c) => c.y));
  return { kitId: kit.id, w: maxX - minX + 1, h: maxY - minY + 1, cells: raw.map((c) => ({ dx: c.x - minX, dy: c.y - minY, tile: c.tile })) };
}

/** 그림자 덧그림(2층)의 원천 타일 → 이 칩셋에 이식된 타일 번호. */
function natureGraftTargets(tileset: Tileset): { toTarget: Map<number, number>; toSource: Map<number, number> } {
  const toTarget = new Map<number, number>();
  const toSource = new Map<number, number>();
  for (const graft of tileset.tileGrafts ?? []) {
    if (graft.sourceChipset !== "tex_beodeul_nature") continue;
    if (!toTarget.has(graft.sourceTile)) toTarget.set(graft.sourceTile, graft.targetTile);
    toSource.set(graft.targetTile, graft.sourceTile);
  }
  return { toTarget, toSource };
}

/** 나무·덤불 그림자에만 쓰이는 원천 타일과 풀 물가 가장자리 원천 타일 — 황무지에서 지운다. */
function greenOverlaySources(): Set<number> {
  const treeShadow = new Set<number>();
  const otherShadow = new Set<number>();
  for (const [kitId, shadow] of Object.entries(BEODEUL_NATURE.shadows)) {
    const into = /^bd-(tree-|mpart-bush)/u.test(kitId) ? treeShadow : otherShadow;
    for (const row of shadow.rows) for (const tile of row) if (tile >= 0) into.add(tile);
  }
  const out = new Set<number>([...treeShadow].filter((tile) => !otherShadow.has(tile)));
  for (const tile of [...(BEODEUL_NATURE.bankGrass ?? []), ...(BEODEUL_NATURE.bankLawn ?? []), ...(BEODEUL_NATURE.edgeLawn ?? []), ...(BEODEUL_NATURE.forestShade?.leaf ?? [])]) out.add(tile);
  return out;
}

/** 이어진 숲 수관(자연 덧그림 forestCanopy, 이식 칸)의 칩셋 칸 번호 — 이식 칸에는 tileMeta 가 없어 「tree」 태그로 안 잡혔다
 *  (2026-10-28 폴른 스타 v1.25 VQA: 불탄 새벽샘에 초록 활엽수·소나무 덩이가 멀쩡히 남았다). */
function canopyTargets(tileset: Tileset): Set<number> {
  const { toTarget } = natureGraftTargets(tileset);
  const out = new Set<number>();
  for (const style of Object.values(BEODEUL_NATURE.forestCanopy ?? {})) for (const phase of style) for (const tile of phase) {
    const target = tile >= 0 ? toTarget.get(tile) : undefined;
    if (target !== undefined) out.add(target);
  }
  return out;
}

/**
 * 변형 맵 전체의 바닥·길·광장·숲을 시대 팔레트로 바꾼다. 건물 철거·폐허 조각 배치 뒤에 부른다(철거 자리의 되돌린 풀까지 바꾸도록).
 * 필요한 바닥 킷이 칩셋에 없으면 null(아무것도 안 함). `mask` 가 있으면 mask[칸]=1 인 칸만 바꾼다(숲 덩어리는 한 칸이라도 걸리면 통째로).
 */
export function applyVariantTerrain(copy: GameMap, tileset: Tileset | undefined, profile: TerrainProfile, seed: number, mask?: Uint8Array): VariantTerrainReport | null {
  if (!tileset) return null;
  const spec = PROFILES[profile];
  const kitsById = new Map<string, SectionStructureKitDef>((tileset.structureKits ?? []).filter((kit) => kit.kind === "section").map((kit) => [kit.id, kit]));
  const base = centerTile(kitsById.get(spec.groundBase));
  if (base === undefined) return null;
  const patches = spec.groundPatches.map((id) => centerTile(kitsById.get(id))).filter((tile): tile is number => tile !== undefined);
  const paths = spec.path.map((id) => centerTile(kitsById.get(id))).filter((tile): tile is number => tile !== undefined);
  // 흩뿌림 조각은 네 방향 모두 통행 가능한 1칸짜리만 — 빈 땅 위에 놓여도 길을 막지 않는다.
  const scatter = spec.scatter.map((id) => upperPiece(kitsById.get(id))).filter((piece): piece is Piece => {
    const pass = piece?.cells.length === 1 ? tileset.passability?.[piece.cells[0]!.tile] : undefined;
    return Boolean(pass?.up && pass.down && pass.left && pass.right);
  });
  const report: VariantTerrainReport = { profile, groundCells: 0, pathCells: 0, treesReplaced: 0, treesAdded: 0, scattered: 0 };
  const { width, height } = copy;
  const index = (x: number, y: number) => y * width + x;
  const eventCells = new Set(copy.events.map((event) => index(event.x, event.y)));
  const inMask = (cell: number): boolean => !mask || mask[cell] === 1;
  const ashen = profile !== "primeval";

  const flora = new Set<number>();
  for (const kit of kitsById.values()) {
    if (!FLORA_KIT.test(kit.id)) continue;
    for (const row of kit.rows) for (const tile of row.upperTiles ?? []) if (tile >= 0) flora.add(tile);
  }

  // ① 숲 — 황무지는 나무 덩어리를 고사목·광재·바위로, 원시림은 그대로 두고 아래 ④에서 더 심는다.
  const canopy = canopyTargets(tileset);
  const isTree = (tile: number | undefined): boolean => tile !== undefined && tile >= 0 && (canopy.has(tile) || tagsOf(tileset, tile).includes("tree"));
  // 불탄 마을의 잔해는 덩어리로 — 6×6 칸 묶음 셋 중 하나쯤에만 남긴다(같은 간격 살포는 사람이 늘어놓은 것처럼 보였다, v1.25 VQA).
  const clump = (cell: number): boolean => profile !== "scorched" || hash32(`${seed}:clump:${Math.floor((cell % width) / 6)}:${Math.floor(Math.floor(cell / width) / 6)}`) % 100 < 38;
  if (ashen) {
    const swaps = spec.treeSwaps.map((id) => upperPiece(kitsById.get(id))).filter((piece): piece is Piece => piece !== undefined);
    const walls = (profile === "scorched" ? SCORCHED_WALLS : WASTELAND_WALLS).map((id) => upperPiece(kitsById.get(id))).filter((piece): piece is Piece => piece !== undefined && piece.cells.every((c) => {
      const pass = tileset.passability?.[c.tile];
      return Boolean(pass && !pass.up && !pass.down && !pass.left && !pass.right);
    }));
    const seen = new Uint8Array(width * height);
    for (let start = 0; start < width * height; start += 1) {
      if (seen[start] || !isTree(copy.upperTiles[start])) continue;
      const component: number[] = [];
      const stack = [start];
      seen[start] = 1;
      while (stack.length > 0) {
        const cell = stack.pop()!;
        component.push(cell);
        const cx = cell % width, cy = Math.floor(cell / width);
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = index(nx, ny);
          if (seen[next] || !isTree(copy.upperTiles[next])) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }
      if (!component.some(inMask)) continue;
      const inside = new Set(component);
      for (const cell of component) {
        clearTileStack(copy, "upper", cell);
        copy.upperTiles[cell] = -1;
      }
      report.treesReplaced += 1;
      const xs = component.map((cell) => cell % width), ys = component.map((cell) => Math.floor(cell / width));
      const minX = Math.min(...xs), minY = Math.min(...ys), maxX = Math.max(...xs), maxY = Math.max(...ys);
      const taken = new Set<number>();
      const order = swaps.map((piece, n) => ({ piece, key: hash32(`${seed}:swap:${start}:${n}`) })).sort((a, b) => a.key - b.key).map((entry) => entry.piece);
      let placed = 0;
      const budget = profile === "scorched" && component.length <= 16 && !clump(start) ? 0 : component.length >= 9 ? 2 : 1;
      for (const piece of order) {
        if (placed >= budget) break;
        fit: for (let y = maxY - piece.h + 1; y >= minY; y -= 1) {
          for (let x = minX; x + piece.w - 1 <= maxX; x += 1) {
            // 나무 칸(모두 막힘) 안에만 놓는다 — 통행이 나무 때보다 나빠질 수 없다.
            if (!piece.cells.every((c) => inside.has(index(x + c.dx, y + c.dy)) && !taken.has(index(x + c.dx, y + c.dy)))) continue;
            for (const c of piece.cells) {
              const cell = index(x + c.dx, y + c.dy);
              copy.upperTiles[cell] = c.tile;
              taken.add(cell);
            }
            placed += 1;
            break fit;
          }
        }
      }
      // 남은 나무 칸은 네 방향 모두 막는 바위·광재·그루터기로 메운다 — 숲 덩어리가 통째로 빈 땅이 되면
      // 가도·마을 가장자리의 벽이 사라져 길이 읽히지 않는다(jrpg-loop-4 R6 폐허 가도). 통행은 나무 때와 같다.
      // 단 덩어리 속(네 이웃이 모두 숲) 칸의 4할은 잿빛 맨땅 웅덩이로 비운다 — 다 메우면 맵 전체가 바위 융단이 됐다(R6 적대 검수 2회차).
      // 테두리는 그대로 막히므로 빈 웅덩이에는 들어갈 수 없다.
      for (const cell of component) {
        const cx = cell % width, cy = Math.floor(cell / width);
        const deep = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]].every(([nx, ny]) => nx! >= 0 && ny! >= 0 && nx! < width && ny! < height && inside.has(index(nx!, ny!)));
        if (deep && !taken.has(cell) && hash32(`${seed}:clear:${Math.floor(cx / 2)}:${Math.floor(cy / 2)}`) % 100 < 40) taken.add(cell);
      }
      // 불탄 마을의 덤불·작은 나무 덩이(16칸 이하)는 막는 조각으로 메우지 않는다 — 집 사이에 통나무 줄이 늘어섰다. 길 벽이 아니라서 비워도 된다.
      const cells = profile === "scorched" && component.length <= 16 ? [] : [...component].sort((a, b) => b - a);
      for (const cell of cells) {
        if (taken.has(cell)) continue;
        const cx = cell % width, cy = Math.floor(cell / width);
        const fill = walls.map((piece, n) => ({ piece, key: hash32(`${seed}:wall:${cell}:${n}`) })).sort((a, b) => Number(a.piece.cells.length === 1) - Number(b.piece.cells.length === 1) || a.key - b.key);
        for (const { piece } of fill) {
          // 이 칸이 조각의 오른쪽 아래 칸이 되게 놓는다(아래 줄부터 메우므로 위·왼쪽으로 자란다).
          const x0 = cx - piece.w + 1, y0 = cy - piece.h + 1;
          if (!piece.cells.every((c) => inside.has(index(x0 + c.dx, y0 + c.dy)) && !taken.has(index(x0 + c.dx, y0 + c.dy)))) continue;
          if (!piece.cells.some((c) => index(x0 + c.dx, y0 + c.dy) === cell)) continue;
          for (const c of piece.cells) {
            const at = index(x0 + c.dx, y0 + c.dy);
            copy.upperTiles[at] = c.tile;
            taken.add(at);
          }
          break;
        }
      }
    }
    // 나무 그림자·풀 물가 가장자리(2층 덧그림)는 잿빛 땅 위에서 초록 테두리·허공 그림자로 남는다.
    if (copy.lowerOverlayTiles) {
      const { toSource } = natureGraftTargets(tileset);
      const green = greenOverlaySources();
      copy.lowerOverlayTiles.forEach((tile, cell) => {
        if (tile === undefined || tile < 0 || !inMask(cell)) return;
        const source = toSource.get(tile);
        if (source !== undefined && green.has(source)) copy.lowerOverlayTiles![cell] = -1;
      });
    }
  }

  // ② 바닥 — 풀 칸을 시대 땅으로. 4×3 덩어리 얼룩으로 섞어 한 장의 단색판이 되지 않게 한다.
  const groundTiles = new Set<number>([base, ...patches]);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = index(x, y);
      if (!inMask(cell)) continue;
      const lower = copy.lowerTiles[cell];
      const tags = tagsOf(tileset, lower);
      if (tags.includes("grass")) {
        const blob = hash32(`${seed}:g:${Math.floor((x + (y % 2)) / 4)}:${Math.floor(y / 3)}`) % 100;
        copy.lowerTiles[cell] = patches.length > 0 && blob < 30 ? patches[blob % patches.length]! : base;
        report.groundCells += 1;
      } else if (paths.length > 0 && (tags.includes("plaza") || tags.includes("road") || tags.includes("sand"))) {
        const pick = hash32(`${seed}:p:${Math.floor(x / 2)}:${Math.floor(y / 2)}`) % 100;
        copy.lowerTiles[cell] = ashen && pick < 22 ? base : paths[pick % paths.length]!;
        report.pathCells += 1;
      }
    }
  }

  // ③ 위층 풀꽃 — 폐허에서는 자갈·잔해로 바꾼다(통행 가능한 1칸 조각끼리라 통행은 그대로다).
  if (ashen && scatter.length > 0) {
    copy.upperTiles.forEach((tile, cell) => {
      if (tile === undefined || tile < 0 || !flora.has(tile) || !inMask(cell)) return;
      copy.upperTiles[cell] = clump(cell) ? scatter[hash32(`${seed}:f:${cell}`) % scatter.length]!.cells[0]!.tile : -1;
    });
  }

  const isOpenGround = (cell: number): boolean => {
    const lower = copy.lowerTiles[cell];
    return lower !== undefined && groundTiles.has(lower) && (copy.upperTiles[cell] ?? -1) < 0 && !eventCells.has(cell)
      && Boolean(tileset.passability?.[lower]?.up && tileset.passability[lower]!.down && tileset.passability[lower]!.left && tileset.passability[lower]!.right)
      && !(copy.upperTileStacks?.[cell]?.length) && (copy.lowerOverlayTiles?.[cell] ?? -1) < 0;
  };

  // ④ 원시림 — 빈 땅에 나무를 더 심는다. 발자국 둘레 한 칸이 모두 빈 땅이어야 하고 다른 새 나무의 둘레를 밟지 않는다.
  if (profile === "primeval") {
    const trees = PRIMEVAL_TREES.map((id) => upperPiece(kitsById.get(id))).filter((piece): piece is Piece => piece !== undefined && piece.cells.length === piece.w * piece.h);
    const { toTarget } = natureGraftTargets(tileset);
    const reserved = new Set<number>();
    const target = Math.round((width * height) / 70);
    for (let attempt = 0; attempt < target * 30 && report.treesAdded < target && trees.length > 0; attempt += 1) {
      const h = hash32(`${seed}:t:${attempt}`);
      const piece = trees[(h >>> 8) % trees.length]!;
      const x0 = 1 + (h % Math.max(1, width - piece.w - 1));
      const y0 = 1 + (hash32(`${seed}:ty:${attempt}`) % Math.max(1, height - piece.h - 1));
      let ok = x0 + piece.w < width && y0 + piece.h < height;
      for (let y = y0 - 1; ok && y <= y0 + piece.h; y += 1) {
        for (let x = x0 - 1; ok && x <= x0 + piece.w; x += 1) {
          const cell = index(x, y);
          const foot = x >= x0 && y >= y0 && x < x0 + piece.w && y < y0 + piece.h;
          if (!isOpenGround(cell) || reserved.has(cell)) ok = false;
          // 둘레의 둘레(두 칸)에 이벤트가 있으면 피한다 — 인물·문 앞을 나무로 가리지 않는다.
          if (foot && [-2, -1, 0, 1, 2].some((dy) => [-2, -1, 0, 1, 2].some((dx) => eventCells.has(index(Math.min(width - 1, Math.max(0, x + dx)), Math.min(height - 1, Math.max(0, y + dy))))))) ok = false;
        }
      }
      if (!ok) continue;
      for (let y = y0 - 1; y <= y0 + piece.h; y += 1) for (let x = x0 - 1; x <= x0 + piece.w; x += 1) reserved.add(index(x, y));
      for (const c of piece.cells) copy.upperTiles[index(x0 + c.dx, y0 + c.dy)] = c.tile;
      const shadow = BEODEUL_NATURE.shadows[piece.kitId];
      if (shadow && copy.lowerOverlayTiles) {
        shadow.rows.forEach((row, j) => row.forEach((source, i) => {
          const sx = x0 + shadow.dx + i, sy = y0 + shadow.dy + j;
          const graft = source >= 0 ? toTarget.get(source) : undefined;
          if (graft === undefined || sx < 0 || sy < 0 || sx >= width || sy >= height) return;
          const cell = index(sx, sy);
          if ((copy.lowerOverlayTiles![cell] ?? -1) < 0) copy.lowerOverlayTiles![cell] = graft;
        }));
      }
      report.treesAdded += 1;
    }
  }

  // ⑤ 흩뿌리기 — 통행 가능한 1칸 조각(자갈·뼈·불씨 / 고사리·버섯·들꽃)만 빈 땅에.
  if (scatter.length > 0) {
    for (let cell = 0; cell < width * height; cell += 1) {
      if (!isOpenGround(cell) || !inMask(cell)) continue;
      if ((hash32(`${seed}:s:${cell}`) % 1000) >= spec.scatterRatio * 1000) continue;
      const piece = scatter[hash32(`${seed}:sp:${cell}`) % scatter.length]!;
      copy.upperTiles[cell] = piece.cells[0]!.tile;
      report.scattered += 1;
    }
  }
  return report;
}
