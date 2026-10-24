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
export function rimPit(project: Project, map: GameMap, cells: ReadonlySet<number>, bank: "bankGrass" | "bankLava" | "bankMud" = "bankGrass"): number {
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

/**
 * 지하 묘소의 허공(천장 오토타일이 남기는 균일한 남색 면)을 바위 덩어리로 읽히게 한다(VQA — 화면이 비어 보임).
 * 방·복도에서 가까운 허공 칸(`bandMax` 칸 이내)만 이미 번들에 있는 광산 바위 결(`rockTiles`)로 바꾸고 바깥은 그대로 어둠이다.
 * 열린 칸과 닿는 테두리 띠(오토타일)는 손대지 않는다 — 허공 값(`voidTiles`)인 칸만 바꾼다.
 */
export function dressVaultVoid(map: GameMap, voidTiles: ReadonlySet<number>, rockTiles: readonly number[], bandMin: number, bandMax: number): number {
  const { width: w, height: h } = map;
  const dist = new Int16Array(w * h).fill(-1);
  const queue: number[] = [];
  for (let c = 0; c < w * h; c += 1) if (!voidTiles.has(map.lowerTiles[c] ?? -1)) { dist[c] = 0; queue.push(c); }
  for (let head = 0; head < queue.length; head += 1) {
    const c = queue[head]!, x = c % w, y = Math.floor(c / w);
    if (dist[c]! >= bandMax) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (dist[n]! >= 0) continue;
      dist[n] = dist[c]! + 1; queue.push(n);
    }
  }
  let changed = 0;
  for (let c = 0; c < w * h; c += 1) {
    if (!voidTiles.has(map.lowerTiles[c] ?? -1)) continue;
    const d = dist[c]!;
    if (d < bandMin || d > bandMax) continue;
    const x = c % w, y = Math.floor(c / w);
    const hsh = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    map.lowerTiles[c] = rockTiles[hsh % rockTiles.length]!;
    changed += 1;
  }
  return changed;
}

/**
 * 방 밖 허공을 암반 덩어리로 채우되 한 종류의 잡음 무늬를 반복하지 않는다(VQA r5 — 「오른쪽 45% 가 소음 덩어리」).
 * 방에서 가까운 한두 칸은 윤곽이 보이는 회색 가장자리, 그다음은 명암이 낮은 보랏빛 암반이 큰 덩이로, 깊은 곳은 어두운 심층암.
 * 덩이 경계는 칸 좌표 값 잡음으로 번지게 해 격자 반복이 보이지 않게 하고, 회색 광맥 덩이를 드물게 섞는다. 새 그림은 쓰지 않는다.
 */
