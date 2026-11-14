// editor/tools/wildRouteBeodeul.ts
// author_wild_route 의 버들항(beodeul_city) 시공 — 합본 마을 경로와 같은 길 계획(planRouteCorridor)을 버들항 재료로 칠한다.
//
// 왜 따로 있나(2026-10-01): 새 프로젝트 기본이 버들항이 되자(#1789) 몬스터 수집 첫 구간 뼈대가 이 도구에서 멈췄다
// (「숲마을·combined_town 계열에서만 시공」). 버들항 시트에는 키큰 풀 오토타일이 없다.
// 조우 풀숲(patches)은 몬스터 수집 게임에서만 깐다(wildRouteTool.ts 가 isDeclaredMonsterGame 으로 거른다, 2026-10-21 사용자 정정
// 「포켓몬 칩이 아닌데 '조우 풀숲'은 또 왜 쓴거임?」). 깔 때도 짙은 풀 속 칸 11628 을 네모 판으로 칠하지 않고 짙은 풀 오토타일로 둥글게 푼다.
// - 길: 버들항 모랫길(fill_region 재료, 줄 단위 사각형) — 모랫길 오토타일이 잔디 가장자리를 맞춘다. 길 계획은 꺾임 비용을 준 직선 위주.
// - 풀숲(몬스터 수집 게임만): 짙은 풀 오토타일(beodeulForest.ts paintBeodeulDarkGrass).
// - 숲: 길 둘레 1칸·출구 둘레를 비운 풀밭을 버들항 수관 오토타일(#3259, beodeulForest.ts planBeodeulCanopy)로 덮는다(plantBeodeulForestWall, 2026-10-24).
// - 길섶: 깊은 숲길 세트의 작은 소품을 드문드문(dressBeodeulVerge).

import { activeKitLook, activeTilesetLook } from "@/project/kitLook";
import { layBeodeulGroundCover } from "./beodeulGroundCover";
import { beodeulBayObjects, beodeulVergeObjects } from "./beodeulObjectSets";
import type { GameMap, Project, Rect, TilesetDef } from "@/project/types";
import type { Rng } from "@/util/rng";
import { CONSTRUCTION_TOOLS_V3 } from "./v3/constructionTools";
import { SHARED_OBJECT_TOOLS } from "./sharedObjectTools";
import type { ToolDefinition } from "./types";
import { layerTileAt } from "@/project/mapLayers";
import { tilesetStand } from "@/assets/tilesetStands";
import { treeHash } from "@/project/defaults/treeComposer";
import { beodeulWoodlandGrass, paintBeodeulDarkGrass, planBeodeulCanopy, raiseBeodeulCrowns, shapeBeodeulCanopyMask, writeBeodeulCanopy, type BeodeulDarkGrassFamily, type BeodeulForestType } from "./beodeulForest";

const BEODEUL_TEXTURE = "tex_beodeul_city";
const BEODEUL_ID = "beodeul_city";
/** 도로는 시내 포석이 아니라 잔디 가장자리가 있는 모랫길 오토타일이다(2026-10-06). */
export const BEODEUL_SAND_PATH = "버들항 모랫길";
const PATH_MATERIAL = BEODEUL_SAND_PATH;
/** 버들항 민무늬 풀(defaultMaps.ts plainGrassTileFor 와 같다). */
export const BEODEUL_PLAIN_GRASS = 737;
/** 짙은 풀 속 칸(원본) — 통행 가능. 낱칸으로 네모 판을 깔지 말고 짙은 풀 오토타일(paintBeodeulDarkGrass)로 깐다. */
export const BEODEUL_THICKET_TILE = 11628;

export function canPaintBeodeulWildRoute(tileset: TilesetDef): boolean {
  return tileset.image.type === "bundled" && tileset.image.id === BEODEUL_TEXTURE
    && !!tileset.structureKits?.some(kit => kit.id.startsWith("bd-tree-"));
}

