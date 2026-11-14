// 버들항 풀 결 — 기본 풀 바닥(737) 한 칸이 열린 땅을 덮어 한 맵의 풀밭이 평평한 한 판으로 읽히던 것을 푼다.
//
// 왜(2026-11-14 오너 «기본 바닥타일인 풀 타일들도 좀 다양하게 배치할 수 있게끔 해라»): 마을 한 장의 열린 풀 칸은 전부 737 이었다 — 겉모습(바닥 재질)은
// 그 한 칸의 빛만 바꾸고, 풀밭 얼룩(meadow)은 드물고 큰 덩이라 그 사이는 16px 무늬가 되풀이됐다.
// 어떻게(같은 날 오너 «무작위처럼 깔린 것도 맘에 안 들어» · 보낸 마을 그림들): 결은 흩뿌리지 않는다. **무엇인가를 따라** 띠로 선다 —
//   · 짙은 결: 나무 줄·물가·절벽 발치·울타리 곁(그늘지고 물기 있는 자리)  · 옅은 결: 길·광장 곁과 절벽 위 끝(밟히고 마른 자리)
//   · 풀 포기·토끼풀·들꽃·잔돌: 나무·물가·집 곁에 무리 지어(한 무리는 거의 한 종류), 무리 밖 낱칸은 드물게.
//   띠는 곁을 따라 구간구간 서고(낮은 물결), 폭은 한 칸에서 섞음의 reach 칸까지 물결친다. 그 사이는 맨 풀밭으로 비워 둔다.
//   맨 풀밭도 같은 빛의 «다른 배열» 통칸을 섞어 16px 되풀이를 깬다(빛이 같아 얼룩으로 읽히지 않는다).
// 칸은 바닥 겉모습 재질마다 따로 구워져 있다(토끼풀 바닥 게임은 토끼풀 빛 결, 마른 풀 게임은 마른 빛 결 — assets/tilesetStands.ts 의 grain).
// 1층 칸 번호(737)·3층 물체·이벤트·통행은 한 글자도 바뀌지 않는다 — 풀밭을 737 로 알아보는 도구·검사가 그대로 읽는다. 결 칸은 2층의 ★(통행 + 상위)라 통행 판정에서 건너뛴다.
// 2층이 이미 찬 칸(그림자·물가 둑·숲 바닥·풀밭 얼룩)에는 깔지 않는다. 겉모습에 grain 이 없는 게임(옛 게임)에는 아무것도 하지 않는다.
// 난수는 칸 좌표·씨앗 해시뿐이다(시공기의 난수 줄을 쓰지 않는다 — 결을 깔아도 나머지 배치가 달라지지 않는다).
import forestComposer from "@/assets/beodeulForestComposer.json";
import { tilesetLookGround } from "@/assets/tilesetLooks";
import { standGrainTile, standOverlaySource, tilesetStandTableFor, type GrassGrainCells, type GrassGrainMix } from "@/assets/tilesetStands";
import { activeTilesetLook } from "@/project/kitLook";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { translateTiles } from "@/project/objectStamp";
import type { GameMap, Project } from "@/project/types";
import { protectedHouseCells } from "./houseProtection";
import { ToolError, type ToolDefinition } from "./types";

const GRASS = 737;
const WOODLAND_GRASS = (forestComposer as unknown as { ground: { woodlandGrass?: number } }).ground.woodlandGrass ?? -1;

type Area = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
/** 한 자리에 손으로 까는 결: 짙은 결 · 옅은 결 · 풀 무늬 무리(종류 목록). */
export type GrassDrift = { readonly tone: "deep" | "pale" } | { readonly sprigs: readonly string[] };

export interface BeodeulGrassGrainOptions {
  readonly seed: number;
  /** 바닥 겉모습 재질(tilesetLookGround) — 결 칸의 빛. 없으면 원래 풀밭. */
  readonly ground?: string;
  /** 이 사각형 안에만. */
  readonly area?: Area;
  /** 주면 섞음의 «곁을 따라» 규칙 대신 area 안(둥근 덩이)에 이 결 하나를 깐다 — 조수·사람이 고른 자리. */
  readonly drift?: GrassDrift;
  /** 이벤트가 선 칸에도 깐다(기본은 비운다 — 풀밭 얼룩과 같은 규칙). */
  readonly underEvents?: boolean;
}

