// 하늘섬·증기 도시(sky_steam) 맵 구성기 — 맵 한 장을 «계획 → 덩이(건물·갑판·섬) → 소품» 순서로 규칙에 따라 짠다. 견본을 붙이지 않는다.
// 같은 (종류, 크기, 씨앗) = 같은 맵. 칸 번호는 타일셋(번들 sky_steam)의 조립 부품·오토타일·채움 그룹에서만 읽는다 — 번호를 박지 않는다.
// 규칙은 적대적 시각 QA 1회(scripts/content/sky-steam/qa_defects.json)에서 나온 것이다:
//   · 땅은 한 재질(기본 변형 + 7칸에 하나 꼴 다른 변형, 바둑판 금지). 띠 전체를 같은 바닥으로 덮고 비워 두지 않는다 — 건물 줄을 맵 끝에 붙인다.
//   · 건물 맨 아래 줄(막힘) 바로 아래 줄 = 문 앞 접근칸. 건물 사이 1~2칸 여유(겹침 금지). 가스등·소품은 문 앞 칸을 피한다.
//   · 관 끝은 건물 발 줄에서, 마차는 동서 차도에 세우지 않는다, 소품은 무리로, 줄 A 건물은 섬 풀 위에만(줄 B 건물과 떨어뜨림).
// 마지막에 구조 검사(scripts/content/sky-steam/sky_check.py 와 같은 코드)를 돌려 통과한 배치만 돌려준다.
import type { StructureKitDef, TilesetDef } from "./types";

export type SkySteamKind = "street" | "yard" | "dock" | "island" | "workshop" | "boiler" | "inn";
export const SKY_STEAM_KINDS: readonly SkySteamKind[] = ["street", "yard", "dock", "island", "workshop", "boiler", "inn"];
export const SKY_STEAM_MIN_SIZE: Readonly<Record<SkySteamKind, { w: number; h: number }>> = {
  street: { w: 32, h: 20 }, yard: { w: 34, h: 22 }, dock: { w: 34, h: 20 }, island: { w: 28, h: 16 },
  workshop: { w: 14, h: 10 }, boiler: { w: 16, h: 11 }, inn: { w: 16, h: 11 },
};
export const SKY_STEAM_DEFAULT_SIZE: Readonly<Record<SkySteamKind, { w: number; h: number }>> = {
  street: { w: 44, h: 24 }, yard: { w: 44, h: 22 }, dock: { w: 40, h: 20 }, island: { w: 40, h: 20 },
  workshop: { w: 20, h: 13 }, boiler: { w: 22, h: 15 }, inn: { w: 22, h: 15 },
};
export const SKY_STEAM_KIND_LABEL: Readonly<Record<SkySteamKind, string>> = {
  street: "증기 도시 거리", yard: "공장 마당", dock: "비공정 부두", island: "하늘섬 마을", workshop: "공방", boiler: "보일러실", inn: "여관",
};

