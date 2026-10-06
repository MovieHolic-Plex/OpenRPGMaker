// editor/tools/wildRouteBeodeul.ts
// author_wild_route 의 버들항(beodeul_city) 시공 — 합본 마을 경로와 같은 길 계획(planRouteCorridor)을 버들항 재료로 칠한다.
//
// 왜 따로 있나(2026-10-01): 새 프로젝트 기본이 버들항이 되자(#1789) 몬스터 수집 첫 구간 뼈대가 이 도구에서 멈췄다
// (「숲마을·combined_town 계열에서만 시공」). 버들항 시트에는 키큰 풀 오토타일이 없어서,
// 풀숲은 시트의 짙은 잎 무늬 풀(통행 가능 한 칸 무늬)로 깐다. 제대로 된 키큰 풀은 시트에 손 도트로 더해야 한다.
// - 길: 버들항 모랫길(fill_region 재료, 줄 단위 사각형) — 모랫길 오토타일이 잔디 가장자리를 맞춘다. 길 계획은 꺾임 비용을 준 직선 위주.
// - 풀숲: 짙은 잎 풀 BEODEUL_THICKET_TILE.
// - 숲: 길 둘레 1칸·출구 둘레를 비운 풀밭을 앞줄 줄기 나무 + 안쪽 수관 + 덤불로 빈틈없이 막는다(plantBeodeulForestWall).
// - 길섶: 깊은 숲길 세트의 작은 소품을 드문드문(dressBeodeulVerge).

import type { GameMap, Project, Rect, TilesetDef } from "@/project/types";
import type { Rng } from "@/util/rng";
import { CONSTRUCTION_TOOLS_V3 } from "./v3/constructionTools";
import { SHARED_OBJECT_TOOLS } from "./sharedObjectTools";
import type { ToolDefinition } from "./types";

const BEODEUL_TEXTURE = "tex_beodeul_city";
const BEODEUL_ID = "beodeul_city";
/** 도로는 시내 포석이 아니라 잔디 가장자리가 있는 모랫길 오토타일이다(2026-10-06). */
const PATH_MATERIAL = "버들항 모랫길";
/** 버들항 민무늬 풀(defaultMaps.ts plainGrassTileFor 와 같다). */
export const BEODEUL_PLAIN_GRASS = 737;
/** 짙은 잎 무늬 풀 — 통행 가능, 3×3 으로 이어 깔아도 이음새가 없다. 키큰 풀이 없는 시트의 풀숲 대용. */
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
  readonly rng: Rng;
}

export function paintBeodeulWildRoute(input: BeodeulWildRouteInput): { roadCells: number; treeCells: number; decor: number } {
  const { project, map, tileset, road, grass, patches, exits, rng } = input;
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
  for (const index of thicket) map.lowerTiles[index] = BEODEUL_THICKET_TILE;

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

  const treeCells = plantBeodeulForestWall(project, map, tileset, reserved, rng, stampObject);
  const decor = dressBeodeulVerge(project, map, tileset, road, reserved, rng, stampObject);
  return { roadCells: roadCells.length, treeCells, decor };
}

type Kit = NonNullable<TilesetDef["structureKits"]>[number];

/**
 * 숲 벽 — 포켓몬 도로처럼 길 양옆을 나무로 빈틈없이 막는다(2026-10-06 「1번 도로가 엉망진창」).
 * 예전엔 2칸 격자마다 크기가 제각각인 나무 하나를 흔들어 찍어 덤불 점박이가 됐다.
 * 버들항 나무는 크기로 갈린다: 3×3 = 줄기 없는 수관, 3×4·4×5 = 줄기 있는 나무, 2×2 = 덤불, 1×3 = 측백.
 * 위에서 아래로 훑으며 아래가 트인 자리(길·풀숲·맵 끝)엔 줄기 나무를, 숲 안쪽엔 수관을 붙여 깔고, 남은 틈은 덤불로 메운다.
 * 측백은 숲 벽에 섞으면 이가 빠져 보여 쓰지 않는다.
 */