export interface BeodeulGrassGrainReport { cells: number; variants: number; drift: number; sprigs: number }

const hash = (x: number, y: number, seed: number): number => {
  let h = Math.imul(x * 73856093 ^ y * 19349663 ^ seed * 83492791, 0x27d4eb2d);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};
const noise = (x: number, y: number, grid: number, seed: number): number => {
  const fx = x / grid, fy = y / grid, x0 = Math.floor(fx), y0 = Math.floor(fy);
  let tx = fx - x0, ty = fy - y0; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  return hash(x0, y0, seed) * (1 - tx) * (1 - ty) + hash(x0 + 1, y0, seed) * tx * (1 - ty) + hash(x0, y0 + 1, seed) * (1 - tx) * ty + hash(x0 + 1, y0 + 1, seed) * tx * ty;
};
const inArea = (area: Area | undefined, x: number, y: number): boolean => !area || (x >= area.x && y >= area.y && x < area.x + area.w && y < area.y + area.h);

/** 풀 결을 걷는다(area 를 주면 그 안만). 걷은 칸 수. 다른 2층 그림(그림자·둑·풀밭 얼룩)은 건드리지 않는다. */
export function clearBeodeulGrassGrain(project: Project, map: GameMap, area?: Area): number {
  const grain = standGrainTile(project.tilesets[map.tilesetId]);
  let n = 0;
  for (let c = 0; c < map.width * map.height; c += 1) {
    if (!inArea(area, c % map.width, Math.floor(c / map.width))) continue;
    if (grain(layerTileAt(map, 2, c))) { setLayerTileAt(map, 2, c, -1); n += 1; }
  }
  return n;
}

/**
 * 풀 결은 풀 바닥의 한 부분이다 — 밑(1층)이 더는 풀밭이 아닌 칸(길·밭 흙·물·모래로 바꿔 쓴 자리)의 결을 걷는다. 걷은 칸 수.
 * 안 걷으면 새 바닥이 풀빛 결 칸(통칸 변형은 불투명하다)에 가려 안 보인다. 도구 실행기가 도구 한 번이 끝날 때마다 바뀐 맵에 부른다.
 */
export function pruneBeodeulGrassGrain(project: Project, map: GameMap): number {
  const over = map.lowerOverlayTiles;
  const ts = project.tilesets[map.tilesetId];
  if (!over || !ts || !tilesetStandTableFor(ts.id)?.grain) return 0;
  const grain = standGrainTile(ts);
  let grafts: Map<number, { sourceChipset: string; sourceTile: number }> | undefined;
  const grassy = (tile: number): boolean => {
    if (tile === GRASS) return true;
    grafts ??= new Map((ts.tileGrafts ?? []).map((g) => [g.targetTile, g] as const));
    const g = grafts.get(tile);
    return !!g && g.sourceChipset === "tex_beodeul_ground" && g.sourceTile === WOODLAND_GRASS;
  };
  let n = 0;
  for (let c = 0; c < over.length; c += 1) if (over[c]! >= 0 && grain(over[c]!) && !grassy(map.lowerTiles[c] ?? -1)) { over[c] = -1; n += 1; }
  return n;
}

/** 그 맵의 타일셋에 적힌(또는 지금 도구가 적을) 겉모습의 풀 결을 깐다 — 다 지은 맵에 마지막으로 부른다. 겉모습에 grain 이 없으면 아무것도 하지 않는다. */
export function layBeodeulGrassGrainForLook(project: Project, mapId: string, seed: number): BeodeulGrassGrainReport {
  const map = project.maps[mapId], ts = map && project.tilesets[map.tilesetId];
  const look = ts ? activeTilesetLook(ts) : undefined;
  if (!map || !ts || !look?.grain) return { cells: 0, variants: 0, drift: 0, sprigs: 0 };
  return layBeodeulGrassGrain(project, map, look.grain, { seed, ground: tilesetLookGround(ts.id, look) });
}

/**
 * 버들항 맵의 열린 풀 바닥에 풀 결을 깐다(섞음 이름 = 겉모습 grain). 2층이 빈 풀 칸에만.
 * 섞음·타일셋이 맞지 않으면 아무것도 하지 않는다.
 */