export interface Placed { readonly kit: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export interface SkySteamIssue { readonly code: string; readonly x: number; readonly y: number; readonly message: string }
export interface SkySteamPlan {
  readonly kind: SkySteamKind; readonly width: number; readonly height: number; readonly seed: number;
  readonly lower: number[]; readonly upper: number[];
  readonly placed: readonly Placed[];
  /** 건물 문 앞 칸(건물 바로 아래 줄에서 걷는 가운데 칸) — 실내 잇기·이벤트 자리. */
  readonly doors: readonly { kit: string; x: number; y: number }[];
  readonly issues: readonly SkySteamIssue[];
  readonly summary: string;
}

function mulberry(a: number): () => number {
  let s = a >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FLYING = new Set(["sky-a-airship", "sky-a-airship-anim", "sky-a-hot-air-balloon", "sky-a-cloud-puff", "sky-a-cloud-mist", "sky-a-steam-cloud", "steam-smoke-anim",
  "sky-a-island-s", "sky-a-island-m", "sky-a-rock-root", "sky-a-bridge", "sky-a-whale-pier", "sky-a-gondola", "steam-dock-deck", "sky-a-harbor"]);
/** 문 앞 접근칸을 따지지 않는 structure(탈것·기중기·계류탑). */
const NO_DOOR = new Set(["steam-mooring-mast", "steam-dock-crane", "steam-tram", "steam-locomotive", "steam-carriage", "steam-kiosk"]);

class Canvas {
  readonly lower: number[]; readonly upper: number[]; readonly placed: Placed[] = [];
  constructor(readonly t: TilesetDef, readonly w: number, readonly h: number) {
    this.lower = new Array<number>(w * h).fill(-1); this.upper = new Array<number>(w * h).fill(-1);
  }
  kitDef(id: string): StructureKitDef {
    const k = this.t.structureKits?.find((kit) => kit.id === id);
    if (!k) throw new Error(`sky_steam 조립 부품 ${id} 이(가) 이 타일셋에 없다 — 프로젝트를 다시 열어 번들 타일셋을 갱신한다`);
    return k;
  }
  size(id: string): { w: number; h: number } { const k = this.kitDef(id); return { w: k.width, h: k.height }; }
  /** 채움 그룹(sky:fill:<조각>) — 기본 변형 + every 칸에 하나 꼴 다른 변형. */
  fill(piece: string, x0: number, y0: number, w: number, h: number, every = 7, main = 0, alt?: number): void {
    const g = this.t.tileGroups?.find((group) => group.id === `sky:fill:${piece}`);
    if (!g || !g.tileIds.length) throw new Error(`sky_steam 채움 그룹 sky:fill:${piece} 이 없다`);
    const ids = g.tileIds;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
      // alt 가 있으면 그 한 변형만 섞는다(나무 마루에 강판·체크 무늬가 끼지 않게 — 재질이 다른 변형은 섞지 않는다)
      const other = alt !== undefined ? ids[alt % ids.length]! : ids[(main + 1 + ((x + y) % Math.max(1, ids.length - 1))) % ids.length]!;
      const t = (x * 5 + y * 3) % every ? ids[main % ids.length]! : other;
      (this.home(t) === "lower" ? this.lower : this.upper)[y * this.w + x] = t;
    }
  }
  /** 오토타일(4방/8방) — 칸 집합 안의 이웃만 이어진 것으로, 맵 밖은 이어진 것으로 본다. */
  auto(id: string, cells: Iterable<readonly [number, number]>): void {
    const a = this.t.autotileGroups?.find((group) => group.id === id);
    if (!a) throw new Error(`sky_steam 오토타일 ${id} 이 없다`);
    const set = new Set<string>(); const list: [number, number][] = [];
    for (const [x, y] of cells) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) { set.add(`${x},${y}`); list.push([x, y]); } }
    const dirs: [number, number, number][] = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]];
    if (a.neighborhood === 8) dirs.push([1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128]);
    const layer = (a as { layer?: string }).layer === "upper" ? this.upper : this.lower;
    for (const [x, y] of list) {
      let m = 0;
      for (const [dx, dy, b] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (set.has(`${nx},${ny}`) || nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) m |= b;
      }
      const t = a.variantMap[String(m)];
      if (t !== undefined) layer[y * this.w + x] = t;
    }
  }
  kit(id: string, x0: number, y0: number): Placed {
    const k = this.kitDef(id);
    for (let y = 0; y < k.height; y++) {
      const row = k.rows[y]!;
      for (let x = 0; x < k.width; x++) {
        const X = x0 + x, Y = y0 + y;
        if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) continue;
        const lo = row.tiles[x] ?? -1, up = row.upperTiles?.[x] ?? -1;
        if (lo >= 0) this.lower[Y * this.w + X] = lo;
        if (up >= 0) this.upper[Y * this.w + X] = up;
      }
    }
    const p = { kit: id, x: x0, y: y0, w: k.width, h: k.height };
    this.placed.push(p);
    return p;
  }
  home(t: number): "lower" | "upper" {
    const m = this.t.tileMeta?.[t] as { locked?: boolean; defaultLayer?: string } | undefined;
    if (m?.locked && (m.defaultLayer === "lower" || m.defaultLayer === "upper")) return m.defaultLayer;
    return this.t.priority[t] === "upper" ? "upper" : "lower";
  }
  walkable(i: number): boolean {
    const u = this.upper[i]!;
    if (u >= 0) {
      const p = (this.t.tileMeta?.[u] as { passage?: string } | undefined)?.passage ?? (this.t.passability[u]?.up ? "passable" : "solid");
      if (p === "solid") return false;
      if (p === "passable") return true;
    }
    const lo = this.lower[i]!;
    return lo >= 0 && !!this.t.passability[lo]?.up;
  }
  /** 이 사각형이 이미 놓은 키트와 겹치는가(여유 margin 칸 포함). */
  free(x0: number, y0: number, w: number, h: number, margin = 0): boolean {
    if (x0 < 0 || y0 < 0 || x0 + w > this.w || y0 + h > this.h) return false;
    return this.placed.every((p) => x0 + w + margin <= p.x || p.x + p.w + margin <= x0 || y0 + h + margin <= p.y || p.y + p.h + margin <= y0);
  }
}

const isStructure = (k: StructureKitDef): boolean => ((k.ai?.tags as string[] | undefined) ?? []).includes("structure");

