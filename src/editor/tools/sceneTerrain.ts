// build_scene_setting 의 바닥·기물 붓 — 버들항 맵에 선사(prehistoric)·고딕(gothic_manor) 묶음의 그림을 이식(graft)해 칠한다.
// 왜(2026-10-18 파일럿 4건 FAIL): 버들항 칩셋만으로는 화산이 «갈색 흙 + 마을 집», 독늪이 «신전 대리석 판석» 으로 읽혔다.
// 선사 묶음에는 화산재→굳은 용암→용암, 진흙→늪 물 의 꼭짓점(wang) 가장자리 칸이 있어 몸체 윤곽이 둥글게 이어진다.
import type { GameMap, Project, StructureKitDef, TilesetDef } from "@/project/types";
import { createPrehistoricTileset } from "@/project/defaults/prehistoric";
import { createGothicManorTileset } from "@/project/defaults/gothicManor";
import { setLayerTileAt } from "@/project/mapLayers";
import { stampPattern, translateTiles } from "@/project/objectStamp";

/** 그림을 빌려 오는 묶음 — bd 는 맵 자기 칩셋(버들항). */
export type ArtSource = "bd" | "ph" | "gm";

const FOREIGN: Record<Exclude<ArtSource, "bd">, () => TilesetDef> = { ph: createPrehistoricTileset, gm: createGothicManorTileset };
const foreignCache = new Map<ArtSource, TilesetDef>();

/** 칸 좌표에서 0..1 결정적 잡음 — 같은 입력이면 항상 같은 그림이라 재현·측정이 된다. */
export function hash01(a: number, b: number, seed: number): number {
  let h = (Math.imul(a + 374761393, 668265263) ^ Math.imul(b + 1274126177, 2246822519) ^ Math.imul(seed + 3266489917, 3266489917)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 부드러운 값 잡음(0..1) — scale 칸 격자의 해시를 매끄럽게 잇는다. 덩이 윤곽용. */
export function smoothNoise(x: number, y: number, seed: number, scale: number): number {
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const s = (t: number) => t * t * (3 - 2 * t);
  const tx = s(fx - x0), ty = s(fy - y0);
  const a = hash01(x0, y0, seed), b = hash01(x0 + 1, y0, seed), c = hash01(x0, y0 + 1, seed), d = hash01(x0 + 1, y0 + 1, seed);
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

/** 점에서 꺾은선까지 거리 — 굽이치는 강의 중심선. */
export function distToPolyline(px: number, py: number, pts: readonly (readonly [number, number])[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i]!, [bx, by] = pts[i + 1]!;
    const vx = bx - ax, vy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)));
    best = Math.min(best, Math.hypot(px - ax - t * vx, py - ay - t * vy));
  }
  return best;
}

export type Cell = { x: number; y: number };

/**
 * 한 맵에 칠하는 붓. 다른 묶음의 칸·키트는 translateTiles 로 맵 칩셋에 이식하고(같은 그림은 한 번만), 기물 자리는
 * occupied·blocked 로 겹침을 막는다. 못 들어간 기물은 조용히 빼고 dropped 로 센다.
 */
export class ScenePainter {
  readonly occupied = new Set<number>();
  /** 기물을 얹지 않는 칸(이벤트·시작·걷기 길·동선). */
  readonly reserved = new Set<number>();
  stamped = 0;
  dropped = 0;
  private readonly memo = new Map<string, number>();

  constructor(readonly project: Project, readonly map: GameMap) {}

  private source(src: ArtSource): TilesetDef {
    if (src === "bd") return this.project.tilesets[this.map.tilesetId]!;
    let t = foreignCache.get(src);
    if (!t) foreignCache.set(src, (t = FOREIGN[src]()));
    return t;
  }

  idx(cx: number, cy: number): number { return cy * this.map.width + cx; }
  inside(cx: number, cy: number): boolean { return cx >= 0 && cy >= 0 && cx < this.map.width && cy < this.map.height; }