export function layBeodeulGrassGrain(project: Project, map: GameMap, mixId: string | undefined, options: BeodeulGrassGrainOptions): BeodeulGrassGrainReport {
  const report: BeodeulGrassGrainReport = { cells: 0, variants: 0, drift: 0, sprigs: 0 };
  const ts = project.tilesets[map.tilesetId];
  const table = ts ? tilesetStandTableFor(ts.id) : undefined;
  const mix: GrassGrainMix | undefined = table?.grains?.[mixId ?? ""] ?? (options.drift ? Object.values(table?.grains ?? {})[0] : undefined);
  const family: GrassGrainCells | undefined = table?.grain?.[options.ground ?? "grass"] ?? table?.grain?.grass;
  if (!ts || !table || !mix || !family || ts.image.type !== "bundled" || ts.image.id !== table.image) return report;
  const W = map.width, H = map.height, n = W * H, seed = options.seed | 0, area = options.area;
  const grafts = new Map((ts.tileGrafts ?? []).map((g) => [g.targetTile, g] as const));
  const woodland = (tile: number): boolean => { const g = grafts.get(tile); return !!g && g.sourceChipset === "tex_beodeul_ground" && g.sourceTile === WOODLAND_GRASS; };
  const meta = (ts.tileMeta ?? []) as unknown as ({ tags?: string[] } | undefined)[];
  const tagMemo = new Map<number, number>(); // 0 없음 · 1 나무 · 2 건물·벽·다리 · 3 그 밖의 막힌 물체(울타리·바위·기물) · 4 걸어 넘는 것
  const thing = (tile: number): number => {
    if (tile < 0) return 0;
    let v = tagMemo.get(tile);
    if (v === undefined) {
      const tags = meta[tile]?.tags ?? [], pass = ts.passability[tile];
      v = tags.includes("tree") ? 1 : tags.some((t) => t === "building" || t === "door" || t === "wall" || t === "town_wall" || t === "bridge" || t === "cliff") ? 2
        : pass && !pass.up && !pass.down && !pass.left && !pass.right ? 3 : 4;
      tagMemo.set(tile, v);
    }
    return v;
  };
  const groundTag = (tile: number, ...names: string[]): boolean => tile >= 0 && (meta[tile]?.tags ?? []).some((t) => names.includes(t));
  const ramps = map.relief?.ramps, levels = map.relief?.levels;
  const lv = (c: number): number => levels?.[c] ?? 0;
  const events = new Set(options.underEvents ? [] : map.events.map((e) => e.y * W + e.x));
  // 완성된 집의 자리(보호 영역)는 건드리지 않는다 — 조수가 그 칸을 바꾸면 도구가 통째로 거절된다
  for (const cell of protectedHouseCells(map)) events.add(cell.y * W + cell.x);
  // 1 = 통칸 변형·결까지 깔 수 있는 풀밭(737) · 2 = 풀 무늬만 얹는 숲 장면 잔디(빛이 달라 통칸 변형·결은 깔지 않는다)
  const kind = new Uint8Array(n);
  // 곁: lush 나무·물·울타리·바위·절벽 발치 / worn 길·광장·절벽 위 끝 / home 집
  const lush = new Uint8Array(n), worn = new Uint8Array(n), home = new Uint8Array(n);
  for (let c = 0; c < n; c += 1) {
    const x = c % W, y = (c - x) / W, l1 = layerTileAt(map, 1, c), k3 = thing(layerTileAt(map, 3, c)), k4 = thing(layerTileAt(map, 4, c));
    if (k3 === 1 || k4 === 1 || k3 === 3 || groundTag(l1, "water")) lush[c] = 1;
    if (k3 === 2 || k4 === 2) home[c] = 1;
    if (groundTag(l1, "road", "plaza")) worn[c] = 1;
    if (levels) {
      if (y > 0 && lv(c - W) > lv(c)) lush[c] = 1;          // 절벽 발치(북쪽이 높다 — 벽면 밑)
      if (y + 1 < H && lv(c + W) < lv(c)) worn[c] = 1;      // 절벽 위 끝(남쪽이 낮다)
    }
    if (!inArea(area, x, y) || layerTileAt(map, 2, c) >= 0 || ramps?.[c] || events.has(c) || k3 === 2 || k4 === 2) continue;
    kind[c] = l1 === GRASS ? 1 : woodland(l1) ? 2 : 0;
  }
  /** 씨앗 칸에서 여덟 방향으로 번지는 거리(같은 단 안에서만, cap 칸까지 — 그 너머는 cap + 1). */
  const spread = (src: Uint8Array, cap: number): Uint8Array => {
    const d = new Uint8Array(n).fill(cap + 1); let frontier: number[] = [];
    for (let c = 0; c < n; c += 1) if (src[c]) { d[c] = 0; frontier.push(c); }
    for (let step = 1; step <= cap && frontier.length; step += 1) {
      const next: number[] = [];
      for (const c of frontier) {
        const x = c % W, y = (c - x) / W;
        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx, ny = y + dy; if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const p = ny * W + nx;
          if (d[p]! <= step || (step > 1 && lv(p) !== lv(c))) continue;
          d[p] = step; next.push(p);
        }
      }
      frontier = next;
    }
    return d;
  };
  const reach = Math.max(1, Math.round(mix.reach)), far = reach + 2;
  const deep = new Uint8Array(n), pale = new Uint8Array(n), bloom = new Int32Array(n); // bloom = 그 칸이 든 풀 무늬 무리의 번호(0 = 없음)
  let dLush: Uint8Array | undefined, dWorn: Uint8Array | undefined;
  const drift = options.drift, rim = new Set<number>();
  if (drift && area) {
    // 고른 자리: area 안에 둥근 덩이 하나(가장자리는 물결) — 짙은/옅은 결 또는 풀 무늬 무리
    const cx = area.x + area.w / 2 - 0.5, cy = area.y + area.h / 2 - 0.5, rx = Math.max(0.8, area.w / 2), ry = Math.max(0.8, area.h / 2);
    for (let c = 0; c < n; c += 1) {
      if (!kind[c]) continue;
      const x = c % W, y = (c - x) / W;
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1 + 0.5 * (noise(x, y, 3, seed + 77) - 0.5)) continue;
      if ("tone" in drift) { if (kind[c] === 1) (drift.tone === "deep" ? deep : pale)[c] = 1; } else bloom[c] = 1;
    }
  } else if (!drift) {
    dLush = spread(lush, far); dWorn = spread(worn, far);
    const dHome = spread(home, 2);
    /** 곁을 따라 구간구간 서는 띠: 낮은 물결이 문턱을 넘는 구간에서만, 폭은 한 칸에서 reach 칸까지. */
    const band = (R: Uint8Array, dist: Uint8Array, tone: readonly [number, number], salt: number): void => {
      const [grid, cut] = tone;
      for (let c = 0; c < n; c += 1) {
        if (kind[c] !== 1 || dist[c]! > reach) continue;
        const x = c % W, y = (c - x) / W;
        const s = noise(x + 2 * (noise(x, y, 5, seed + salt + 5) - 0.5), y + 2 * (noise(x, y, 5, seed + salt + 6) - 0.5), grid, seed + salt);
        if (s <= cut) continue;
        const width = 1 + (reach - 1) * Math.min(1, (s - cut) / Math.max(0.05, 0.85 - cut));
        if (dist[c]! <= width + 1.2 * (noise(x, y, 2, seed + salt + 1) - 0.5)) R[c] = 1;
      }
    };
    band(deep, dLush, mix.deep, 301);
    band(pale, dWorn, mix.pale, 401);
    for (let c = 0; c < n; c += 1) if (deep[c]) pale[c] = 0;
    // 풀 무늬는 «무리»로 선다: 성긴 격자의 칸마다 무리 자리 하나(자리는 칸 안에서 흔들린다)를 두고, 그 자리가 나무·물가·울타리·집 곁의 풀밭일 때만 무리가 선다.
    // 무리는 반지름 한두 칸의 둥근 덩이 — 곁을 따라 한 줄로 늘어서지 않고, 무리와 무리 사이는 맨 풀밭이다.
    const [grid, chance] = mix.bloom;
    for (let gy = -1; gy * grid < H + grid; gy += 1) for (let gx = -1; gx * grid < W + grid; gx += 1) {
      if (hash(gx, gy, seed + 501) >= chance) continue;
      const cx = Math.floor(gx * grid + hash(gx, gy, seed + 502) * grid), cy = Math.floor(gy * grid + hash(gx, gy, seed + 503) * grid);
      if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
      const at = cy * W + cx;
      if (!kind[at] || (dLush[at]! > reach + 1 && dHome[at]! > 2)) continue;
      const r = 1.2 + 1.2 * hash(gx, gy, seed + 504), id = 1 + ((gy + 1) * (Math.ceil(W / grid) + 3) + gx + 1);
      for (let y = Math.max(0, Math.floor(cy - r - 1)); y <= Math.min(H - 1, Math.ceil(cy + r + 1)); y += 1) for (let x = Math.max(0, Math.floor(cx - r - 1)); x <= Math.min(W - 1, Math.ceil(cx + r + 1)); x += 1) {
        const c = y * W + x;
        if (!kind[c] || lv(c) !== lv(at)) continue;
        if ((x - cx) ** 2 + ((y - cy) * 1.25) ** 2 <= r * r * (0.8 + 0.5 * hash(x, y, seed + 505))) bloom[c] = id;
      }
    }
  }
  // 언덕 뒤(남쪽이 높은 경계)의 두 줄은 비운다 — 뒤 비탈(relief rim.back)은 그 자리 바닥을 떠서 그늘 비탈을 그리므로, 결이 걸치면 비탈이 옆 풀밭과 어긋난다. 통칸 변형은 빛이 같아 둔다.
  if (levels) for (let c = 0; c < n; c += 1) {
    if (!deep[c] && !pale[c] && !bloom[c]) continue;
    const x = c % W, y = (c - x) / W;
    let back = false;
    for (let dx = -1; dx <= 1 && !back; dx += 1) {
      const nx = x + dx; if (nx < 0 || nx >= W) continue;
      if ((y + 1 < H && lv(c + W + dx) > lv(c)) || (y > 0 && lv(c - W + dx) < lv(c))) back = true;
    }
    if (back) { deep[c] = 0; pale[c] = 0; bloom[c] = 0; rim.add(c); }
  }
  /** 덩이 R 의 칸마다 꼭짓점 비트(북서1·북동2·남서4·남동8) — 꼭짓점은 둘레 네 칸이 모두 R 이고 같은 단일 때만 안. 맵 밖은 가장 가까운 안쪽 칸을 따른다. */
  const cornerMask = (R: Uint8Array, c: number): number => {
    const x = c % W, y = (c - x) / W;
    const corner = (cx: number, cy: number): boolean => {
      let level = -1;
      for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) {
        const p = Math.min(H - 1, Math.max(0, cy + dy)) * W + Math.min(W - 1, Math.max(0, cx + dx));
        if (!R[p]) return false;
        if (level < 0) level = lv(p); else if (lv(p) !== level) return false;
      }
      return true;
    };
    return (corner(x, y) ? 1 : 0) | (corner(x + 1, y) ? 2 : 0) | (corner(x, y + 1) ? 4 : 0) | (corner(x + 1, y + 1) ? 8 : 0);
  };
  const names = (drift && "sprigs" in drift ? drift.sprigs : Object.keys(mix.sprigs)).filter((k) => family.sprigs[k]?.length);
  const weight = (k: string, dry: boolean): number => (drift ? 1 : mix.sprigs[k] ?? 0) * (k === "pebble" ? (dry ? 3 : 0.4) : dry && (k === "white" || k === "yellow" || k === "clover") ? 0.3 : 1);
  /** 무게대로 하나(r 은 0~1). */
  const weighted = (r: number, dry: boolean): string | undefined => {
    let total = 0; for (const k of names) total += weight(k, dry);
    if (total <= 0) return undefined;
    let acc = 0; for (const k of names) { acc += weight(k, dry) / total; if (r < acc) return k; }
    return names[names.length - 1];
  };
  const bloomShare = mix.bloom[2];
  /** 이 칸의 풀 무늬(없으면 undefined): 무리 안은 그 무리의 종류가 대부분, 무리 밖 낱칸은 드물게. */
  const sprigAt = (x: number, y: number, c: number): string | undefined => {
    const dry = !!dWorn && dWorn[c]! <= 1 && !(dLush && dLush[c]! <= 1);
    if (bloom[c]) {
      if (hash(x, y, seed + 21) >= (drift ? 0.6 : bloomShare)) return undefined;
      const own = weighted(hash(bloom[c]!, 7, seed + 23), dry);
      return hash(x, y, seed + 24) < 0.8 ? own : weighted(hash(x, y, seed + 25), dry);
    }
    return !drift && !rim.has(c) && hash(x, y, seed + 26) < mix.single ? weighted(hash(x, y, seed + 27), dry) : undefined;
  };
  const writes: [number, number][] = [], used = new Set<number>();
  const put = (c: number, cell: number | undefined): boolean => { if (cell === undefined || cell <= 0) return false; writes.push([c, cell]); used.add(cell); return true; };
  const pick = <T,>(list: readonly T[], x: number, y: number, salt: number): T | undefined => list[Math.floor(hash(x, y, seed + salt) * list.length)];
  for (let c = 0; c < n; c += 1) {
    if (!kind[c]) continue;
    const x = c % W, y = (c - x) / W, sprig = sprigAt(x, y, c);
    if (kind[c] === 1) {
      const R = deep[c] ? deep : pale[c] ? pale : undefined, tone = R === deep ? family.deep : family.pale;
      const mask = R ? cornerMask(R, c) : 0;
      if (mask === 15) {
        if (put(c, sprig ? pick(tone.sprigs[sprig] ?? [], x, y, 22) : undefined)) report.sprigs += 1;
        else if (put(c, pick(tone.fill, x, y, 13))) report.drift += 1;
        continue;
      }
      if (mask && put(c, (hash(x, y, seed + 31) < 0.5 ? tone.cells : tone.alt)[mask])) { report.drift += 1; continue; }
    }
    if (sprig && put(c, pick(family.sprigs[sprig]!, x, y, 22))) report.sprigs += 1;
    else if (kind[c] === 1 && !drift && hash(x, y, seed + 11) < mix.alt && put(c, pick(family.alt, x, y, 12))) report.variants += 1;
  }
  if (!writes.length) return report;
  const tr = translateTiles(standOverlaySource(table), ts, used);
  for (const [c, cell] of writes) { const to = tr.map.get(cell); if (to !== undefined && to >= 0) { setLayerTileAt(map, 2, c, to); report.cells += 1; } }
  return report;
}