/** sky_check.py 와 같은 구조 검사. connect 가 주어지면 그 키트 id 들의 문 앞끼리만 이어졌는지 본다. */
export function checkSkySteam(c: Canvas, connect?: ReadonlySet<string>): { issues: SkySteamIssue[]; doors: { kit: string; x: number; y: number }[] } {
  const issues: SkySteamIssue[] = []; const W = c.w, H = c.h;
  const cloudGroup = c.t.tileGroups?.find((g) => g.id === "sky:fill:sky-a-cloud-sea");
  const cloud = new Set(cloudGroup?.tileIds ?? []);
  c.lower.forEach((t, i) => { if (t >= 0 && c.home(t) === "upper") issues.push({ code: "SKY-LAYER", x: i % W, y: Math.floor(i / W), message: `아래층에 위층 홈 칸 ${t}` }); });
  c.upper.forEach((t, i) => { if (t >= 0 && c.home(t) === "lower") issues.push({ code: "SKY-LAYER", x: i % W, y: Math.floor(i / W), message: `위층에 아래층 홈 칸 ${t}` }); });
  const fronts: { kit: string; x: number; y: number }[] = [];
  for (const p of c.placed) {
    if (p.x < 0 || p.y < 0 || p.x + p.w > W || p.y + p.h > H) issues.push({ code: "SKY-KIT-CUT", x: p.x, y: p.y, message: `${p.kit} 가 맵 밖으로 잘림` });
    if (FLYING.has(p.kit) || p.kit.startsWith("steam-wall") || p.kit.startsWith("steam-at-")) continue;
    const k = c.kitDef(p.kit);
    const y = k.height - 1, Y = p.y + y;
    for (let x = 0; x < k.width; x++) {
      const X = p.x + x; const row = k.rows[y]!;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      if ((row.tiles[x] ?? -1) >= 0 || (row.upperTiles?.[x] ?? -1) < 0) continue;
      const lo = c.lower[Y * W + X]!;
      if (lo < 0 || cloud.has(lo)) issues.push({ code: "SKY-NO-GROUND", x: X, y: Y, message: `${p.kit} 밑이 ${lo < 0 ? "빈 칸" : "구름"}` });
    }
    if (isStructure(k) && !NO_DOOR.has(p.kit) && !((k.ai?.tags as string[] | undefined) ?? []).includes("vehicle")) {
      const fy = p.y + p.h; const ok: [number, number][] = [];
      for (let x = p.x; x < p.x + p.w; x++) if (x >= 0 && x < W && fy < H && c.walkable(fy * W + x)) ok.push([x, fy]);
      if (!ok.length) issues.push({ code: "SKY-DOOR-BLOCKED", x: p.x, y: fy, message: `${p.kit} 문 앞 줄(y=${fy})에 걷는 칸 없음` });
      else { const mid = ok[Math.floor(ok.length / 2)]!; fronts.push({ kit: p.kit, x: mid[0], y: mid[1] }); }
    }
  }
  const want = fronts.filter((f) => !connect || connect.has(f.kit));
  if (want.length > 1) {
    const seen = new Set<number>([want[0]!.y * W + want[0]!.x]); const q = [want[0]!.y * W + want[0]!.x];
    while (q.length) {
      const i = q.shift()!; const x = i % W, y = Math.floor(i / W);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        const j = ny * W + nx;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && !seen.has(j) && c.walkable(j)) { seen.add(j); q.push(j); }
      }
    }
    for (const f of want.slice(1)) if (!seen.has(f.y * W + f.x)) issues.push({ code: "SKY-UNREACHABLE", x: f.x, y: f.y, message: `${f.kit} 문 앞 (${f.x},${f.y}) 가 (${want[0]!.x},${want[0]!.y}) 와 안 이어짐` });
  }
  return { issues, doors: fronts };
}

function pick<T>(r: () => number, xs: readonly T[]): T { return xs[Math.floor(r() * xs.length)]!; }
function shuffle<T>(r: () => number, xs: readonly T[]): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; }

/** 한 줄로 건물을 왼→오 채운다(사이 1~2칸). 반환 [놓을 키트, x] 와 줄의 최대 높이. */
function packRow(c: Canvas, r: () => number, pool: readonly string[], x0: number, x1: number, maxH: number): { kits: [string, number][]; tallest: number } {
  const out: [string, number][] = []; let x = x0; let tallest = 0; let guard = 0;
  const order = shuffle(r, pool);
  let i = 0;
  while (guard++ < 60) {
    const fits = order.filter((id) => { const s = c.size(id); return s.h <= maxH && x + s.w <= x1; });
    if (!fits.length) break;
    const id = fits[i++ % fits.length]!;
    const s = c.size(id);
    out.push([id, x]); tallest = Math.max(tallest, s.h);
    x += s.w + 1 + (r() < 0.45 ? 1 : 0);
  }
  return { kits: out, tallest };
}