  /** 묶음의 타일 그룹 k 번째 칸 → 이 맵 칩셋의 칸 번호(필요하면 이식). */
  tile(src: ArtSource, group: string, k = 0): number {
    const key = `${src}|${group}|${k}`;
    const hit = this.memo.get(key);
    if (hit !== undefined) return hit;
    const source = this.source(src);
    const ids = source.tileGroups?.find((g) => g.id === group)?.tileIds ?? [];
    const raw = ids[Math.min(k, ids.length - 1)];
    if (raw === undefined) throw new Error(`${src} 묶음에 타일 그룹 ${group} 이 없습니다`);
    const out = src === "bd" ? raw : translateTiles(source, this.project.tilesets[this.map.tilesetId]!, [raw]).map.get(raw)!;
    this.memo.set(key, out);
    return out;
  }

  /** 하단 층 칸 하나를 칠하고 그 칸의 덧그림·상단을 걷는다. */
  ground(cx: number, cy: number, tile: number): void {
    if (!this.inside(cx, cy)) return;
    const i = this.idx(cx, cy);
    setLayerTileAt(this.map, 1, i, tile);
    setLayerTileAt(this.map, 2, i, -1);
    setLayerTileAt(this.map, 3, i, -1);
  }

  blocked(cx: number, cy: number): boolean {
    const t = this.map.lowerTiles[this.idx(cx, cy)] ?? -1;
    const pass = this.project.tilesets[this.map.tilesetId]!.passability[t];
    return !!pass && !pass.up && !pass.down && !pass.left && !pass.right;
  }

  kitDef(src: ArtSource, id: string): StructureKitDef | undefined {
    return this.source(src).structureKits?.find((k) => k.id === id);
  }

  /**
   * 키트를 (px,py) 왼쪽 위에 찍는다. onGround: 막힌 바닥(물·용암·벽) 위에 서도 되는지. floor: 바닥 그림(다리·모자이크·계단)은
   * 예약 칸(동선) 위에도 깔리고 occupied 에 넣지 않는다. 겹치거나 맵 밖이면 찍지 않고 false.
   */
  kit(src: ArtSource, id: string, px: number, py: number, opts: { floor?: boolean; overBlocked?: boolean; upperOnly?: boolean } = {}): boolean {
    const kit = this.kitDef(src, id);
    if (!kit) { this.dropped++; return false; }
    if (px < 0 || py < 0 || px + kit.width > this.map.width || py + kit.height > this.map.height) { this.dropped++; return false; }
    for (let cy = py; cy < py + kit.height; cy++) {
      for (let cx = px; cx < px + kit.width; cx++) {
        const i = this.idx(cx, cy);
        if (this.occupied.has(i) || (!opts.floor && this.reserved.has(i)) || (!opts.overBlocked && !opts.floor && this.blocked(cx, cy))) { this.dropped++; return false; }
      }
    }
    const lower = kit.rows.flatMap((r) => [...r.tiles]);
    const upper = kit.rows.flatMap((r) => [...(r.upperTiles ?? new Array(kit.width).fill(-1))]);
    stampPattern(this.project, this.map, this.source(src), { width: kit.width, height: kit.height, lower: opts.upperOnly ? lower.map(() => -1) : lower, upper }, px, py);
    if (!opts.floor) for (let cy = py; cy < py + kit.height; cy++) for (let cx = px; cx < px + kit.width; cx++) this.occupied.add(this.idx(cx, cy));
    this.stamped++;
    return true;
  }

  /** 세로줄 axisX 기준 좌우 한 쌍 — 두 짝이 다 들어갈 때만 찍는다(px 는 왼쪽 짝). */
  mirrorX(src: ArtSource, id: string, px: number, py: number, axisX: number, opts?: Parameters<ScenePainter["kit"]>[4]): boolean {
    const kit = this.kitDef(src, id);
    if (!kit) return false;
    const twin = Math.round(2 * axisX - px - kit.width + 1);
    if (!this.fits(kit, px, py, opts) || !this.fits(kit, twin, py, opts)) { this.dropped += 2; return false; }
    return this.kit(src, id, px, py, opts) && this.kit(src, id, twin, py, opts);
  }

