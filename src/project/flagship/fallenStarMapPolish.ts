/**
 * 『폴른 스타』 맵 마감(감사 3차, 2026-10-20 「전부 고쳐」).
 *
 * 장 구성기·마을 시공기가 남긴 마감 결함 중 이 게임 맵에 남은 것을 고친다. 새 그림은 그리지 않는다 — 시트에 있는 칸만 쓴다.
 * - 주인 없는 그림자: 마을 시공기는 소품·나무와 그 2층 바닥 그림자를 함께 찍는데, 뒤에 소품이 지워져도 그림자가 남았다
 *   (광장 판석·풀밭 위 둥근 얼룩·가로등 그림자). 그림자는 오른쪽 아래로 지므로 제자리·왼쪽·위쪽 두 칸 안에 물체가 없으면 지운다.
 * - 화로의 방: 좌우 「긴 화덕」 띠가 네온 간판처럼 번쩍여 방의 시선을 빼앗았다 — 걷어 내고 그을린 바닥만 남긴다.
 */
import catalog from "@/assets/beodeulNatureCatalog.json";
import { BEODEUL_NATURE, BEODEUL_NATURE_ID, createBeodeulNatureTileset } from "@/project/defaults/beodeulNature";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { translateTiles } from "@/project/objectStamp";
import type { GameMap, Project } from "@/project/types";

const NATURE_TEXTURE = "tex_beodeul_nature";

type Shadow = { dx: number; dy: number; rows: number[][] };
type Kit = { id: string; rows: { tiles: number[]; upperTiles?: number[] }[] };

/**
 * 주인 없는 2층 그림자를 지운다. 지운 칸 수를 돌려준다.
 * 그림자 칸마다 그 칸을 만들 수 있는 그림자(소품·나무·집 키트 id 와 같은 이름)를 거꾸로 따라가 키트 원점을 구하고,
 * 그 원점에 키트 그림이 실제로 남아 있는지 본다. 하나도 없으면 주인이 지워진 그림자다.
 */
export function clearOrphanShadows(project: Project, map: GameMap): number {
  const overlay = (map as { lowerOverlayTiles?: number[] }).lowerOverlayTiles;
  if (!overlay) return 0;
  const tileset = project.tilesets[map.tilesetId] as { tileGrafts?: { targetTile: number; sourceChipset: string; sourceTile: number }[]; structureKits?: Kit[] } | undefined;
  const source = new Map<number, number>();
  for (const graft of tileset?.tileGrafts ?? []) if (graft.sourceChipset === NATURE_TEXTURE) source.set(graft.targetTile, graft.sourceTile);
  const shadows = (catalog as { shadows: Record<string, Shadow> }).shadows;
  // 원본 그림자 칸 → (그림자 이름, 그림자 안 위치) 목록.
  const where = new Map<number, { key: string; i: number; j: number }[]>();
  for (const [key, shadow] of Object.entries(shadows)) shadow.rows.forEach((row, i) => row.forEach((tile, j) => {
    if (tile >= 0) { const list = where.get(tile) ?? []; list.push({ key, i, j }); where.set(tile, list); }
  }));
  const kits = new Map((tileset?.structureKits ?? []).map((kit) => [kit.id, kit]));
  const { width: w, height: h } = map;
  const lowerOverlay = overlay;
  const present = (kit: Kit, ox: number, oy: number): boolean => {
    let checked = 0, hit = 0;
    kit.rows.forEach((row, ky) => row.tiles.forEach((tile, kx) => {
      const upper = row.upperTiles?.[kx] ?? -1;
      const x = ox + kx, y = oy + ky;
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const index = y * w + x;
      if (upper >= 0) { checked++; if (map.upperTiles[index] === upper) hit++; }
      else if (tile >= 0 && tile !== 737) { checked++; if (map.lowerTiles[index] === tile || lowerOverlay[index] === tile) hit++; }
    }));
    return checked > 0 && hit * 2 >= checked;
  };
  const cache = new Map<string, boolean>();
  let cleared = 0;
  overlay.forEach((tile, index) => {
    const src = source.get(tile);
    if (src === undefined) return;
    const owners = where.get(src);
    if (!owners) return;
    const x = index % w, y = Math.floor(index / w);
    let known = false, owned = false;
    for (const { key, i, j } of owners) {
      const kit = kits.get(key);
      if (!kit) continue;
      known = true;
      const shadow = shadows[key]!;
      const ox = x - shadow.dx - j, oy = y - shadow.dy - i;
      const memo = `${key}@${ox},${oy}`;
      let hit = cache.get(memo);
      if (hit === undefined) { hit = present(kit, ox, oy); cache.set(memo, hit); }
      if (hit) { owned = true; break; }
    }
    // 키트를 하나도 모르는 그림자(구운 마을 표본 등)는 건드리지 않는다.
    if (known && !owned) { overlay[index] = -1; cleared++; }
  });
  return cleared;
}

