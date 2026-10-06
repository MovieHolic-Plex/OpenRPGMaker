// 번들 키트 시트(몬스터 수집 monster_* 등)의 야외 빈 터를 그 지역 재료로 꾸민다 — furnish_outdoor_area.
// 왜(2026-10-06~07 실편집기 이어 고치기 r8~r11): 「서리꽃 마을 왼쪽 아래 공터 채워」에 조수가 칸 번호를 하나씩 칠해
// 55턴을 쓰고도 소품 네댓 개만 흩어 놓았고, 새 길은 기존 길에 닿지 않은 토막으로 남았다(검수 지적 「길이 끊겨 있다」).
// 모델은 터와 쓰임(style)만 고르고, 재료·덩이·길 잇기·문 앞 비우기·도달성은 코드가 지킨다.
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { shapeAllAutotileGroupsAround } from "@/project/defaults/autotileEngine";
import { computeReachableCells, isAdjacentOrOn } from "@/project/lint/reachability";
import type { AutotileGroup, GameMap, Project, TilesetDef } from "@/project/types";
import { RECT_SCHEMA } from "./schemaShapes";
import { ToolError, type ToolDefinition } from "./types";

interface Palette {
  /** 덩이로 심는 큰 나무(키트 이름). */
  readonly trees: readonly string[];
  /** 터의 눈길을 잡는 표식 하나(키트 이름 또는 칸 라벨). */
  readonly features: readonly string[];
  /** 나무·표식 곁에 두세 개씩 모으는 작은 소품(키트 이름 또는 칸 라벨). */
  readonly smalls: readonly string[];
  /** 걷는 길 오토타일 그룹. */
  /** 지금 맵에 가장 많이 깔린 그룹을 쓴다(마을 길=clearing, 도로=path). */
  readonly path?: readonly string[];
  /** 물·연못 오토타일 그룹과 그 둘레 띠. */
  readonly pond?: string;
  readonly pondRing?: string;
}

/** 지배 바닥 칸의 라벨 → 그 지역 재료. 시트에 없는 이름은 건너뛴다(같은 라벨 「풀밭」이 야외·해안 시트에 함께 있다). */
const PALETTES: Readonly<Record<string, Palette>> = {
  눈밭: { trees: ["spine_a"], features: ["snowman"], smalls: ["눈더미(통행 불가)", "얼어붙은 덤불(통행 불가)"], path: ["snowpath"], pond: "pond" },
  "사막 모래": { trees: ["palm_a"], features: ["cactus_tall", "dcone_b"], smalls: ["선인장(통행 불가)", "마른 덤불(통행 불가)", "마른 뼈(장식, 걸을 수 있다)"],
    path: ["ashpath"], pond: "oasis", pondRing: "dgrass" },
  "재 덮인 풀": { trees: ["atree_a"], features: ["steam_vent", "vcone_c"], smalls: ["재 무더기(통행 불가)", "용암석(통행 불가)"], path: ["ashpath"], pond: "spring" },
  풀밭: { trees: ["tree_a", "tree_b", "pine_a"], features: ["statue", "lamp", "bench", "planter"], smalls: ["planter", "장식 덤불(막힘, 자르기 아님 — 자르기는 cuttree)", "꽃밭"],
    path: ["clearing", "path", "pave"], pond: "water" },
  모래: { trees: ["palm"], features: ["parasol_red", "parasol_blue", "deckchair"], smalls: ["sandrock", "bucket", "jar_a", "crate", "barrel"], path: ["pave", "path"] },
};

type Style = "grove" | "garden" | "plaza" | "pond";
const STYLES: readonly Style[] = ["grove", "garden", "plaza", "pond"];
type Rect = { x: number; y: number; w: number; h: number };
type Piece = { name: string; width: number; height: number; lower: number[]; upper: number[] };

function hash(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed + 1, 0x51ed27);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