export function dressVaultRock(
  map: GameMap,
  voidTiles: ReadonlySet<number>,
  tiles: { edge: readonly number[]; vein: readonly number[]; mid: readonly number[]; deep: readonly number[] },
  /** 방 윗벽 위로 이만큼 줄은 밝은 가장자리 암벽 대신 어두운 천장 띠(deep 칸)로 칠한다. 0 이면 끈다. */
  ceilingRows = 0,
  /** 0 보다 크면 방에서 이 거리 너머는 전부 어두운 천장 칸(deep) — 밝은 중간 암반·디더 얼룩 없이 균일하게(바닥처럼 읽히는 암반 덩어리 금지). 0 이면 옛 동작. */
  solidBeyond = 0,
): number {
  const { width: w, height: h } = map;
  const dist = new Int16Array(w * h).fill(-1);
  const queue: number[] = [];
  for (let c = 0; c < w * h; c += 1) if (!voidTiles.has(map.lowerTiles[c] ?? -1)) { dist[c] = 0; queue.push(c); }
  for (let head = 0; head < queue.length; head += 1) {
    const c = queue[head]!, x = c % w, y = Math.floor(c / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (dist[n]! >= 0) continue;
      dist[n] = dist[c]! + 1; queue.push(n);
    }
  }
  const hash = (x: number, y: number, salt: number): number => ((((x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)) >>> 0) % 1000) / 1000;
  const smooth = (x: number, y: number, cell: number, salt: number): number => {
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell), fx = (x / cell) - gx, fy = (y / cell) - gy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(gx, gy, salt), b = hash(gx + 1, gy, salt), c = hash(gx, gy + 1, salt), d = hash(gx + 1, gy + 1, salt);
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
  };
  const pick = (list: readonly number[], x: number, y: number, salt: number): number => list[Math.floor(hash(x, y, salt) * list.length) % list.length]!;
  let changed = 0;
  for (let c = 0; c < w * h; c += 1) {
    if (!voidTiles.has(map.lowerTiles[c] ?? -1)) continue;
    const d = dist[c]!;
    if (d < 1) continue;
    const x = c % w, y = Math.floor(c / w);
    const n = smooth(x, y, 5, 7) * 0.7 + smooth(x, y, 2, 8) * 0.3;
    let next: number;
    // 방 바로 바깥은 부드러운 한 덩이 암벽(가장자리 → 중간 암반)이고, 멀어질수록 어두운 허공 칸이 거리에 비례해 섞여 사그라진다(VQA r6 — 노이즈 많은 암벽 + 검은 덩어리 컷아웃 지적).
    // 허공 칸은 덩어리 임계값이 아니라 칸 단위 디더라 덩어리 모서리 없이 번진다. 중간 암반은 큰 격자로 변형을 고른다(칸마다 무작위 얼룩 금지).
    const deepShare = d <= 14 ? 0 : Math.min(0.7, (d - 14) * 0.15) + (n - 0.5) * 0.1;
    const coarse = (list: readonly number[]): number => list[Math.floor(smooth(x, y, 3, 3) * list.length) % list.length]!;
    // 방(비허공 칸) 바로 위 ceilingRows 줄 = 천장. 밝은 가장자리 암벽이면 바닥·벽 윗면처럼 읽히므로 어두운 칸으로 덮는다.
    let capped = false;
    for (let k = 1; k <= ceilingRows && y + k < h; k += 1) {
      if (!voidTiles.has(map.lowerTiles[(y + k) * w + x] ?? -1)) { capped = true; break; }
      if (dist[(y + k) * w + x]! < 0) break;
    }
    if (capped) next = pick(tiles.deep, x, y, 5);
    else if (d <= 2) next = pick(tiles.edge, x, y, 1);
    else if (solidBeyond > 0 && d > solidBeyond) next = pick(tiles.deep, x, y, 4);
    else if (hash(x, y, 4) < deepShare) next = pick(tiles.deep, x, y, 4);
    else if (d <= 6 && n > 0.8) next = pick(tiles.vein, x, y, 2);
    else next = coarse(tiles.mid);
    map.lowerTiles[c] = next; changed += 1;
  }
  return changed;
}

/**
 * 금고 바닥의 규칙적인 체커 판을 깬다(가혹 VQA r3 「바닥 반복 체커」). 평평한 바닥 칸(floorTiles) 가운데 일부를
 * 같은 줄 중앙 길에 이미 쓰인 금 간 포석(crackedTiles)으로 칸 좌표 해시에 따라 흩어 바꾼다. 새 그림은 쓰지 않는다.
 */