function composeStreet(c: Canvas, r: () => number): string {
  const W = c.w, H = c.h;
  c.fill("steam-t-flag", 0, 0, W, H);
  const back = ["steam-tenement", "steam-inn", "steam-workshop", "steam-clocktower", "steam-lab", "steam-geartower", "steam-warehouse", "steam-tenement", "steam-inn", "steam-boilerhouse"];
  const roadH = H >= 22 ? 6 : 5;
  const maxBack = Math.min(9, H - roadH - 3 - 6);              // 앞줄 건물(높이 6까지)이 들어갈 자리를 남긴다 — 남쪽에 빈 띠를 두지 않는다
  const row = packRow(c, r, back, 1, W - 1, maxBack);
  const doorRow = row.tallest;                                   // 건물 줄을 맵 북쪽 끝에 붙인다(가장 높은 건물이 y=0)
  const gaps: number[] = [];
  let prevEnd = 0;
  for (const [id, x] of row.kits) {
    const s = c.size(id); c.kit(id, x, doorRow - s.h);
    for (let gx = prevEnd; gx < x; gx++) gaps.push(gx);
    prevEnd = x + s.w;
    if (doorRow - s.h >= 3 && s.w >= 2 && r() < 0.6) c.kit("steam-soot-tree", x + Math.floor((s.w - 2) * r()), doorRow - s.h - 3);   // 낮은 건물 뒤 빈 판석 대신 나무
  }
  for (let gx = prevEnd; gx < W; gx++) gaps.push(gx);
  const roadY = doorRow + 1;
  const road: [number, number][] = [];
  for (let y = roadY; y < roadY + roadH; y++) for (let x = 0; x < W; x++) road.push([x, y]);
  c.auto("steam-at-cobble", road);
  const tram = W >= 36 || r() < 0.5;
  const railY = roadY + Math.floor(roadH / 2) - 1;
  if (tram) {
    const rail: [number, number][] = []; for (let x = 0; x < W; x++) rail.push([x, railY]);
    c.auto("steam-at-tramrail", rail);
    c.kit("steam-tram", 2 + Math.floor(r() * Math.max(1, W - 9)), railY - 2);
  }
  // 가로등: 뒷줄 건물 사이 틈(문 앞 아님) 6~9칸 간격
  let last = -99, lamps = 0;
  for (const gx of gaps) if (gx - last >= 6 && gx > 0 && gx < W - 1 && doorRow - 2 >= 0) { c.kit("steam-gaslamp-tall-lit", gx, doorRow - 2); last = gx; lamps++; }
  // 앞줄: 차도 아래 보도 한 줄 + 건물(문 앞 = 맵 맨 아래 줄)
  const frontTop = roadY + roadH + 1, frontAvail = H - 1 - frontTop;
  let front = 0;
  if (frontAvail >= 4) {
    const fr = packRow(c, r, ["steam-pumphouse", "steam-workshop", "steam-station", "steam-boilerhouse", "steam-kiosk", "steam-warehouse"], 2, W - 2, frontAvail);
    for (const [id, x] of fr.kits) { const s = c.size(id); c.kit(id, x, H - 1 - s.h); front++; }
  }
  // 보도 소품(무리): 문 앞 칸을 피해 틈에
  const props = ["steam-pillarbox", "steam-street-clock", "steam-bench", "steam-bollard", "steam-valve-post"];
  let placedProps = 0;
  for (const gx of gaps) {
    if (placedProps >= Math.floor(W / 9)) break;
    const id = pick(r, props); const s = c.size(id);
    const y = doorRow - s.h + 1;
    if (y >= 0 && c.free(gx, y, s.w, s.h) && gaps.includes(gx + s.w - 1)) { c.kit(id, gx, y); placedProps++; }
  }
  // 앞 보도 줄 가로등(차도 남쪽 연석)
  // 차도 남쪽 연석 가스등: 밑동은 차도 아래 보도 줄, 등머리는 차도 위로 걸친다(위층 덧그림이라 차도는 걷는다)
  for (let x = 4 + Math.floor(r() * 4); x < W - 2; x += 9) if (c.free(x, roadY + roadH - 2, 1, 3)) c.kit("steam-gaslamp-tall", x, roadY + roadH - 2);
  return `뒷줄 건물 ${row.kits.length}채·앞줄 ${front}채·차도 ${roadH}줄${tram ? "·전차 선로" : ""}·가스등 ${lamps}+·보도 소품 ${placedProps}`;
}