/** 키트 이름이면 그 키트, 아니면 라벨이 같은 칸 하나(위치 해시로 고른다)를 1×1 조각으로. */
function resolvePiece(tileset: TilesetDef, name: string, salt: number): Piece | null {
  const kit = tileset.structureKits?.find(k => k.name === name);
  if (kit) {
    const lower: number[] = [], upper: number[] = [];
    for (const row of kit.rows) for (let x = 0; x < kit.width; x++) { lower.push(row.tiles[x] ?? -1); upper.push(row.upperTiles?.[x] ?? -1); }
    return { name, width: kit.width, height: kit.height, lower, upper };
  }
  const tiles = Object.entries(tileset.tileMeta ?? {}).filter(([, meta]) => meta?.label === name).map(([id]) => Number(id));
  if (!tiles.length) return null;
  const tile = tiles[salt % tiles.length]!;
  const upperHome = tileset.tileMeta?.[tile]?.defaultLayer === "upper";
  return { name, width: 1, height: 1, lower: [upperHome ? -1 : tile], upper: [upperHome ? tile : -1] };
}

function available(tileset: TilesetDef, names: readonly string[]): string[] {
  return names.filter(name => resolvePiece(tileset, name, 0) !== null);
}

function mostUsedGroup(map: GameMap, tileset: TilesetDef, ids: readonly string[]): AutotileGroup | undefined {
  const groups = ids.map(id => groupOf(tileset, id)).filter((g): g is AutotileGroup => !!g);
  const score = (g: AutotileGroup) => { const set = new Set(g.memberTileIds); return map.lowerTiles.filter(t => set.has(t)).length; };
  return groups.sort((a, b) => score(b) - score(a))[0];
}

function groupOf(tileset: TilesetDef, id: string | undefined): AutotileGroup | undefined {
  return id ? autotileGroupsForTileset(tileset).find(g => g.id === id) : undefined;
}