const GRASS_KINDS: Record<string, GrassDrift> = {
  tall: { tone: "deep" }, pale: { tone: "pale" },
  tufts: { sprigs: ["tuft", "tufts"] }, flowers: { sprigs: ["white", "yellow"] }, clover: { sprigs: ["clover"] }, pebbles: { sprigs: ["pebble"] },
};
const GRAIN_MIXES = Object.keys(tilesetStandTableFor("beodeul_city")?.grains ?? {});

/** 조수·사람이 풀 결을 고른 자리에 까는 도구 — 풀밭(737) 위의 2층 덧그림만 쓴다(1층·통행 그대로). */
export const BEODEUL_GRASS_TOOLS: readonly ToolDefinition[] = [{
  name: "lay_beodeul_grass", mode: "write", domains: ["tile", "map"], preservesAuthoredRaster: true,
  description: "버들항 맵의 풀밭(기본 풀 바닥)에 풀 결을 깐다 — 평평한 한 칸 풀밭이 되풀이되지 않게. kind: mix(그 게임의 섞음대로 — 나무 줄·물가·절벽·울타리 곁을 따라 우거진 풀 띠, 길 곁 옅은 결, 풀 포기·들꽃 무리. area 생략 = 맵 전체) · "
    + "tall(우거진 풀 덩이) · pale(옅은 결 덩이) · tufts(풀 포기 무리) · flowers(들꽃 무리) · clover(토끼풀 무리) · pebbles(잔돌) — 이 여섯은 area 안에 둥근 덩이 하나로 깐다(가장자리는 물결) · clear(걷기). "
    + "덩이는 흩뿌리지 말고 무엇인가를 따라 둔다(나무 밑·물가·울타리·집 곁·길가), 그 사이는 맨 풀밭으로 비운다. 풀밭 칸의 2층에만 쓴다 — 1층 칸·물체·이벤트·통행은 그대로이고, 2층에 이미 그림자·둑·얼룩이 있는 칸은 건너뛴다. 결은 게임의 바닥 빛(마른 풀·토끼풀·모래…)에 맞춘 그림으로 깔린다.",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      kind: { type: "string", enum: ["mix", ...Object.keys(GRASS_KINDS), "clear"], description: "깔 결(기본 mix)" },
      area: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer" }, h: { type: "integer" } }, required: ["x", "y", "w", "h"], description: "칸 사각형. tall·pale·tufts·flowers·clover·pebbles 에는 꼭 준다(덩이 하나 = 3×2~8×5칸)" },
      mix: { type: "string", enum: GRAIN_MIXES, description: "kind mix 의 섞음(생략 = 그 게임의 섞음)" },
      seed: { type: "integer" },
    },
    required: ["mapId"], additionalProperties: false,
  },
  run(project, args) {
    const mapId = String(args.mapId), map = project.maps[mapId], ts = map && project.tilesets[map.tilesetId];
    const table = ts ? tilesetStandTableFor(ts.id) : undefined;
    if (!map || !ts) throw new ToolError(`맵 ${mapId} 가 없습니다.`, { code: "map-not-found", mapId });
    if (!table?.grain || ts.image.type !== "bundled" || ts.image.id !== table.image) throw new ToolError("버들항(beodeul_city) 맵만 지원합니다 — 다른 칩셋의 바닥은 fill_region 재료로 칠하세요.", { code: "unsupported-tileset", mapId });
    const kind = args.kind === undefined ? "mix" : String(args.kind);
    const raw = args.area as Record<string, unknown> | undefined;
    const area = raw ? { x: Math.floor(Number(raw.x)), y: Math.floor(Number(raw.y)), w: Math.floor(Number(raw.w)), h: Math.floor(Number(raw.h)) } : undefined;
    if (area && !(area.w > 0 && area.h > 0 && area.x < map.width && area.y < map.height && area.x + area.w > 0 && area.y + area.h > 0)) throw new ToolError(`area 가 맵(${map.width}×${map.height}) 밖입니다.`, { code: "out-of-bounds", mapId });
    const look = activeTilesetLook(ts), ground = tilesetLookGround(ts.id, look);
    const seed = Number.isFinite(Number(args.seed)) ? Math.floor(Number(args.seed)) : (map.width * 131 + map.height * 17 + (area ? area.x * 7 + area.y * 13 : 0)) | 0;
    const cleared = clearBeodeulGrassGrain(project, map, area);
    if (kind === "clear") return { summary: `풀 결 ${cleared}칸을 걷었습니다.`, data: { mapId, cleared } };
    const drift = GRASS_KINDS[kind];
    if (kind !== "mix" && !drift) throw new ToolError(`kind 는 mix·${Object.keys(GRASS_KINDS).join("·")}·clear 중 하나입니다(받은 값: ${kind}).`, { code: "invalid-args", mapId });
    if (drift && !area) throw new ToolError(`kind ${kind} 는 area{x,y,w,h} 가 필요합니다 — 덩이 하나를 둘 자리(나무 밑·물가·울타리·집 곁)를 주세요. 맵 전체는 kind:"mix".`, { code: "invalid-args", mapId });
    const mixId = typeof args.mix === "string" && table.grains?.[args.mix] ? args.mix : look?.grain ?? GRAIN_MIXES[lookSeed(map.id) % Math.max(1, GRAIN_MIXES.length)];
    const report = layBeodeulGrassGrain(project, map, mixId, { seed, ...(ground ? { ground } : {}), ...(area ? { area } : {}), ...(drift ? { drift } : {}) });
    if (!report.cells) throw new ToolError(`그 자리에 깔 수 있는 풀밭 칸이 없습니다 — 기본 풀 바닥(버들항 풀밭)이고 2층·건물이 없는 칸에만 깝니다${area ? `(area ${area.x},${area.y} ${area.w}×${area.h})` : ""}.`, { code: "no-open-grass", mapId });
    const label = kind === "mix" ? `섞음 「${table.grains?.[mixId ?? ""]?.label ?? mixId}」` : `${table.grainLabels?.[drift && "tone" in drift ? drift.tone : (drift as { sprigs: readonly string[] }).sprigs[0]!] ?? kind} 덩이`;
    return {
      summary: `버들항 풀 결 ${report.cells}칸: ${label}${area ? ` · (${area.x},${area.y}) ${area.w}×${area.h}` : " · 맵 전체"} — 결 ${report.drift} · 풀 무늬 ${report.sprigs} · 잔풀 ${report.variants}. 1층 칸·통행은 그대로입니다.`,
      data: { mapId, kind, ...(kind === "mix" ? { mix: mixId } : {}), ...(area ? { area } : {}), ...report, cleared },
    };
  },
}];
const lookSeed = (text: string): number => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