function requireTool(tools: readonly ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find(candidate => candidate.name === name);
  if (!tool) throw new Error(`필수 툴을 찾을 수 없습니다: ${name}`);
  return tool;
}

export interface BeodeulWildRouteInput {
  readonly project: Project;
  readonly map: GameMap;
  readonly tileset: TilesetDef;
  readonly road: ReadonlySet<number>;
  readonly grass: ReadonlySet<number>;
  readonly patches: readonly Rect[];
  readonly exits: readonly { x: number; y: number }[];
  /** 나무를 심지 않을 공터(풀밭으로 둔다). */
  readonly clearings?: readonly Rect[];
  readonly rng: Rng;
  /** 숲 종류(기본 활엽수림). */
  readonly forestType?: BeodeulForestType;
}

export function paintBeodeulWildRoute(input: BeodeulWildRouteInput): { roadCells: number; treeCells: number; decor: number } {
  const { project, map, tileset, road, grass, patches, exits, clearings = [], rng, forestType = "broadleaf" } = input;
  const fillRegion = requireTool(CONSTRUCTION_TOOLS_V3, "fill_region");
  const stampObject = requireTool(SHARED_OBJECT_TOOLS, "stamp_object");
  const w = map.width;

  // 풀숲: 네모 판으로 보이지 않게 모서리 한 칸씩 깎는다(5×4 이상만). 길이 지나는 풀숲 칸은 풀숲으로 둔다 —
  // 길이 풀숲을 가로질러야 돌아갈 수 없다(포켓몬 도로의 문법, 합본 마을 경로와 같다).
  const thicket = new Set(grass);
  for (const rect of patches) {
    if (rect.w < 5 || rect.h < 4) continue;
    for (const [cx, cy] of [[rect.x, rect.y], [rect.x + rect.w - 1, rect.y], [rect.x, rect.y + rect.h - 1], [rect.x + rect.w - 1, rect.y + rect.h - 1]] as const) {
      if (rng() < 0.75) thicket.delete(cy * w + cx);
    }
  }
  paintBeodeulDarkGrass(project, map, tileset, "woodland", thicket);

  // 길: 풀숲이 아닌 길 칸(깎인 모서리 포함). 행마다 이어진 칸을 사각형 하나로 칠한다(칸마다 부르면 오토타일 재합성이 칸 수만큼 돈다).
  // 풀숲 사각형 안의 길 칸은 모랫길로 칠하지 않는다 — 깎인 모서리에 모랫길 토막이 삐져나왔다(2026-10-06).
  const inPatch = (index: number) => patches.some(rect => {
    const x = index % w, y = Math.floor(index / w);
    return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
  });
  const outside = new Set([...road].filter(index => !thicket.has(index) && !inPatch(index)));
  // 풀숲에 잘려 남은 4칸 이하 모랫길 토막(출구가 아닌 것)은 풀밭으로 둔다 — 길이 끊긴 자국으로만 보였다.
  const exitCells = new Set(exits.map(exit => exit.y * w + exit.x));
  for (const seed of [...outside]) {
    if (!outside.has(seed)) continue;
    const piece = [seed];
    const seen = new Set(piece);
    for (let i = 0; i < piece.length && piece.length <= 4; i++) {
      const at = piece[i]!, x = at % w;
      for (const next of [at - w, at + w, x > 0 ? at - 1 : -1, x < w - 1 ? at + 1 : -1]) {
        if (next >= 0 && outside.has(next) && !seen.has(next)) { seen.add(next); piece.push(next); }
      }
    }
    if (piece.length <= 4 && !piece.some(index => exitCells.has(index))) for (const index of piece) outside.delete(index);
  }
  const roadCells = [...outside].sort((a, b) => a - b);
  for (let i = 0; i < roadCells.length;) {
    const start = roadCells[i]!, y = Math.floor(start / w);
    let end = start;
    while (i + 1 < roadCells.length && roadCells[i + 1] === end + 1 && Math.floor(roadCells[i + 1]! / w) === y) { i += 1; end = roadCells[i]!; }
    i += 1;
    fillRegion.run(project, { mapId: map.id, rect: { x: start % w, y, w: end - start + 1, h: 1 }, material: PATH_MATERIAL });
  }

  // 나무를 심지 않을 칸 — 길 둘레 1칸, 출구 둘레 2칸, 이벤트 둘레 1칸(풀숲 칸은 풀밭이 아니라 저절로 빠진다).
  const reserved = new Set<number>();
  const reserve = (x: number, y: number, radius: number) => {
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < map.height) reserved.add(ny * w + nx);
    }
  };
  for (const index of road) reserve(index % w, Math.floor(index / w), 1);
  for (const exit of exits) reserve(exit.x, exit.y, 2);
  for (const event of map.events) reserve(event.x, event.y, 1);
  for (const rect of clearings) for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
    if (x >= 0 && y >= 0 && x < w && y < map.height) reserved.add(y * w + x);
  }

  const treeCells = plantBeodeulForestWall(project, map, tileset, reserved, rng, stampObject, forestType, "woodland");
  const decor = dressBeodeulVerge(project, map, tileset, road, reserved, rng, stampObject);
  // r4 B(2026-10-21 사용자 승인): 숲 장면의 바닥 잔디만 채도를 조금 낮춘 잔디로 — 공용 잔디 737 그림은 그대로, 이 맵의 칸만 바꾼다.
  const woodlandGrass = beodeulWoodlandGrass(project, tileset);
  if (woodlandGrass >= 0) for (let i = 0; i < map.lowerTiles.length; i++) if (map.lowerTiles[i] === BEODEUL_PLAIN_GRASS) map.lowerTiles[i] = woodlandGrass;
  // 숲 바닥·풀밭 얼룩(게임 겉모습 stand·meadow — 2층 투명 덧그림이라 걷는 칸은 그대로다). 겉모습에 없으면 아무것도 하지 않는다.
  const roadSet = new Set(road);
  // 겉모습은 «이 도구가 시작할 때의 프로젝트» 로 읽는다(activeTilesetLook) — 도로가 그 게임의 첫 버들항 맵이면 아직 타일셋에 적히지 않았고,
  // 지금 프로젝트로 다시 고르면 방금 칠한 이 맵 때문에 «옛 게임» 으로 읽혀 숲 바닥이 빠졌다.
  layBeodeulGroundCover(project, map, activeTilesetLook(tileset), { seed: (w * 31 + map.height * 17 + roadCells.length * 7) | 0, road: (c) => roadSet.has(c) });
  return { roadCells: roadCells.length, treeCells, decor };
}