export function furnishOutdoorArea(project: Project, map: GameMap, area: Rect, style: Style, seed: number) {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset?.structureKits?.length) throw new ToolError(`${map.tilesetId} 에 구조 키트가 없어 이 도구로 꾸밀 수 없습니다 — place_props·stamp_object 를 쓰세요.`, { code: "no-kits", mapId: map.id });
  const W = map.width, H = map.height;
  const r = { x: Math.max(0, area.x), y: Math.max(0, area.y), w: 0, h: 0 };
  r.w = Math.min(W, area.x + area.w) - r.x; r.h = Math.min(H, area.y + area.h) - r.y;
  if (r.w < 2 || r.h < 2) throw new ToolError("area 가 너무 작거나 맵 밖입니다.", { code: "invalid-args", mapId: map.id });
  const idx = (x: number, y: number) => y * W + x;
  const label = (tile: number) => tileset.tileMeta?.[tile]?.label ?? "";
  const eventAt = new Set(map.events.map(e => idx(e.x, e.y)));

  // 지배 바닥: 터 안에서 위층이 비고 이벤트 없는 칸의 라벨 최빈값.
  const counts = new Map<string, number>();
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    const i = idx(x, y);
    if (map.upperTiles[i] !== -1 || eventAt.has(i)) continue;
    const name = label(map.lowerTiles[i]!);
    if (PALETTES[name]) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const ground = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!ground) throw new ToolError(`이 터의 바닥이 알려진 지역 바닥(${Object.keys(PALETTES).join("·")})이 아닙니다 — 빈 바닥 칸이 있는 터를 고르세요.`, { code: "unknown-ground", mapId: map.id });
  const base = PALETTES[ground]!;
  const palette = { trees: available(tileset, base.trees), features: available(tileset, base.features), smalls: available(tileset, base.smalls) };
  const isGround = (i: number) => label(map.lowerTiles[i]!) === ground && map.upperTiles[i] === -1 && !eventAt.has(i);
  const plainCount = () => { let n = 0; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (isGround(idx(x, y))) n++; return n; };
  const emptyBefore = plainCount();

  // 비워 둘 칸: 이벤트 칸과 그 둘레(문·NPC·표지판 앞), 이동 이벤트(문·출구)는 아래로 두 칸 더.
  const keep = new Set<number>();
  for (const e of map.events) {
    const transfer = JSON.stringify(e).includes('"transfer"');
    for (let dy = -1; dy <= (transfer ? 2 : 1); dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = e.x + dx, y = e.y + dy;
      if (x >= 0 && y >= 0 && x < W && y < H && (Math.abs(dx) + Math.abs(dy) <= 1 || transfer)) keep.add(idx(x, y));
    }
  }
  const used = new Set<number>();
  const freeCell = (x: number, y: number) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h && !keep.has(idx(x, y)) && !used.has(idx(x, y)) && isGround(idx(x, y));

  // 도달성 기준: 지금 닿는 이벤트는 꾸민 뒤에도 닿아야 한다.
  const start = map.events.find(e => JSON.stringify(e).includes('"transfer"')) ?? map.events[0];
  const reachSeed = (() => {
    if (!start) return null;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0], [0, 0]] as const) {
      const x = start.x + dx, y = start.y + dy;
      if (x >= 0 && y >= 0 && x < W && y < H && computeReachableCells(project, map, x, y).size > 8) return { x, y };
    }
    return null;
  })();
  const reachTargets = (() => {
    if (!reachSeed) return [];
    const seen = computeReachableCells(project, map, reachSeed.x, reachSeed.y);
    return map.events.filter(e => isAdjacentOrOn(seen, e.x, e.y));
  })();
  const stillReachable = () => {
    if (!reachSeed) return true;
    const seen = computeReachableCells(project, map, reachSeed.x, reachSeed.y);
    return reachTargets.every(e => isAdjacentOrOn(seen, e.x, e.y));
  };

  const placed: { name: string; x: number; y: number; w: number; h: number }[] = [];
  const stamp = (piece: Piece, x0: number, y0: number): boolean => {
    for (let dy = 0; dy < piece.height; dy++) for (let dx = 0; dx < piece.width; dx++) if (!freeCell(x0 + dx, y0 + dy)) return false;
    const saved: [number, number, number][] = [];
    for (let dy = 0; dy < piece.height; dy++) for (let dx = 0; dx < piece.width; dx++) {
      const i = idx(x0 + dx, y0 + dy), k = dy * piece.width + dx;
      saved.push([i, map.lowerTiles[i]!, map.upperTiles[i]!]);
      if (piece.lower[k]! >= 0) map.lowerTiles[i] = piece.lower[k]!;
      if (piece.upper[k]! >= 0) map.upperTiles[i] = piece.upper[k]!;
    }
    if (!stillReachable()) { for (const [i, lo, up] of saved) { map.lowerTiles[i] = lo; map.upperTiles[i] = up; } return false; }
    for (const [i] of saved) used.add(i);
    placed.push({ name: piece.name, x: x0, y: y0, w: piece.width, h: piece.height });
    return true;
  };

  // 나무를 붙일 쪽: 맵 가장자리에 가장 가까운 터의 변(숲 벽에 기대 덩이가 자연스럽다).
  const sides = [
    { side: "left", d: r.x }, { side: "right", d: W - (r.x + r.w) }, { side: "top", d: r.y }, { side: "bottom", d: H - (r.y + r.h) },
  ].sort((a, b) => a.d - b.d);
  const edge = sides[0]!.side;
  const towardEdge = (x: number, y: number) => edge === "left" ? x - r.x : edge === "right" ? r.x + r.w - 1 - x : edge === "top" ? y - r.y : r.y + r.h - 1 - y;
  const cells: { x: number; y: number }[] = [];
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) cells.push({ x, y });
  const center = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) };

  // 1) 물·광장 같은 바닥 덩이
  const paintGroup = (group: AutotileGroup, rect: Rect, rounded: boolean): { x: number; y: number }[] => {
    const changed: { x: number; y: number }[] = [];
    const full = group.variantMap[String(group.neighborhood === 8 ? 255 : 15)]!;
    for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
      const corner = (x === rect.x || x === rect.x + rect.w - 1) && (y === rect.y || y === rect.y + rect.h - 1);
      if ((rounded && corner) || !freeCell(x, y)) continue;
      map.lowerTiles[idx(x, y)] = full; used.add(idx(x, y)); changed.push({ x, y });
    }
    shapeAllAutotileGroupsAround(map, [group], changed);
    return changed;
  };
  let feature: { x: number; y: number } | null = null;
  const shore = new Set<number>();
  const pondGroup = groupOf(tileset, base.pond), ringGroup = groupOf(tileset, base.pondRing), pathGroup = mostUsedGroup(map, tileset, base.path ?? []);
  // 덩이 자리: 둘레 한 칸까지(모서리 제외) 전부 빈 바닥인 가장 큰 사각형을 터 가운데 가깝게 고른다 —
  // 건물·길에 걸치면 연못이 T자로 찢기고 광장이 조각났다(2026-10-07 시험).
  const freeRect = (maxW: number, maxH: number, minW: number, minH: number): Rect | null => {
    for (let w = maxW, h = maxH; w >= minW && h >= minH; w > h ? w-- : h--) {
      let best: Rect | null = null, bestD = Infinity;
      for (let y = r.y + 1; y + h <= r.y + r.h - 1; y++) for (let x = r.x + 1; x + w <= r.x + r.w - 1; x++) {
        let ok = true;
        for (let yy = y - 1; ok && yy <= y + h; yy++) for (let xx = x - 1; ok && xx <= x + w; xx++) {
          const corner = (xx === x - 1 || xx === x + w) && (yy === y - 1 || yy === y + h);
          if (!corner && !freeCell(xx, yy)) ok = false;
        }
        const d = Math.abs(x + w / 2 - (r.x + r.w / 2)) + Math.abs(y + h / 2 - (r.y + r.h / 2));
        if (ok && d < bestD) { best = { x, y, w, h }; bestD = d; }
      }
      if (best) return best;
    }
    return null;
  };
  if (style === "pond" && pondGroup) {
    const pr = freeRect(Math.min(5, r.w - 2), Math.min(4, r.h - 2), 2, 2);
    if (!pr) throw new ToolError("이 터에는 둘레까지 빈 연못 자리(최소 4×4)가 없습니다 — 더 넓은 빈 터를 고르거나 style:garden 을 쓰세요.", { code: "no-room", mapId: map.id });
    const ring = new Set((ringGroup ? paintGroup(ringGroup, { x: pr.x - 1, y: pr.y - 1, w: pr.w + 2, h: pr.h + 2 }, true) : []).map(c => idx(c.x, c.y)));
    const water = paintGroupOver(map, pondGroup, ringGroup, pr, idx, i => isGround(i) || ring.has(i));
    for (const c of water) used.add(idx(c.x, c.y));
    // 띠가 없는 물은 둘레 한 칸을 비워 둔다(물가에 바로 나무가 붙지 않게).
    if (!ringGroup) for (let y = pr.y - 1; y <= pr.y + pr.h; y++) for (let x = pr.x - 1; x <= pr.x + pr.w; x++) if (x >= 0 && y >= 0 && x < W && y < H) shore.add(idx(x, y));
    if (!stillReachable()) throw new ToolError("연못이 길을 막습니다 — 더 넓은 터를 고르거나 style:garden 을 쓰세요.", { code: "blocks-path", mapId: map.id });
    placed.push({ name: base.pond!, x: pr.x - (ringGroup ? 1 : 0), y: pr.y - (ringGroup ? 1 : 0), w: pr.w + (ringGroup ? 2 : 0), h: pr.h + (ringGroup ? 2 : 0) });
  }
  if (style === "plaza" && pathGroup) {
    const pr = freeRect(Math.min(5, r.w - 2), Math.min(4, r.h - 2), 3, 3);
    if (!pr) throw new ToolError("이 터에는 둘레까지 빈 광장 자리(최소 5×5)가 없습니다 — 더 넓은 빈 터를 고르거나 style:garden 을 쓰세요.", { code: "no-room", mapId: map.id });
    paintGroup(pathGroup, pr, false);
    feature = { x: pr.x + Math.floor(pr.w / 2), y: pr.y + Math.floor(pr.h / 2) };
  }

  // 2) 표식 자리: 터 가운데 근처, 나무 쪽 반대편.
  if (style !== "grove" && style !== "pond" && !feature) {
    const spots = cells.filter(c => freeCell(c.x, c.y)).sort((a, b) =>
      (Math.abs(a.x - center.x) + Math.abs(a.y - center.y) - towardEdge(a.x, a.y) * 0.3) - (Math.abs(b.x - center.x) + Math.abs(b.y - center.y) - towardEdge(b.x, b.y) * 0.3));
    feature = spots[0] ?? null;
  }

  // 3) 길: 표식에서 가장 가까운 기존 길까지(터 밖 바닥도 지나간다), 기존 길에 닿아야 한다.
  let pathCells = 0;
  if (feature && pathGroup && style !== "pond") {
    const members = new Set(pathGroup.connectTileIds ?? pathGroup.memberTileIds);
    const near = ([[0, 1], [1, 0], [-1, 0], [0, -1]] as const).map(([dx, dy]) => ({ x: feature!.x + dx, y: feature!.y + dy })).find(c => freeCell(c.x, c.y));
    const startI = near ? idx(near.x, near.y) : -1;
    const prev = new Map<number, number>([[startI, -1]]);
    const queue = startI >= 0 ? [startI] : [];
    let hit = -1;
    for (let head = 0; head < queue.length && hit < 0; head++) {
      const i = queue[head]!, x = i % W, y = Math.floor(i / W);
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
        const nx = x + dx, ny = y + dy, ni = idx(nx, ny);
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev.has(ni)) continue;
        if (members.has(map.lowerTiles[ni]!) && !used.has(ni)) { prev.set(ni, i); hit = ni; break; }
        if (!isGround(ni) || keep.has(ni) || used.has(ni)) continue;
        if (Math.abs(nx - feature.x) + Math.abs(ny - feature.y) > r.w + r.h + 6) continue;
        prev.set(ni, i); queue.push(ni);
      }
    }
    if (hit >= 0) {
      const route: { x: number; y: number }[] = [];
      for (let i = prev.get(hit)!; i >= 0; i = prev.get(i)!) route.push({ x: i % W, y: Math.floor(i / W) });
      const full = pathGroup.variantMap[String(pathGroup.neighborhood === 8 ? 255 : 15)]!;
      for (const c of route) { map.lowerTiles[idx(c.x, c.y)] = full; used.add(idx(c.x, c.y)); }
      shapeAllAutotileGroupsAround(map, [pathGroup], route);
      pathCells = route.length;
    }
  }

  // 4) 나무 덩이: 가장자리 쪽부터 맞닿게. grove 는 터의 반 넘게, 나머지는 두세 그루.
  const treeTarget = style === "grove" ? Math.max(3, Math.floor((r.w * r.h) / 9)) : style === "pond" ? 2 : 3;
  let trees = 0;
  if (palette.trees.length) {
    const order = cells.slice().sort((a, b) => towardEdge(a.x, a.y) - towardEdge(b.x, b.y) || (hash(a.x, a.y, seed) % 7) - (hash(b.x, b.y, seed) % 7));
    for (const c of order) {
      if (trees >= treeTarget) break;
      const piece = resolvePiece(tileset, palette.trees[hash(c.x, c.y, seed) % palette.trees.length]!, hash(c.x, c.y, seed));
      if (!piece) continue;
      if (style !== "grove" && feature && Math.abs(c.x - feature.x) + Math.abs(c.y - feature.y) < 3) continue;
      let onShore = false;
      for (let dy = 0; dy < piece.height && !onShore; dy++) for (let dx = 0; dx < piece.width; dx++) if (shore.has(idx(c.x + dx, c.y + dy))) onShore = true;
      if (onShore) continue;
      if (stamp(piece, c.x, c.y)) trees++;
    }
  }

  // 5) 표식
  if (feature && palette.features.length) {
    const piece = resolvePiece(tileset, palette.features[seed % palette.features.length]!, seed);
    if (piece) {
      // 광장은 바닥이 길 칸이라 freeCell 이 거절한다 — 그 칸들만 잠시 바닥처럼 본다.
      const fy = feature.y - (piece.height - 1);
      if (style === "plaza") forcePlace(map, piece, feature.x, fy, idx, placed);
      else if (!stamp(piece, feature.x, Math.max(r.y, fy))) {
        for (const c of cells) if (stamp(piece, c.x, c.y)) break;
      }
    }
  }

  // 6) 작은 소품: 나무·표식·물가의 밑동 둘레에 한두 개씩 — 서로 붙지 않게(붙이면 한 줄로 늘어서 울타리처럼 읽혔다).
  let smalls = 0;
  if (palette.smalls.length) {
    const goal = Math.floor(emptyBefore * 0.4);
    const smallAt = new Set<number>();
    const touchesSmall = (x: number, y: number) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => smallAt.has(idx(x + dx!, y + dy!)));
    for (const a of placed.slice()) {
      if (plainCount() <= goal) break;
      const isPond = a.name === base.pond;
      const rim: { x: number; y: number }[] = [];
      if (isPond) {
        for (let x = a.x - 1; x <= a.x + a.w; x++) rim.push({ x, y: a.y - 1 }, { x, y: a.y + a.h });
        for (let y = a.y; y < a.y + a.h; y++) rim.push({ x: a.x - 1, y }, { x: a.x + a.w, y });
      } else {
        const by = a.y + a.h - 1;
        rim.push({ x: a.x - 1, y: by }, { x: a.x + a.w, y: by }, { x: a.x - 1, y: by + 1 }, { x: a.x + a.w, y: by + 1 }, { x: a.x - 1, y: by - 1 }, { x: a.x + a.w, y: by - 1 });
      }
      rim.sort((p, q) => hash(p.x, p.y, seed) - hash(q.x, q.y, seed));
      let here = 0;
      for (const c of rim) {
        if (here >= (isPond ? 3 : 2) || plainCount() <= goal) break;
        if (touchesSmall(c.x, c.y)) continue;
        const piece = resolvePiece(tileset, palette.smalls[hash(c.x, c.y, seed + 7) % palette.smalls.length]!, hash(c.x, c.y, seed));
        if (piece && piece.width === 1 && piece.height === 1 && stamp(piece, c.x, c.y)) { here++; smalls++; smallAt.add(idx(c.x, c.y)); }
      }
    }
  }
  return { ground, emptyBefore, emptyAfter: plainCount(), trees, smalls, pathCells, placed, palette };
}