function plantBeodeulForestWall(project: Project, map: GameMap, tileset: TilesetDef, reserved: ReadonlySet<number>, rng: Rng,
  stampObject: ToolDefinition): number {
  const w = map.width, h = map.height;
  const kits = (tileset.structureKits ?? []).filter(kit => kit.id.startsWith("bd-tree-"));
  const crowns = kits.filter(kit => kit.width === 3 && kit.height === 3);
  const trunks = kits.filter(kit => kit.width === 3 && kit.height === 4);
  const bushes = kits.filter(kit => kit.width === 2 && kit.height === 2);
  const plantable = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const index = y * w + x;
    return !reserved.has(index) && map.lowerTiles[index] === BEODEUL_PLAIN_GRASS && map.upperTiles[index]! < 0;
  };
  const free = (x: number, y: number, kw: number, kh: number): boolean => {
    for (let dy = 0; dy < kh; dy++) for (let dx = 0; dx < kw; dx++) if (!plantable(x + dx, y + dy)) return false;
    return true;
  };
  // 발자국 바로 아래 줄에 나무를 심을 수 없는 칸(길 둘레·풀숲·맵 끝)이 있으면 그 나무는 숲의 앞줄이라 줄기가 보여야 한다.
  const openBelow = (x: number, y: number, kw: number, kh: number): boolean => {
    if (y + kh >= h) return true;
    for (let dx = 0; dx < kw; dx++) {
      const index = (y + kh) * w + x + dx;
      if (x + dx < w && (reserved.has(index) || map.lowerTiles[index] !== BEODEUL_PLAIN_GRASS)) return true;
    }
    return false;
  };
  // 맵 하나에 수관·줄기 나무는 한 종씩, 덤불은 두 종까지 — 색이 다른 수관을 섞으면 숲이 조각보가 됐다.
  const one = (list: readonly Kit[]): Kit[] => list.length ? [list[Math.floor(rng() * list.length)]!] : [];
  const crownKind = one(crowns), trunkKind = one(trunks), bushKinds = [...one(bushes), ...one(bushes)];
  const pick = (list: readonly Kit[]): Kit | undefined => list[Math.floor(rng() * list.length)];
  let cells = 0;
  const stamp = (kit: Kit, x: number, y: number): boolean => {
    try {
      stampObject.run(project, { objectId: `kit:${BEODEUL_ID}/${kit.id}`, mapId: map.id, x, y });
      cells += kit.width * kit.height;
      return true;
    } catch {
      return false;   // 찍을 수 없는 자리(보호 칸 등)는 건너뛴다.
    }
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 줄마다 시작 열을 비껴 벽돌처럼 엇갈리게 — 같은 열에 세우면 둥근 수관 사이 풀밭이 격자로 보인다.
      if (!plantable(x, y) || (x + (Math.floor(y / 3) % 3)) % 3 !== 0) continue;
      const trunk = pick(trunkKind), crown = pick(crownKind);
      if (trunk && free(x, y, 3, 4) && openBelow(x, y, 3, 4) && stamp(trunk, x, y)) { x += 2; continue; }
      if (crown && free(x, y, 3, 3) && !openBelow(x, y, 3, 3) && stamp(crown, x, y)) { x += 2; continue; }
    }
  }
  // 틈 메우기 — 덤불(2×2). 1칸 틈은 풀밭으로 둔다(1×1 생울타리는 네모 판이라 숲 속에서 튄다).
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const bush = pick(bushKinds);
      if (bush && free(x, y, 2, 2) && stamp(bush, x, y)) x += 1;
    }
  }
  return cells;
}

/** 길섶 꾸미기 — 깊은 숲길 세트의 작은 소품(고사리·들꽃·돌·그루터기·버섯)을 길 둘레 빈 풀밭에 드문드문. */
function dressBeodeulVerge(project: Project, map: GameMap, tileset: TilesetDef, road: ReadonlySet<number>, reserved: ReadonlySet<number>,
  rng: Rng, stampObject: ToolDefinition): number {
  const w = map.width;
  const decor = (tileset.structureKits ?? []).filter(kit => kit.width === 1 && kit.height === 1
    && /^bd-pick-deep-forest-path-(fern|heath|wild|stones|stump|toadstools)-/.test(kit.id));
  if (decor.length === 0) return 0;
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