function composeYard(c: Canvas, r: () => number): string {
  const W = c.w, H = c.h;
  c.fill("steam-t-yard", 0, 0, W, H);
  const pool = ["steam-factory-hall", "steam-boilerhouse", "steam-gasholder", "steam-foundry", "steam-watertower", "steam-warehouse", "steam-pumphouse", "steam-boilerhouse"];
  const row = packRow(c, r, pool, 1, W - 1, Math.min(8, H - 14));
  const doorRow = row.tallest;                                   // 건물 줄을 북쪽 끝에(가장 높은 건물이 y=0)
  const placedB: Placed[] = [];
  for (const [id, x] of row.kits) { const s = c.size(id); placedB.push(c.kit(id, x, doorRow - s.h)); }
  // 굴뚝 + 연기: 건물 사이 2칸 이상 틈 하나
  let chimney = false;
  for (let i = 0; i + 1 < placedB.length && !chimney; i++) {
    const a = placedB[i]!, b = placedB[i + 1]!;
    if (b.x - (a.x + a.w) >= 2 && doorRow - 8 >= 0) { c.kit("steam-chimney-tall", a.x + a.w, doorRow - 8); c.kit("steam-smoke-anim", a.x + a.w, Math.max(0, doorRow - 9)); chimney = true; }
  }
  // 관(QA Y2): 이웃 건물의 발 밑을 잇는다 — 끝은 두 건물 모서리 칸 밑(문 앞 가운데 칸은 남는다)
  let pipes = 0;
  for (let i = 0; i + 1 < placedB.length && pipes < 2; i++) {
    const a = placedB[i]!, b = placedB[i + 1]!;
    if (r() < 0.6 && a.w >= 3 && b.w >= 3) {
      const cells: [number, number][] = []; for (let x = a.x + a.w - 1; x <= b.x; x++) cells.push([x, doorRow]);
      c.auto("steam-at-pipe", cells); pipes++;
    }
  }
  // 벽 앞 소품 무리(QA Y4): 건물 오른쪽 틈 바로 아래(문 앞 줄 다음 줄)
  const railY = doorRow + 4;
  let props = 0;
  for (const b of placedB) {
    if (props >= 6) break;
    const set = pick(r, [["steam-barrel", "steam-oil-drum"], ["steam-vent-anim", "steam-barrel"], ["steam-pressure-tank"], ["steam-coal-pile"]] as const);
    let x = b.x + b.w - 1;
    for (const id of set) { const s = c.size(id); const y = doorRow + 1; if (c.free(x, y, s.w, s.h) && y + s.h <= railY - 1) { c.kit(id, x, y); x += s.w; props++; } }
  }
  // 선로(동서) + 남쪽 지선 + 차막이 + 화차 + 기관차
  const spur = H - railY >= 10;
  const spurX = 3 + Math.floor(r() * 4);
  const rail: [number, number][] = [];
  for (let x = spur ? spurX : 0; x < W - 1; x++) rail.push([x, railY]);
  if (spur) for (let y = railY + 1; y < railY + 8; y++) rail.push([spurX, y]);
  c.auto("steam-at-rail", rail);
  c.kit("steam-buffer-stop", W - 2, railY);
  const wagons = 1 + Math.floor(r() * 2);
  let wx = spurX + 5 + Math.floor(r() * 4);
  let placedW = 0;
  for (let i = 0; i < wagons && wx + 4 < W - 10; i++) { c.kit("steam-coal-wagon", wx, railY - 1); wx += 5; placedW++; }
  if (spur) c.kit("steam-locomotive", spurX - 1, railY + 3);
  // 기중기는 선로 남쪽, 다리 사이에 상자 무리
  const cx = W - 14, cy = railY + 2;
  let crane = false;
  if (cy + 6 <= H - 1 && c.free(cx, cy, 6, 6)) {
    c.kit("steam-gantry-crane", cx, cy); crane = true;
    c.kit("steam-crate-stack", cx + 1, cy + 4); c.kit("steam-crate", cx + 3, cy + 5); c.kit("steam-crate", cx + 4, cy + 5);
  }
  if (spur) for (const [dx, dy, id] of [[3, 5, "steam-coal-pile"], [3, 7, "steam-coal-pile"], [5, 6, "steam-ore-cart"]] as const) {
    const s = c.size(id); if (c.free(spurX + dx, railY + dy, s.w, s.h)) c.kit(id, spurX + dx, railY + dy);
  }
  return `공장 건물 ${placedB.length}채${chimney ? "·굴뚝" : ""}·선로${spur ? "(지선·기관차)" : ""}·화차 ${placedW}·관 ${pipes}구간·벽 앞 소품 ${props}${crane ? "·기중기" : ""}`;
}

/** 줄 A 섬: 풀 윗면(걷는 땅, x0..x0+w-1 × y0..bottom) + 남쪽 절벽 앞면 한 줄(bottom+1). */
function island(c: Canvas, x0: number, y0: number, w: number, bottom: number): void {
  c.fill("sky-a-grass-top", x0, y0, w, bottom - y0 + 1, 4);
  const e = c.t.tileGroups?.find((group) => group.id === "sky:fill:sky-a-island-edge")?.tileIds ?? [];
  if (e.length >= 3 && bottom + 1 < c.h) for (let x = x0; x < x0 + w; x++) c.lower[(bottom + 1) * c.w + x] = x === x0 ? e[0]! : x === x0 + w - 1 ? e[2]! : e[1]!;
}

/** 섬 윗부분(건물 지붕보다 위 줄)에 줄 A 소품 무리 — 나무·증기 탱크·자루·풍향계 등을 왼→오로, 무리 사이 1칸(개선 1회: 섬 위가 빈 풀밭이던 것). */
const ISLAND_PROPS: readonly (readonly string[])[] = [
  ["sky-a-tree-sky", "sky-a-planter"], ["sky-a-gas-tank", "sky-a-barrel"], ["sky-a-sack-stack", "sky-a-rope-crate"], ["sky-a-water-tank"],
  ["sky-a-windvane", "sky-a-bench"], ["sky-a-pulley-crane", "sky-a-crate-stack"], ["sky-a-boiler", "sky-a-anchor-box"], ["sky-a-tree-sky"], ["sky-a-signpost", "sky-a-stone-wall"],
];
function islandProps(c: Canvas, r: () => number, x0: number, y0: number, w: number, bottom: number): number {
  const roof = Math.min(bottom, ...c.placed.filter((p) => p.h >= 2 && p.x >= x0 && p.x < x0 + w && p.y >= y0 - 1 && p.y <= bottom).map((p) => p.y));   // 건물 지붕 줄(덤불·꽃 1칸은 빼고)
  let x = x0 + (r() < 0.5 ? 0 : 1), n = 0;
  for (const grp of shuffle(r, ISLAND_PROPS)) {
    let cx = x; const plan: [string, number, number][] = []; let ok = true;
    for (const id of grp) {
      const s = c.size(id); const y = Math.max(y0, roof - s.h - (r() < 0.4 ? 1 : 0));
      if (cx + s.w > x0 + w || y + s.h > roof || !c.free(cx, y, s.w, s.h)) { ok = false; break; }
      plan.push([id, cx, y]); cx += s.w;
    }
    if (ok && plan.length) { for (const [id, px, py] of plan) c.kit(id, px, py); n += plan.length; x = cx + 1; }
    if (x >= x0 + w - 1) break;
  }
  return n;
}