/** 물 덩이: 둘레 띠가 있으면 띠 위에, 없으면 바닥 위에 칠한다. */
function paintGroupOver(map: GameMap, group: AutotileGroup, ring: AutotileGroup | undefined, rect: Rect,
  idx: (x: number, y: number) => number, allowed: (i: number) => boolean): { x: number; y: number }[] {
  const full = group.variantMap[String(group.neighborhood === 8 ? 255 : 15)]!;
  const changed: { x: number; y: number }[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
    const i = idx(x, y);
    if (!allowed(i)) continue;
    map.lowerTiles[i] = full; changed.push({ x, y });
  }
  shapeAllAutotileGroupsAround(map, ring ? [group, ring] : [group], changed);
  return changed;
}

function forcePlace(map: GameMap, piece: Piece, x0: number, y0: number, idx: (x: number, y: number) => number, placed: { name: string; x: number; y: number; w: number; h: number }[]): void {
  for (let dy = 0; dy < piece.height; dy++) for (let dx = 0; dx < piece.width; dx++) {
    const k = dy * piece.width + dx, i = idx(x0 + dx, y0 + dy);
    if (piece.upper[k]! >= 0) map.upperTiles[i] = piece.upper[k]!;
  }
  placed.push({ name: piece.name, x: x0, y: y0, w: piece.width, h: piece.height });
}