  /** (px,py) 에 안 들어가면 반경 r 안에서 가까운 순으로 들어가는 자리를 찾아 찍는다 — 몸체 윤곽이 잡음으로 흔들려도 기물이 빠지지 않게. */
  kitNear(src: ArtSource, id: string, px: number, py: number, r = 3, opts?: Parameters<ScenePainter["kit"]>[4]): boolean {
    const kit = this.kitDef(src, id);
    if (!kit) { this.dropped++; return false; }
    const offsets: [number, number][] = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) offsets.push([dx, dy]);
    offsets.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
    for (const [dx, dy] of offsets) if (this.fits(kit, px + dx, py + dy, opts)) return this.kit(src, id, px + dx, py + dy, opts);
    this.dropped++;
    return false;
  }

  private fits(kit: StructureKitDef, px: number, py: number, opts: Parameters<ScenePainter["kit"]>[4] = {}): boolean {
    if (px < 0 || py < 0 || px + kit.width > this.map.width || py + kit.height > this.map.height) return false;
    for (let cy = py; cy < py + kit.height; cy++) for (let cx = px; cx < px + kit.width; cx++) {
      const i = this.idx(cx, cy);
      if (this.occupied.has(i) || (!opts.floor && this.reserved.has(i)) || (!opts.overBlocked && !opts.floor && this.blocked(cx, cy))) return false;
    }
    return true;
  }
}

/**
 * 꼭짓점 단(level) 지형 — 선사 묶음의 사슬(예: 흙0 → 화산재1 → 굳은 용암2 → 용암3)을 칸 네 꼭짓점의 단으로 칠한다.
 * 이웃 꼭짓점 단 차가 1을 넘으면 낮은 쪽을 올려(raise) 몸체 둘레에 중간 단 띠(용암 둘레 굳은 용암 둑)가 저절로 생긴다.
 * 칸의 네 꼭짓점이 같으면 그 단의 바닥, 다르면 높은 단의 가장자리 칸 w-{높은 단}-{NW NE SW SE 중 높은 꼭짓점 1}.
 * variants: 단 바닥마다 큰 덩이 잡음으로 섞을 변주 그룹(화산재 ↔ 화산재 변주).
 */
export function paintLevels(p: ScenePainter, rect: { x: number; y: number; w: number; h: number }, chain: readonly string[], level: (vx: number, vy: number) => number,
  variants: Readonly<Record<string, string>> = {}): number[] {
  const W = rect.w + 1, H = rect.h + 1;
  const lv = new Array<number>(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) lv[j * W + i] = Math.max(0, Math.min(chain.length - 1, Math.round(level(rect.x + i, rect.y + j))));
  for (let changed = true, guard = 0; changed && guard < 8; guard++) {
    changed = false;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      let m = lv[j * W + i]!;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        m = Math.max(m, lv[nj * W + ni]! - 1);
      }
      if (m !== lv[j * W + i]) { lv[j * W + i] = m; changed = true; }
    }
  }
  const cellLevel: number[] = [];
  for (let cy = rect.y; cy < rect.y + rect.h; cy++) {
    for (let cx = rect.x; cx < rect.x + rect.w; cx++) {
      const i = cx - rect.x, j = cy - rect.y;
      const cs = [lv[j * W + i]!, lv[j * W + i + 1]!, lv[(j + 1) * W + i]!, lv[(j + 1) * W + i + 1]!];
      const mx = Math.max(...cs), mn = Math.min(...cs);
      cellLevel.push(mn === mx ? mx : mx - 0.5);
      if (mn === mx) {
        const name = chain[mx]!;
        const alt = variants[name];
        const useAlt = alt !== undefined && smoothNoise(cx, cy, 31 + mx, 3) > 0.55;
        p.ground(cx, cy, p.tile("ph", `ph:ph-${useAlt ? alt : name}`, name === "lava" || name === "swamp" ? Math.floor(hash01(cx, cy, 5) * 3) : 0));
      } else {
        p.ground(cx, cy, p.tile("ph", `ph:ph-w-${chain[mx]}-${cs.map((v) => (v === mx ? "1" : "0")).join("")}`));
      }
    }
  }
  return cellLevel;
}