/** 섬 위 줄 A 건물: 발 = bottom-1 줄, 문 앞 = 섬 맨 아래 풀 줄(bottom). 다리도 이 줄로 들어온다. */
function aBuildings(c: Canvas, r: () => number, x0: number, y0: number, w: number, bottom: number, max: number): number {
  const pool = ["sky-a-house", "sky-a-windmill-anim", "sky-a-lighthouse", "sky-a-watch-hut", "sky-a-market-stall", "sky-a-house", "sky-a-well"];
  let x = x0 + 1, n = 0;
  for (const id of shuffle(r, pool)) {
    if (n >= max) break;
    const s = c.size(id);
    if (x + s.w > x0 + w - 1 || bottom - s.h < y0 - 1) continue;
    c.kit(id, x, bottom - s.h); x += s.w + 1; n++;
  }
  for (let i = 0; i < 2; i++) { const bx = x0 + Math.floor(r() * w); if (bottom - 2 >= y0 && c.free(bx, y0, 1, 1)) c.kit(pick(r, ["sky-a-bush", "sky-a-flowers"]), bx, y0); }
  return n;
}

function composeDock(c: Canvas, r: () => number): string {
  const W = c.w, H = c.h;
  c.fill("sky-a-cloud-sea", 0, 0, W, H, 5);
  const ix = 1, iw = W >= 40 ? 8 : 7;
  const dx0 = ix + iw + 5, dy0 = 4;
  const dw = Math.min(18, W - dx0 - 6), dh = Math.min(13, H - dy0 - 3);
  const walk = dy0 + 5 + Math.floor(r() * 3);                   // 다리 걷는 줄 = 섬 맨 아래 풀 줄 = 갑판 안
  island(c, ix, walk - 6, iw, walk);
  const deck: [number, number][] = []; for (let y = dy0; y < dy0 + dh; y++) for (let x = dx0; x < dx0 + dw; x++) deck.push([x, y]);
  c.auto("steam-at-deck", deck);
  c.kit("sky-a-bridge", ix + iw, walk - 1);                     // QA D5: 다리 양 끝 = 섬 풀 · 갑판
  const a = aBuildings(c, r, ix, walk - 6, iw, walk, 2);        // QA D1·D2: 줄 A 건물은 따로 섬 풀 위에만
  islandProps(c, r, ix, walk - 6, iw, walk);
  c.kit("steam-hangar", dx0 + 1, dy0 - 1);
  if (dw >= 16) c.kit("steam-dock-crane", dx0 + 11, dy0 - 2);
  const my = dy0 + 2;
  c.kit("steam-mooring-mast", dx0 + dw - 4, my);                // QA D4: 계류탑은 갑판 동쪽 가장자리, 비공정은 바로 옆
  c.kit("sky-a-airship-anim", dx0 + dw, my + 1);
  const sx = (ox: number): number => dx0 + Math.round((ox * dw) / 18);
  for (const [ox, oy, id] of [[12, 8, "steam-fuel-pump"], [10, 9, "steam-winch"], [1, 7, "steam-crate-stack"], [3, 8, "steam-crate"], [4, 8, "steam-barrel"], [8, 10, "steam-cable-drum"], [0, 9, "steam-gaslamp-tall-lit"], [16, 9, "steam-gaslamp-tall-lit"]] as const) {
    const s = c.size(id); const x = sx(ox), y = dy0 + oy;
    if (y + s.h <= dy0 + dh && c.free(x, y, s.w, s.h)) c.kit(id, x, y);
  }
  // 갑판 아래쪽 화물 마당(개선 1회: 갑판 아래 절반이 빈 판자였다) — 왼쪽 상자·통 무리, 가운데 드럼, 오른쪽 탱크·케이블, 남쪽 가장자리 계류 기둥 줄
  let cargo = 0;
  for (const [ox, oy, id] of [[1, 10, "steam-crate-stack"], [3, 11, "steam-crate"], [4, 11, "steam-barrel"], [6, 10, "steam-oil-drum"], [7, 10, "steam-oil-drum"],
    [11, 10, "steam-pressure-tank"], [13, 11, "steam-gear-pile"], [14, 11, "steam-cable-drum"]] as const) {
    const s = c.size(id); const x = sx(ox), y = dy0 + oy;
    if (y + s.h <= dy0 + dh - 1 && c.free(x, y, s.w, s.h)) { c.kit(id, x, y); cargo++; }
  }
  for (let x = dx0 + 2; x < dx0 + dw - 1; x += 5) if (c.free(x, dy0 + dh - 2, 1, 1)) { c.kit("steam-bollard", x, dy0 + dh - 2); cargo++; }
  if (H - (dy0 + dh) >= 7) { c.kit("sky-a-island-s", 4, dy0 + dh + 2); if (W - 8 > dx0 + dw) c.kit("sky-a-island-m", W - 8, dy0 + dh + 2); c.kit("sky-a-cloud-mist", Math.floor(W / 2), H - 3); }
  return `갑판 ${dw}×${dh}·격납고·계류탑+비공정·화물 ${cargo}·하늘섬(줄 A 건물 ${a})·다리`;
}