/** 지역 바닥(PALETTES 라벨)이 위층·이벤트 없이 비어 있는 가장 큰 사각형들 — 겹치지 않게 큰 순서로. */
export function findEmptyGround(project: Project, map: GameMap, limit = 4, minArea = 12): (Rect & { ground: string; cells: number })[] {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return [];
  const W = map.width, H = map.height;
  const events = new Set(map.events.map(e => e.y * W + e.x));
  const near = new Set<number>();
  for (const e of map.events) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) near.add((e.y + dy) * W + e.x + dx);
  const label = (i: number) => tileset.tileMeta?.[map.lowerTiles[i]!]?.label ?? "";
  const open = (i: number) => map.upperTiles[i] === -1 && !events.has(i) && !near.has(i) && PALETTES[label(i)] !== undefined;
  const taken = new Set<number>();
  const out: (Rect & { ground: string; cells: number })[] = [];
  while (out.length < limit) {
    // 막대그래프 최대 사각형(줄마다 높이 누적).
    const heights = new Array<number>(W).fill(0);
    let best: Rect | null = null, bestArea = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) { const i = y * W + x; heights[x] = open(i) && !taken.has(i) ? heights[x]! + 1 : 0; }
      for (let x = 0; x < W; x++) {
        let h = Infinity;
        for (let x2 = x; x2 < W && heights[x2]! > 0; x2++) {
          h = Math.min(h, heights[x2]!);
          const w = x2 - x + 1, area = w * h;
          // 너무 가는 띠(폭·높이 2 미만)는 꾸밀 터가 아니다.
          if (w >= 3 && h >= 3 && area > bestArea) { bestArea = area; best = { x, y: y - h + 1, w, h }; }
        }
      }
    }
    if (!best || bestArea < minArea) break;
    for (let y = best.y; y < best.y + best.h; y++) for (let x = best.x; x < best.x + best.w; x++) taken.add(y * W + x);
    out.push({ ...best, ground: label(best.y * W + best.x), cells: bestArea });
  }
  return out;
}