export function varyVaultFloor(map: GameMap, floorTiles: ReadonlySet<number>, crackedTiles: readonly number[], flatTiles: readonly number[], crackedPerMille: number): number {
  let changed = 0;
  for (let c = 0; c < map.width * map.height; c += 1) {
    const t = map.lowerTiles[c] ?? -1;
    if (!floorTiles.has(t)) continue;
    const x = c % map.width, y = Math.floor(c / map.width);
    const hsh = (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000;
    const next = hsh < crackedPerMille ? crackedTiles[hsh % crackedTiles.length]! : flatTiles[(hsh >> 1) % flatTiles.length]!;
    if (next !== t) { map.lowerTiles[c] = next; changed += 1; }
  }
  return changed;
}

/**
 * 균일한 회색 포석이 한 방을 덮는 경우(VQA — 세이브 결정의 방 「평평한 회색 바닥」) 구역 안에 흙·이끼 얼룩을 흩뿌려 깬다.
 * 칸 좌표 해시 값 잡음 두 겹으로 덩이를 만들고, 덩이 안의 평평한 칸(floorTiles)만 `dirtTiles`/`mossTiles` 로 바꾼다.
 * 가운데 길(`keepX` 두 값 사이)은 건드리지 않는다. 새 그림은 쓰지 않는다.
 */
export function scatterVaultFloorPatches(
  map: GameMap,
  rect: { x0: number; y0: number; x1: number; y1: number },
  floorTiles: ReadonlySet<number>,
  dirtTiles: readonly number[],
  mossTiles: readonly number[],
  keepX?: readonly [number, number],
): number {
  const hash = (x: number, y: number, salt: number): number => ((((x * 73856093) ^ (y * 19349663) ^ (salt * 83492791)) >>> 0) % 1000) / 1000;
  const smooth = (x: number, y: number, cell: number, salt: number): number => {
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell), fx = (x / cell) - gx, fy = (y / cell) - gy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(gx, gy, salt), b = hash(gx + 1, gy, salt), c = hash(gx, gy + 1, salt), d = hash(gx + 1, gy + 1, salt);
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
  };
  let changed = 0;
  for (let y = rect.y0; y <= rect.y1; y += 1) {
    for (let x = rect.x0; x <= rect.x1; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      if (keepX && x >= keepX[0] && x <= keepX[1]) continue;
      const c = y * map.width + x;
      if (!floorTiles.has(map.lowerTiles[c] ?? -1)) continue;
      const n = smooth(x, y, 4, 1) * 0.65 + smooth(x, y, 2, 2) * 0.35;
      if (n > 0.66) { map.lowerTiles[c] = dirtTiles[Math.floor(hash(x, y, 3) * dirtTiles.length) % dirtTiles.length]!; changed += 1; }
      else if (n < 0.27) { map.lowerTiles[c] = mossTiles[Math.floor(hash(x, y, 4) * mossTiles.length) % mossTiles.length]!; changed += 1; }
    }
  }
  return changed;
}

/**
 * 화면(480×270)보다 작은 방은 바깥이 검은 허공이 되고 흙먼지 입자가 별밭처럼 얹힌다(VQA r4 — 화로의 방).
 * 방을 가운데 두고 사방에 `padX`×`padY` 칸 바위 둘레를 덧붙인다. 타일 층·덧그림·이벤트 좌표·방 안 칸 바꾸기/입자 좌표를 함께 민다.
 * 다른 맵에서 이 방으로 들어오는 이동 좌표는 호출자가 같은 만큼 옮긴다.
 */
export function padMapCentered(map: GameMap, padX: number, padY: number, rockTiles: readonly number[] | ((x: number, y: number) => number)): void {
  const ow = map.width, oh = map.height, nw = ow + padX * 2, nh = oh + padY * 2;
  const shiftLayer = (src: readonly number[] | undefined, fill: (x: number, y: number) => number): number[] => {
    const out = new Array<number>(nw * nh);
    for (let y = 0; y < nh; y += 1) for (let x = 0; x < nw; x += 1) {
      const ox = x - padX, oy = y - padY;
      const inside = ox >= 0 && oy >= 0 && ox < ow && oy < oh;
      out[y * nw + x] = inside ? (src?.[oy * ow + ox] ?? -1) : fill(x, y);
    }
    return out;
  };
  const rock = typeof rockTiles === "function" ? rockTiles : (x: number, y: number): number => rockTiles[(((x * 73856093) ^ (y * 19349663)) >>> 0) % rockTiles.length]!;
  map.lowerTiles = shiftLayer(map.lowerTiles, rock);
  map.upperTiles = shiftLayer(map.upperTiles, () => -1);
  map.lowerOverlayTiles = shiftLayer(map.lowerOverlayTiles, () => -1);
  map.upperOverlayTiles = shiftLayer(map.upperOverlayTiles, () => -1);
  map.width = nw; map.height = nh;
  // 같은 명령 객체가 여러 페이지·목록에 공유되어 있으면 한 번만 민다 — 여러 번 밀려 화로 점화 그림이 방 밖 (30,19) 같은 칸에 찍혔다.
  const seen = new Set<object>();
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const rec = node as Record<string, unknown>;
    if (rec.kind === "changeTile" && rec.mapId === map.id && typeof rec.x === "number" && typeof rec.y === "number") { rec.x += padX; rec.y += padY; }
    if (rec.kind === "m2Command") {
      const f = rec.fields as Record<string, unknown> | undefined;
      if (f && typeof f.x === "number" && typeof f.y === "number") { f.x += padX; f.y += padY; }
    }
    for (const value of Object.values(rec)) if (value && typeof value === "object") walk(value);
  };
  for (const event of map.events) {
    event.x += padX; event.y += padY;
    walk(event.pages); walk(event.commands);
  }
}