function composeIsland(c: Canvas, r: () => number): string {
  const W = c.w, H = c.h;
  c.fill("sky-a-cloud-sea", 0, 0, W, H, 5);
  const n = W >= 38 ? 3 : 2;
  const iw = Math.floor((W - 2 - (n - 1) * 5) / n);
  // 섬마다 맨 아래 풀 줄을 같게 — 다리가 그 줄로 잇는다. 섬 덩이를 맵 세로 가운데 아래쪽에(개선 1회: 위쪽 절반이 빈 구름이었다)
  const bottom = Math.min(H - 3, Math.floor(H / 2) + 4 + Math.floor(r() * 2));
  let built = 0, props = 0;
  for (let i = 0; i < n; i++) {
    const ix = 1 + i * (iw + 5);
    const top = Math.max(4, bottom - 7 - Math.floor(r() * 3));
    island(c, ix, top, iw, bottom);
    built += aBuildings(c, r, ix, top, iw, bottom, 3);
    props += islandProps(c, r, ix, top, iw, bottom);
    if (i > 0) c.kit("sky-a-bridge", ix - 5, bottom - 1);
  }
  // 하늘: 섬 위 구름에 비공정 한 척·기구 하나(나는 것은 밑땅 검사에서 빠진다)
  const ax = 2 + Math.floor(r() * Math.max(1, W - 14));
  if (c.free(ax, 0, 6, 4)) c.kit("sky-a-airship-anim", ax, 0);
  if (c.free(W - 3, 0, 2, 3)) c.kit("sky-a-hot-air-balloon", W - 3, 0);
  if (H - bottom >= 5) { c.kit("sky-a-cloud-puff", Math.floor(W / 3), H - 2); c.kit("sky-a-cloud-mist", Math.floor((2 * W) / 3), H - 2); }
  return `섬 ${n}개·다리 ${n - 1}·줄 A 건물 ${built}·섬 소품 ${props}·비공정`;
}

const ROOMS: Readonly<Record<"workshop" | "boiler" | "inn", { walls: readonly string[]; floor: number; alt: number; north: readonly string[]; mount: readonly string[]; mid: readonly (readonly string[])[] }>> = {
  workshop: { walls: ["steam-wall-brick", "steam-wall-brick-pipes", "steam-wall-brick", "steam-wall-brick-window"], floor: 0, alt: 1,
    north: ["steam-i-forge", "steam-i-lathe", "steam-i-drillpress", "steam-i-toolchest", "steam-i-stove"], mount: ["steam-i-toolboard", "steam-i-wall-lamp", "steam-i-wall-lamp"],
    mid: [["steam-i-workbench", "steam-i-stool"], ["steam-i-blueprint-table", "steam-i-stool"], ["steam-i-crate-parts", "steam-crate"], ["steam-i-lab-table"]] },
  boiler: { walls: ["steam-wall-plate", "steam-wall-plate-pipes", "steam-wall-plate", "steam-wall-plate-gauge"], floor: 2, alt: 3,
    north: ["steam-i-boiler", "steam-furnace-anim", "steam-piston-anim", "steam-i-engine"], mount: ["steam-i-pipewall", "steam-i-gauge-panel", "steam-gear-anim", "steam-i-wall-lamp", "steam-gauge-anim"],
    mid: [["steam-i-coal-bunker"], ["steam-i-control-desk", "steam-i-stool"], ["steam-i-workbench", "steam-i-toolchest"]] },
  inn: { walls: ["steam-wall-paper", "steam-wall-paper-window", "steam-wall-paper", "steam-wall-paper-window"], floor: 0, alt: 1,
    north: ["steam-i-keg-rack", "steam-i-bookshelf", "steam-i-stove"], mount: ["steam-i-wall-lamp", "steam-i-wall-lamp"],
    mid: [["steam-i-bar-counter", "steam-i-stool"], ["steam-i-table", "steam-i-chair"], ["steam-i-chair", "steam-i-table"], ["steam-i-table", "steam-i-chair"]] },
};