/** 키트 시트 야외 맵이면 조수에게 처음부터 쥐여 줄 도구. */
export const KIT_AREA_EXPOSED_TOOLS = ["find_empty_ground", "furnish_outdoor_area", "show_map_region"] as const;

/**
 * 대상 맵이 구조 키트 시트의 야외 맵(바닥 칸 1/4 이상이 PALETTES 지역 바닥)이면 조수 노트 한 단락, 아니면 null.
 * r8~r11 에서 조수는 이 도구가 있어도 찾지 않고 paint_tiles 로 칸을 하나씩 칠했다 — 처음부터 보이게 하고 이름을 부른다.
 */
export function kitAreaNote(project: Project, mapId: string | null | undefined): string | null {
  const map = mapId ? project.maps[mapId] : undefined;
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;
  if (!map || !tileset?.structureKits?.length || map.mapRole === "interior" || map.mapRole === "dungeon") return null;
  let known = 0;
  for (const tile of map.lowerTiles) if (PALETTES[tileset.tileMeta?.[tile]?.label ?? ""]) known++;
  if (known * 4 < map.lowerTiles.length) return null;
  return `[키트 시트 야외 맵] ${map.name}(${map.id})은 구조 키트 시트(${tileset.id})다. 빈 터·공터를 채우거나 꾸미는 요청은 칸 번호를 하나씩 칠하지 말고 `
    + "find_empty_ground 로 터를 찾고(사용자가 말한 쪽과 겹치는 것) furnish_outdoor_area(area, style) 로 먼저 꾸민 뒤 show_map_region 으로 본다. "
    + "터가 크면 둘로 나눠 style 을 달리한다(가장자리 쪽 grove + 안쪽 garden, 넓으면 pond·plaza). 모자란 곳만 place_props·paint_tiles 로 다듬는다.";
}