/** 칸 이름표가 pattern 에 맞는 윗층 물체를 지운다(화로의 방 「긴 화덕」 띠 등). */
export function clearUpperByLabel(project: Project, map: GameMap, pattern: RegExp): number {
  const meta = (project.tilesets[map.tilesetId] as { tileMeta?: Record<string, { label?: string }> } | undefined)?.tileMeta ?? {};
  let cleared = 0;
  map.upperTiles.forEach((tile, index) => {
    if (tile >= 0 && pattern.test(meta[tile]?.label ?? "")) { map.upperTiles[index] = -1; cleared++; }
  });
  return cleared;
}

/**
 * 구덩이 가장자리: 칠한 흙 칸 묶음(cells)의 바깥 둘레 칸에 물가 둑 덧그림(bankGrass, 「earth」)을 2층에 얹는다.
 * 둑 그림은 바깥 풀이 둥글게 들어오고 흙 띠·어두운 테가 서서, 네모난 흙 마당이 움푹 팬 자리로 읽힌다(새 화소 없음 — 버들항 자연 팩 칸).
 * bank="bankLava" 는 같은 모양의 그을린 흑요석 둑(검은 재 띠 + 불씨 주황 모서리) — 추락 구덩이용. 풀 둑은 진흙 입술로 읽힌다(감사 라운드 2).
 * 이미 2층에 무언가 있는 칸은 건드리지 않는다. 얹은 칸 수를 돌려준다.
 */
export function rimPit(project: Project, map: GameMap, cells: ReadonlySet<number>, bank: "bankGrass" | "bankLava" = "bankGrass"): number {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return 0;
  const nature = project.tilesets[BEODEUL_NATURE_ID] && project.tilesets[BEODEUL_NATURE_ID]!.count >= BEODEUL_NATURE.count
    ? project.tilesets[BEODEUL_NATURE_ID]! : (project.tilesets[BEODEUL_NATURE_ID] = createBeodeulNatureTileset());
  const { width: w, height: h } = map;
  const want = new Map<number, number>();
  for (const c of cells) {
    const x = c % w, y = Math.floor(c / w);
    let mask = 0;
    [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].forEach(([dx, dy], bit) => {
      const nx = x + dx!, ny = y + dy!;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || cells.has(ny * w + nx)) mask |= 1 << bit;
    });
    if (mask === 255 || layerTileAt(map, 2, c) >= 0) continue;
    const tile = BEODEUL_NATURE[bank][mask] ?? -1;
    if (tile >= 0) want.set(c, tile);
  }
  if (want.size === 0) return 0;
  const translated = translateTiles(nature, tileset, new Set(want.values()));
  for (const to of translated.map.values()) {
    if (to < 0) continue;
    tileset.priority[to] = "upper";
    tileset.passability[to] = { up: true, down: true, left: true, right: true };
  }
  let placed = 0;
  for (const [c, t] of want) { const to = translated.map.get(t) ?? -1; if (to >= 0) { setLayerTileAt(map, 2, c, to); placed++; } }
  return placed;
}