function composeRoom(c: Canvas, r: () => number, kind: "workshop" | "boiler" | "inn"): string {
  const W = c.w, H = c.h; const spec = ROOMS[kind];
  const doorX = Math.floor(W / 2);
  c.fill("steam-t-floor", 1, 3, W - 2, H - 4, 7, spec.floor, spec.alt);   // QA B2: 기본 변형 + 7칸에 하나 꼴 짝 변형
  if (kind === "boiler") c.fill("steam-t-grate", 1, 3, W - 2, Math.min(5, H - 8), 9, 0);
  for (let x = 1; x < W - 1; x++) c.kit(spec.walls[x % spec.walls.length]!, x, 0);
  const ring: [number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x === 0 || x === W - 1 || y === 0 || y === H - 1) && !(x === doorX && y === H - 1)) ring.push([x, y]);
  c.auto("steam-at-ceiling", ring);                              // QA B1: 테두리 전체 = 천장 테 8방 오토타일
  c.fill("steam-t-floor", doorX, H - 1, 1, 1, 7, spec.floor, spec.alt);
  const aisle = (x: number, w: number): boolean => x <= doorX && doorX < x + w;
  c.placed.splice(0, c.placed.length, ...c.placed.filter((p) => !p.kit.startsWith("steam-wall")));   // 벽 키트는 겹침 판정에서 뺀다
  // 북벽 기물(QA I1): 2칸 이하 높이는 밑단을 바닥 첫 줄(y=3)에 — 윗부분만 벽 앞면에 겹친다. 통로(문 열)는 비움
  let x = 2, north = 0;
  for (const id of shuffle(r, spec.north)) {
    const s = c.size(id); const y = s.h <= 2 ? 4 - s.h : 3;
    if (aisle(x, s.w)) x = doorX + 1;
    if (x + s.w > W - 2) break;
    if (c.free(x, y, s.w, s.h)) { c.kit(id, x, y); north++; }
    x += s.w + (r() < 0.5 ? 1 : 0);
  }
  // 벽 부착물(벽 앞면 y=1): 북벽 기물이 벽에 겹친 열은 피한다. 톱니·계기판은 강판 벽 방(보일러실)에만(QA I2)
  let mx = 2 + Math.floor(r() * 2), mounts = 0;
  for (const id of shuffle(r, spec.mount)) {
    const s = c.size(id);
    while (mx + s.w <= W - 2 && !c.free(mx, 1, s.w, s.h)) mx++;
    if (mx + s.w > W - 2) break;
    c.kit(id, mx, 1); mounts++;
    mx += s.w + 2 + Math.floor(r() * 3);
  }
  // 가운데 무리: 통로 열·맨 아래 줄을 비우고, 무리 사이 1~2칸
  let groups = 0;
  for (const gy of [Math.min(H - 6, 7), H - 3]) {
    let gx = 2;
    for (const grp of shuffle(r, spec.mid)) {
      let cx = gx; let ok = true; const plan: [string, number, number][] = [];
      for (const id of grp) {
        const s = c.size(id); const y = gy - s.h + 1;
        if (aisle(cx, s.w) || cx + s.w > W - 2 || y < 4 || !c.free(cx, y, s.w, s.h, 0)) { ok = false; break; }
        plan.push([id, cx, y]); cx += s.w;
      }
      if (ok && plan.length) { for (const [id, px, py] of plan) c.kit(id, px, py); groups++; gx = cx + 1 + (r() < 0.5 ? 1 : 0); }
      else gx = aisle(gx, 3) ? doorX + 1 : gx + 1;
      if (gx >= W - 3) break;
    }
  }
  return `${SKY_STEAM_KIND_LABEL[kind]} — 북벽 기물 ${north}·벽 부착 ${mounts}·가운데 무리 ${groups}·문 (${doorX},${H - 1})`;
}

/** 맵 한 장 짜기. 구조 검사 오류가 있으면 씨앗을 바꿔 최대 6번 다시 짠다(마지막 시도의 오류를 돌려준다). */
export function composeSkySteam(tileset: TilesetDef, kind: SkySteamKind, width: number, height: number, seed: number): SkySteamPlan {
  let best: SkySteamPlan | undefined;
  for (let attempt = 0; attempt < 6; attempt++) {
    const s = seed * 7919 + attempt * 104729;
    const r = mulberry(s ^ 0x5157ea4);
    const c = new Canvas(tileset, width, height);
    const summary = kind === "street" ? composeStreet(c, r) : kind === "yard" ? composeYard(c, r) : kind === "dock" ? composeDock(c, r)
      : kind === "island" ? composeIsland(c, r) : composeRoom(c, r, kind);
    const { issues, doors } = checkSkySteam(c);
    const plan: SkySteamPlan = { kind, width, height, seed, lower: c.lower, upper: c.upper, placed: c.placed, doors, issues, summary };
    if (!issues.length) return plan;
    if (!best || issues.length < best.issues.length) best = plan;
  }
  return best!;
}