export const KIT_AREA_TOOLS: readonly ToolDefinition[] = [{
  name: "find_empty_ground",
  mode: "read",
  domains: ["map", "tile"],
  description: "야외 맵에서 꾸밀 만한 빈 터(지역 바닥이 위층·이벤트 없이 비어 있는 큰 사각형)를 큰 순서로 찾는다. 「빈 곳·공터 채워」 요청에서 furnish_outdoor_area 의 area 를 고르기 전에 쓴다. 사용자가 말한 쪽(왼쪽 아래 등)과 겹치는 것을 고른다.",
  parameters: { type: "object", properties: { mapId: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 8 } }, required: ["mapId"], additionalProperties: false },
  fillsCurrentMapId: true,
  run(project, args) {
    const map = project.maps[String(args.mapId)];
    if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${String(args.mapId)}`, { code: "map-not-found" });
    const areas = findEmptyGround(project, map, Number.isInteger(args.limit) ? Number(args.limit) : 4);
    return { summary: areas.length ? `${map.name} 빈 터 ${areas.length}곳: ${areas.map(a => `(${a.x},${a.y}) ${a.w}×${a.h} ${a.ground}`).join(" · ")}` : `${map.name}에 꾸밀 만한 빈 터(3×3 이상)가 없습니다.`, data: { mapId: map.id, areas } };
  },
}, {
  name: "furnish_outdoor_area",
  mode: "write",
  domains: ["map", "tile"],
  description:
    "야외 맵의 휑한 빈 터·공터를 그 지역 재료로 꾸며 채운다(빈 곳 채워·허전해·휑해·꾸며 줘 요청). 몬스터 수집 시트(monster_*)처럼 구조 키트가 있는 시트용. " +
    "area 와 style 만 고르면 코드가 터의 바닥(눈밭·사막 모래·재 덮인 풀·풀밭·모래)에 맞는 나무·표식·소품·길·물을 골라 덩이로 놓는다: " +
    "나무는 맵 가장자리 쪽에 맞닿게, 표식은 가운데, 소품은 나무·표식 곁에 두세 개씩, 새 길은 가장 가까운 기존 길까지 이어 깐다. " +
    "문·출구 앞과 이벤트 둘레는 비우고, 놓기 전에 닿던 이벤트가 하나라도 막히면 그 조각은 놓지 않는다. " +
    "style: grove=나무 숲 덩이, garden=나무 몇 그루+표식+소품+길(기본), plaza=작은 광장(길 바닥)+가운데 표식, pond=연못/오아시스+둘레 소품. " +
    "칸 번호를 하나씩 칠하는 것보다 먼저 쓴다. 결과는 show_map_region 으로 보고, 모자란 곳만 place_props·paint_tiles 로 다듬는다.",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      area: { ...RECT_SCHEMA, description: "{x,y,w,h} 꾸밀 터. 건물·길을 피한 빈 바닥이 대부분이어야 한다." },
      style: { type: "string", enum: [...STYLES], description: "grove|garden|plaza|pond (기본 garden)" },
      seed: { type: "integer", description: "다른 배치를 원하면 바꾼다" },
    },
    required: ["mapId", "area"],
    additionalProperties: false,
  },
  run(project, args) {
    const map = project.maps[String(args.mapId)];
    if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${String(args.mapId)}`, { code: "map-not-found" });
    const area = args.area as Rect;
    if (![area?.x, area?.y, area?.w, area?.h].every(Number.isInteger)) throw new ToolError("area 는 정수 {x,y,w,h} 입니다.", { code: "invalid-args", mapId: map.id });
    const style = (STYLES as readonly string[]).includes(String(args.style)) ? args.style as Style : "garden";
    const result = furnishOutdoorArea(project, map, area, style, Number.isInteger(args.seed) ? Number(args.seed) : 1);
    const parts = `나무 ${result.trees} · 소품 ${result.smalls}${result.pathCells ? ` · 길 ${result.pathCells}칸(기존 길에 이음)` : ""}`;
    return {
      summary: `${map.name} (${area.x},${area.y}) ${area.w}×${area.h} ${style} 꾸밈(${result.ground}) — ${parts}, 빈 바닥 ${result.emptyBefore}→${result.emptyAfter}칸`,
      data: { mapId: map.id, ...result },
      ...(result.emptyAfter > result.emptyBefore * 0.6 ? { warnings: [`빈 바닥이 아직 ${result.emptyAfter}칸이다 — 터가 길·문 앞으로 막혀 있으면 style 을 바꾸거나 남은 칸을 place_props 로 다듬는다.`] } : {}),
    };
  },
}];