/**
 * 숲 벽 — 포켓몬 도로처럼 길 양옆을 나무로 빈틈없이 막는다(2026-10-06 「1번 도로가 엉망진창」).
 *
 * 2026-10-24: 나무 composer(#3234 woodland)를 버리고 버들항 마을 숲(#3259)과 같은 수관 오토타일로 바꿨다 —
 * 숲 칸 마스크를 shapeBeodeulCanopyMask 로 다듬고(좁은 띠·작은 덩이·속 빈 덩이 제거) planBeodeulCanopy 가 칸마다 이웃 비트·위상으로
 * 수관과 남쪽 그늘을 고른다. 수관은 막힘·상위, 그늘은 통행. 길 둘레(reserved)에는 쓰지 않아 통행이 보존된다.
 * 인자 rng·forestType·family 는 옛 composer 용이라 쓰지 않는다(호출부 호환을 위해 남김). stampObject 는 숲 구성을 고른 게임의 만입 덤불·풀을 찍는 데만 쓴다.
 */
export function plantBeodeulForestWall(project: Project, map: GameMap, tileset: TilesetDef, reserved: ReadonlySet<number>, _rng: Rng,
  stampObject: ToolDefinition, _forestType: BeodeulForestType = "broadleaf", _family: BeodeulDarkGrassFamily = "plain"): number {
  const w = map.width, h = map.height;
  const empty = (index: number): boolean => ([2, 3, 4] as const).every(L => layerTileAt(map, L, index) < 0);
  const plantable = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const index = y * w + x;
    return !reserved.has(index) && map.lowerTiles[index] === BEODEUL_PLAIN_GRASS && empty(index);
  };
  // 숲 칸을 먼저 정해 두고 수관 마스크를 다듬는다(마을 숲 #3259 와 같은 모양 규칙: 4칸 미만 띠·16칸 미만 덩이·속이 빈 덩이는 버린다).
  const forest = new Set<number>();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (plantable(x, y)) forest.add(y * w + x);
  const free = (c: number): boolean => plantable(c % w, Math.floor(c / w));
  shapeBeodeulCanopyMask(w, h, forest, { canFill: free, minComponent: 16, minExtent: 4, minInterior: 0.15, block: 2 });
  // 숲 구성을 고른 게임: 길을 따라 곧게 뻗은 숲 끝을 «들쭉날쭉» 하게 — 끝에 닿은 두 칸 × 두 칸 덩이를 자리 해시로 열에 넷쯤 덜어 낸다(만입).
  // 왜(2026-11-13 «네모난 수관 끝 금지»): 숲 칸은 «길 둘레 한 칸을 뺀 전부» 라 숲 끝이 길과 나란한 곧은 선이었다. 덜어 낸 자리는 걷는 풀밭이 되고
  // 그 숲 구성의 덤불·풀이 선다(아래). 맵 끝 두 칸은 건드리지 않는다(숲 벽이 열리지 않게). 겉모습 없는 게임·옛 저장은 전과 같다.
  const stand = tilesetStand(tileset.id, activeTilesetLook(tileset)?.stand);
  const bays: number[] = [];
  if (stand) {
    const seed = (w * 73 + h * 29 + forest.size) | 0;
    const before = new Set(forest);
    const edge = (c: number): boolean => {
      const x = c % w, y = (c - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && !before.has(ny * w + nx)) return true;
      }
      return false;
    };
    for (let by = 1; by * 2 + 1 < h - 2; by += 1) for (let bx = 1; bx * 2 + 1 < w - 2; bx += 1) {
      const cells = [0, 1, 2, 3].map((n) => (by * 2 + (n >> 1)) * w + bx * 2 + (n & 1));
      if (treeHash(bx, by, seed) % 100 >= 40 || !cells.some((c) => before.has(c) && edge(c))) continue;
      for (const c of cells) forest.delete(c);
    }
    shapeBeodeulCanopyMask(w, h, forest, { canFill: (c) => before.has(c), minComponent: 16, minExtent: 4, minInterior: 0.15, block: 2 });
    for (const c of before) if (!forest.has(c)) bays.push(c);
  }
  // 수관 오토타일(beodeul_nature leaf)이 칸마다 이웃 비트로 가장자리를, 숲 남쪽 바로 아래 빈 풀 칸에 그늘을 깐다. 길 둘레(reserved)에는 아무것도 안 쓴다.
  const plan = planBeodeulCanopy(w, h, "leaf", forest, (s) => !forest.has(s) && free(s));
  writeBeodeulCanopy(project, map, tileset, plan);
  // 숲 구성을 고른 게임: 수관 위로 솟은 나무 머리(4층) — 수관 오토타일의 여섯 칸 주기를 자리 해시로 깬다(숲이 맵의 대부분인 도로에서 격자가 보였다)
  raiseBeodeulCrowns(map, tileset, new Set(plan.canopy.keys()), (w * 131 + h * 17 + forest.size) | 0);
  // 만입에 그 숲 구성의 덤불(두 칸 × 두 칸, 막힘)과 한 칸 풀·덤불을 세운다 — 숲 끝이 풀밭과 덤불로 풀린다. 그늘 칸(2층)·이벤트 둘레는 비운다.
  if (stand && bays.length) {
    const kits = new Map((tileset.structureKits ?? []).map((kit) => [kit.id, kit] as const));
    const loud = new Set(stand.loud ?? []);
    const shrubs = (stand.kits.shrub ?? []).filter((id) => { const kit = kits.get(id); return kit && kit.width === 2 && kit.height === 2 && !loud.has(id); });
    const small = (tileset.structureKits ?? []).filter((kit) => kit.width === 1 && kit.height === 1 && /^bd-pick-deep-forest-path-(fern|heath|wild)-/.test(kit.id)).map((kit) => kit.id);
    // 새 종류 기물(2026-11-14): 그 게임의 큰 것 둘(큰 그루터기·뽑힌 나무·너럭바위·낙석)이 덤불 자리의 넷에 하나쯤을 대신한다 — 숲 끝이 덤불만으로 풀리지 않게.
    const big = beodeulBayObjects((id) => kits.has(id), activeKitLook());
    const bay = new Set(bays);
    const open = (c: number): boolean => bay.has(c) && empty(c) && !map.events.some((event) => Math.abs(event.x - (c % w)) + Math.abs(event.y - Math.floor(c / w)) <= 1);
    const seed = (w * 59 + h * 37 + bays.length) | 0;
    const stamp = (id: string, c: number): void => {
      try { stampObject.run(project, { objectId: `kit:${tileset.id}/${id}`, mapId: map.id, x: c % w, y: Math.floor(c / w) }); } catch { /* 찍을 수 없는 자리는 건너뛴다 */ }
    };
    for (const c of bays) {
      const roll = treeHash(c % w, Math.floor(c / w), seed);
      if (shrubs.length && roll % 100 < 22 && [c, c + 1, c + w, c + w + 1].every(open) && (c % w) + 1 < w) stamp(big.length && (roll >>> 16) % 4 === 0 ? big[(roll >>> 8) % big.length]! : shrubs[(roll >>> 8) % shrubs.length]!, c);
      else if (small.length && roll % 100 >= 70 && open(c)) stamp(small[(roll >>> 8) % small.length]!, c);
    }
  }
  return plan.canopy.size;
}

/** 길섶 꾸미기 — 깊은 숲길 세트의 작은 소품(고사리·들꽃·돌·그루터기·버섯)을 길 둘레 빈 풀밭에 드문드문. */
function dressBeodeulVerge(project: Project, map: GameMap, tileset: TilesetDef, road: ReadonlySet<number>, reserved: ReadonlySet<number>,
  rng: Rng, stampObject: ToolDefinition): number {
  const w = map.width;
  const decor = (tileset.structureKits ?? []).filter(kit => kit.width === 1 && kit.height === 1
    && /^bd-pick-deep-forest-path-(fern|heath|wild|stones|stump|toadstools)-/.test(kit.id));
  if (decor.length === 0) return 0;
  // 새 종류 기물(2026-11-14): 그 게임의 길섶 물건 셋(산딸기 덤불·개미집·여우 굴·낙엽·억새·작은 바위 가운데)을 옛 길섶 소품 사이에 섞는다 — 열쇠가 없으면 전과 같다.
  const byId = new Map((tileset.structureKits ?? []).map((kit) => [kit.id, kit] as const));
  for (const id of beodeulVergeObjects((kitId) => byId.has(kitId), activeKitLook())) { const kit = byId.get(id)!; decor.push(kit, kit); }
  let placed = 0;
  for (const index of reserved) {
    if (road.has(index) || map.lowerTiles[index] !== BEODEUL_PLAIN_GRASS || map.upperTiles[index]! >= 0) continue;
    const x = index % w, y = Math.floor(index / w);
    if (map.events.some(event => Math.abs(event.x - x) + Math.abs(event.y - y) <= 1)) continue;
    if (rng() > 0.12) continue;
    const kit = decor[Math.floor(rng() * decor.length)]!;
    try {
      stampObject.run(project, { objectId: `kit:${BEODEUL_ID}/${kit.id}`, mapId: map.id, x, y });
      placed++;
    } catch {
      // 찍을 수 없는 자리는 건너뛴다.
    }
  }
  return placed;
}
