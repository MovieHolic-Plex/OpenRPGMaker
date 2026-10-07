/**
 * 지역 시트(monster-coast·monster-climate·monster-dungeon·monster-rooms …) 쇼케이스가 함께 쓰는 도구.
 * 구운 타일셋(bake/) 을 읽어 엔진 오토타일·엔진 통행(canMove)·엔진 미끄럼(slideAfterStep)으로 맵을 칠하고 검사한다.
 * 맵은 `bake/verify-<name>.json` 에 쓰고 `bake/maps.json` 목록에 올린다 — cycle_theme.sh 가 그 목록을 그대로 그린다.
 *
 * 사용(쇼케이스 스크립트 맨 위):
 *   import { Kit } from "./kitlib.mts";
 *   const k = new Kit(process.argv[2]);
 *   const f = k.field("beach", 30, 20, (x, y) => `beach_sand${(x * 7 + y * 13) % 4}`);
 *   f.paint("sea", k.rect(0, 12, 29, 19)); f.shape(); f.stamp("house_a", 4, 4); f.save(); ...
 *   k.expectReach(f, [3, 5], [[20, 5]], "마을 → 부두");  k.done();
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { shapeAllAutotileGroupsAround, shadeAutotileInterior } from "../../../project/defaults/autotileEngine";
import { canMove, ledgeDirectionAt } from "../../../project/collision";
import { slideAfterStep } from "../../../project/slideTiles";

export type Cell = [number, number];

export class Kit {
  dir: string; ts: any; objects: any[]; tiles: any; groups: any[]; names: Record<number, string> = {};
  fails: string[] = []; notes: string[] = []; maps: { file: string; w: number; h: number; scale: number }[] = [];
  constructor(bakeDir: string) {
    this.dir = resolve(bakeDir ?? "");
    this.ts = JSON.parse(readFileSync(`${this.dir}/tileset.json`, "utf8"));
    this.objects = JSON.parse(readFileSync(`${this.dir}/objects.json`, "utf8"));
    this.tiles = JSON.parse(readFileSync(`${this.dir}/../tiles.json`, "utf8"));
    this.groups = this.ts.autotileGroups;
    for (const [n, i] of Object.entries(this.tiles.ids)) this.names[i as number] = n;
  }
  id(n: string): number { const v = this.tiles.ids[n]; if (v === undefined) throw new Error(`칸 ${n} 없음`); return v; }
  has(n: string) { return n in this.tiles.ids; }
  g(n: string) { const q = this.groups.find((x: any) => x.id === n); if (!q) throw new Error(`오토타일 그룹 ${n} 없음`); return q; }
  obj(n: string) { const o = this.objects.find((x: any) => x.name === n); if (!o) throw new Error(`물체 ${n} 없음`); return o; }
  *rect(x0: number, y0: number, x1: number, y1: number): Generator<Cell> { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) yield [x, y]; }
  /** 바탕을 ground(x,y) → 칸 이름 으로 깐 맵 하나. */
  field(name: string, W: number, H: number, ground: (x: number, y: number) => string, scale = 3) { return new Field(this, name, W, H, ground, scale); }
  /** 엔진 canMove + 턱 뛰어내림 + 미끄럼(slideTiles)으로 start 에서 닿는 칸 집합. blocked 는 일부러 막을 칸(문·이벤트 자리). */
  reach(f: Field, start: Cell, opt: { blocked?: Iterable<Cell> } = {}) {
    const project: any = { tilesets: { t: this.ts } };
    const map = { ...f.map, tilesetId: "t" };
    const blocked = new Set([...(opt.blocked ?? [])].map(([x, y]) => `${x},${y}`));
    const ok = (x: number, y: number) => !blocked.has(`${x},${y}`);
    const seen = new Set<string>([`${start[0]},${start[1]}`]); const q: Cell[] = [start];
    const D: Cell[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (q.length) {
      const [x, y] = q.shift()!;
      for (const [dx, dy] of D) {
        let nx = x + dx, ny = y + dy;
        const ld = ledgeDirectionAt(this.ts, map as any, nx, ny);
        const want = dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : "up";
        if (ld && ld === want) { nx += dx; ny += dy; if (!ok(nx, ny) || nx < 0 || ny < 0 || nx >= f.W || ny >= f.H) continue; }
        else if (!canMove(project, map as any, x, y, nx, ny) || !ok(nx, ny)) continue;
        let sdx = dx, sdy = dy, kind: "arrow" | "ice" | null = null, guard = 0;
        for (;;) {
          const s = slideAfterStep(this.ts, map as any, nx, ny, sdx, sdy, kind);
          if (!s || ++guard > 300) break;
          if (!canMove(project, map as any, nx, ny, nx + s.dx, ny + s.dy) || !ok(nx + s.dx, ny + s.dy)) break;
          nx += s.dx; ny += s.dy; sdx = s.dx; sdy = s.dy; kind = s.kind;
        }
        const key = `${nx},${ny}`; if (seen.has(key)) continue; seen.add(key); q.push([nx, ny]);
      }
    }
    return seen;
  }
  expectReach(f: Field, start: Cell, targets: Cell[], what: string, opt: { blocked?: Iterable<Cell> } = {}) {
    const s = this.reach(f, start, opt);
    const miss = targets.filter(([x, y]) => !s.has(`${x},${y}`));
    if (miss.length) this.fails.push(`${f.name}: ${what} — ${miss.map((c) => c.join(",")).join(" ")} 에 못 간다`);
    else this.notes.push(`${f.name}: ${what} ok`);
  }
  expectNoReach(f: Field, start: Cell, targets: Cell[], what: string, opt: { blocked?: Iterable<Cell> } = {}) {
    const s = this.reach(f, start, opt);
    const got = targets.filter(([x, y]) => s.has(`${x},${y}`));
    if (got.length) this.fails.push(`${f.name}: ${what} — ${got.map((c) => c.join(",")).join(" ")} 에 가지면 안 된다`);
    else this.notes.push(`${f.name}: ${what} ok`);
  }
  check(cond: boolean, msg: string) { if (!cond) this.fails.push(msg); }
  /** 그룹 칸 집합(멤버 + 속 변형 + 프레임은 이름으로). */
  members(grp: string) { const g = this.g(grp); return new Set<number>([...g.memberTileIds, ...(g.interiorVariants ?? []).flat()]); }
  /**
   * 낱칸 티끌 관문: 그룹 칸이 4이웃 중 3곳 이상 남의 칸에 둘러싸였거나(물 한 칸 구멍·땅 속 웅덩이), 남의 칸이 4이웃 모두 그룹에 둘러싸였으면(물 속 한 칸 땅) 실패.
   * 맵 밖은 그룹으로 본다(edgeConnects). also = 이웃으로 칠 다른 그룹(connectGroups).
   */
  noSpecks(f: Field, grp: string, also: string[] = []) {
    const m = new Set<number>([...this.members(grp), ...also.flatMap((a) => [...this.members(a)])]);
    const own = this.members(grp);
    const isM = (x: number, y: number) => !f.in(x, y) || m.has(f.map.lowerTiles[y * f.W + x]);
    const bad: string[] = [];
    for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) {
      const n = [isM(x, y - 1), isM(x + 1, y), isM(x, y + 1), isM(x - 1, y)].filter(Boolean).length;
      const t = f.map.lowerTiles[y * f.W + x];
      if (own.has(t) ? n <= 1 : !m.has(t) && n === 4) bad.push(`${x},${y}`);
    }
    if (bad.length) this.fails.push(`${f.name}: ${grp} 낱칸 티끌 ${bad.join(" ")}`);
    else this.notes.push(`${f.name}: ${grp} 낱칸 티끌 없음 ok`);
  }
  /** 물 위 물체 관문: 이 물체(낱칸 up 이름 접두)가 놓인 칸의 하위 칸이 grps 그룹이어야 한다(바다 바위가 모래 위에 거품 고리를 그리지 않게). */
  onWater(f: Field, prefixes: string[], grps: string[]) {
    const m = new Set<number>(grps.flatMap((g) => [...this.members(g)]));
    const bad: string[] = [];
    for (const [key, n] of f.occ) {
      const base = n.split("@")[0];
      if (!prefixes.some((p) => base.startsWith(p))) continue;
      const [x, y] = key.split(",").map(Number);
      if (!m.has(f.map.lowerTiles[y * f.W + x])) bad.push(`${base}(${key})`);
    }
    if (bad.length) this.fails.push(`${f.name}: 물 위 물체가 땅에 놓임 ${bad.join(" ")}`);
  }
  /** 맵 설명(참고문서에 실린다) — 무엇을 증명하는 견본인지 한두 줄. */
  describe(f: Field, text: string) { this.descriptions[f.name] = text; }
  descriptions: Record<string, string> = {};
  negatives: { map: string; file: string; code: string; what: string; cells: Cell[] }[] = [];
  /**
   * 정상/오류 쌍(참고문서 계약 6): 완성 맵 f 를 복사해 mutate 로 결함 하나를 넣고, 도달 검사가 그 결함을 잡는지 확인한다.
   * 잡으면 `verify-<맵>-err-<code>.json` 으로 저장하고 목록에 남긴다(오류 코드·맵 좌표). 못 잡으면 실패 — 검사가 약하다.
   */
  negative(f: Field, code: string, what: string, mutate: (g: Field) => void, start: Cell, targets: Cell[], opt: { blocked?: Iterable<Cell> } = {}) {
    if (!this.reach(f, start, opt) || targets.some(([x, y]) => !this.reach(f, start, opt).has(`${x},${y}`))) { this.fails.push(`${f.name}: 오류 쌍 ${code} — 정상 맵이 먼저 통과해야 한다`); return; }
    const g = new Field(this, `${f.name}-err-${code}`, f.W, f.H, () => this.names[f.map.lowerTiles[0]], f.scale);
    g.map.lowerTiles = [...f.map.lowerTiles]; g.map.upperTiles = [...f.map.upperTiles];
    mutate(g);
    const s = this.reach(g, start, opt);
    const miss = targets.filter(([x, y]) => !s.has(`${x},${y}`));
    if (!miss.length) { this.fails.push(`${f.name}: 오류 쌍 ${code}(${what}) 을 도달 검사가 못 잡는다`); return; }
    g.save();
    this.negatives.push({ map: f.name, file: `verify-${g.name}.json`, code, what, cells: miss });
    this.notes.push(`${f.name}: 오류 쌍 ${code} 검출 — ${miss.map((c) => c.join(",")).join(" ")}`);
  }
  /** 맵 목록을 쓰고 실패가 있으면 종료 코드 1. 쇼케이스 마지막 줄에서 부른다. */
  done() {
    writeFileSync(`${this.dir}/maps.json`, JSON.stringify(this.maps, null, 1));
    writeFileSync(`${this.dir}/showcase.json`, JSON.stringify({ descriptions: this.descriptions, negatives: this.negatives, checks: this.notes }, null, 1));
    for (const n of this.notes) console.log("·", n);
    for (const x of this.fails) console.log("X", x);
    console.log(this.fails.length ? `쇼케이스 실패 ${this.fails.length}건` : `쇼케이스 ok — 맵 ${this.maps.length}장`);
    if (this.fails.length) process.exit(1);
  }
}

export class Field {
  map: any; pts: { x: number; y: number }[] = []; wood = new Set<string>();
  constructor(public k: Kit, public name: string, public W: number, public H: number, ground: (x: number, y: number) => string, public scale = 3) {
    this.map = { width: W, height: H, lowerTiles: new Array(W * H), upperTiles: new Array(W * H).fill(-1) };
    for (let i = 0; i < W * H; i++) this.map.lowerTiles[i] = k.id(ground(i % W, (i / W) | 0));
  }
  in(x: number, y: number) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  at(x: number, y: number) { return this.k.names[this.map.lowerTiles[y * this.W + x]] ?? ""; }
  /** 오토타일 그룹으로 칠한다(꽉 찬 변형을 깔고 shape() 가 모양을 잡는다). */
  paint(grp: string, cells: Iterable<Cell>) {
    const full = this.k.g(grp).variantMap["255"];
    for (const [x, y] of cells) if (this.in(x, y)) { this.map.lowerTiles[y * this.W + x] = full; this.pts.push({ x, y }); }
  }
  shape(shadeGroups: string[] = []) {
    shapeAllAutotileGroupsAround(this.map, this.k.groups, this.pts);
    for (const s of shadeGroups) shadeAutotileInterior(this.map, this.k.g(s));
  }
  lo(x: number, y: number, n: string) { if (this.in(x, y)) this.map.lowerTiles[y * this.W + x] = this.k.id(n); }
  /** 물체가 차지한 칸 → 물체 이름(겹침 관문). 낱칸 물체(`이름.0.0`)를 up 으로 놓아도 센다. 숲·울타리·기둥 덮개는 세지 않는다. */
  occ = new Map<string, string>();
  claim(n: string, x: number, y: number) {
    const key = `${x},${y}`, had = this.occ.get(key);
    if (had && had !== n) this.k.fails.push(`${this.name}: 물체 겹침 ${had} ↔ ${n} @ (${x},${y}) — 뒤에 찍은 것이 앞 것을 지운다`);
    else if (had) this.k.fails.push(`${this.name}: 같은 물체 ${n} 를 (${x},${y}) 에 두 번 겹쳐 찍음`);
    this.occ.set(key, n);
  }
  /**
   * 물체 조각 장부(조각 지워짐 관문): 겹침 장부에 오르는 물체(겹침 허용 없이 찍은 stamp, 낱칸 `이름.0.0` up)의 조각마다
   * 「이 칸 이 층에 이 칸 번호」를 적어 두고, save() 때 최종 맵과 대조한다. 뒤에 깐 숲 벽(overlap stamp)·꽃·지형(lo)·paint 가
   * 조각을 덮으면 claim 은 못 본다(통합 I2 Y1·Y2 — 숲 벽이 외톨이 나무 윗줄을, 흰 꽃이 나무 아래 조각을 지웠다).
   */
  pieces: { obj: string; x: number; y: number; layer: "lowerTiles" | "upperTiles"; id: number }[] = [];
  up(x: number, y: number, n: string) {
    if (!this.in(x, y)) return;
    const id = this.k.id(n);
    if (n.endsWith(".0.0")) { this.claim(n.slice(0, -4), x, y); this.pieces.push({ obj: `${n.slice(0, -4)}@${x},${y}`, x, y, layer: "upperTiles", id }); }
    this.map.upperTiles[y * this.W + x] = id;
  }
  /** 조각 지워짐 관문 — save() 가 부른다. 조각 하나라도 최종 맵의 그 층에서 다른 칸이면 실패. */
  checkPieces() {
    const lost = new Map<string, string[]>();
    for (const p of this.pieces) {
      if (this.map[p.layer][p.y * this.W + p.x] === p.id) continue;
      const now = this.k.names[this.map[p.layer][p.y * this.W + p.x]] ?? "빈 칸";
      const l = lost.get(p.obj) ?? []; l.push(`(${p.x},${p.y}) ${p.layer === "lowerTiles" ? "아래층" : "위층"}→${now}`); lost.set(p.obj, l);
    }
    for (const [obj, l] of lost) this.k.fails.push(`${this.name}: 물체 조각 지워짐 ${obj} — ${l.join(" ")} (뒤에 깐 칸이 덮었다)`);
    if (!lost.size && this.pieces.length) this.k.notes.push(`${this.name}: 물체 조각 ${this.pieces.length}칸 온전 ok`);
  }
  /**
   * 벼랑 테 위 물체 관문(통합 I3 Z3): 위층에 칸이 있는데 아래층이 벼랑 윗면 오토타일 `*cliff*_at<마스크>` 의 테 변형(255 가 아닌 것)이면 실패.
   * 원작 문법 — 고원 위 바위·눈더미는 테(최암 덩이 띠·북쪽 입술)에서 한 칸 이상 안쪽에 선다. 꽉 찬 at255 와 속 변형(`_atin*`)만 허용.
   * 앞면(`*face*`)·계단은 이름에 cliff 가 없어 여기서 보지 않는다(앞면은 통행 막힘이라 물체를 놓지 않는다). save() 가 부른다.
   */
  checkRim() {
    const bad: string[] = [];
    for (let i = 0; i < this.W * this.H; i++) {
      if (this.map.upperTiles[i] < 0) continue;
      const lo = this.k.names[this.map.lowerTiles[i]] ?? "";
      const m = /cliff[^.]*_at(\d+)$/.exec(lo);
      if (m && m[1] !== "255") bad.push(`${this.k.names[this.map.upperTiles[i]] ?? this.map.upperTiles[i]}(${i % this.W},${(i / this.W) | 0})→${lo}`);
    }
    if (bad.length) this.k.fails.push(`${this.name}: 벼랑 테 위 물체 ${bad.join(" ")} — 고원 위 물체는 테에서 한 칸 안쪽(at255·속 변형)에`);
  }
  stamp(n: string, x: number, y: number, opt: { overlap?: boolean } = {}) {
    const o = this.k.obj(n);
    for (let r = 0; r < o.height; r++) for (let c = 0; c < o.width; c++) {
      if (!this.in(x + c, y + r)) continue;
      const i = (y + r) * this.W + x + c;
      if (!opt.overlap && (o.rowsLower[r][c] >= 0 || o.rowsUpper[r][c] >= 0)) this.claim(`${n}@${x},${y}`, x + c, y + r);
      if (o.rowsLower[r][c] >= 0) this.map.lowerTiles[i] = o.rowsLower[r][c];
      if (o.rowsUpper[r][c] >= 0) this.map.upperTiles[i] = o.rowsUpper[r][c];
      if (!opt.overlap) for (const layer of ["lowerTiles", "upperTiles"] as const) {   // 숲 벽 같은 겹침 허용 덮개는 장부에 안 올린다(서로 겹쳐 깔린다)
        const id = (layer === "lowerTiles" ? o.rowsLower : o.rowsUpper)[r][c];
        if (id >= 0) this.pieces.push({ obj: `${n}@${x},${y}`, x: x + c, y: y + r, layer, id });
      }
    }
  }
  /** 9조각 숲 벽(forest_{tl,t,tr,l,c,r,bl,b,br}). 그루 (i,j) = 2×2 칸, 왼쪽 위 (2i,2j). prefix 로 눈 숲·야자 숲 같은 다른 9조각을 쓴다. */
  forest(trees: Set<string>, prefix = "forest_") {
    const gw = Math.ceil(this.W / 2), gh = Math.ceil(this.H / 2);
    const has = (i: number, j: number): boolean => {
      if (i < 0 || i >= gw) return true;
      if (j < 0) return has(i, 0);
      if (j >= gh) return has(i, gh - 1);
      return trees.has(`${i},${j}`);
    };
    const list = [...trees].map((s) => s.split(",").map(Number)).sort((a, b) => a[1] - b[1]);
    for (const [i, j] of list) {
      const rk = !has(i, j - 1) ? "t" : !has(i, j + 1) ? "b" : "";
      const ck = !has(i - 1, j) ? "l" : !has(i + 1, j) ? "r" : "";
      const name = `${prefix}${rk}${ck}` === prefix ? `${prefix}c` : `${prefix}${rk}${ck}`;
      const y0 = 2 * j - (rk === "t" ? 1 : 0);
      this.stamp(name, 2 * i, y0, { overlap: true });
      const h = rk === "" ? 2 : 3;
      for (let r = 0; r < h; r++) for (let c = 0; c < 2; c++) this.wood.add(`${2 * i + c},${y0 + r}`);
    }
  }
  save() {
    this.checkPieces();
    this.checkRim();
    const file = `verify-${this.name}.json`;
    writeFileSync(`${this.k.dir}/${file}`, JSON.stringify({ width: this.W, height: this.H, lower: this.map.lowerTiles, upper: this.map.upperTiles }));
    this.k.maps.push({ file, w: this.W, h: this.H, scale: this.scale });
  }
}

/** 결정적 난수(mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * 굳은 껍질 판 흩뿌리기 — 던전 lava_cave(monster_dungeon.mts) 와 체육관 드래곤관이 함께 쓰는 공용 함수.
 * 맵 전체 좌표 포아송 디스크(dart throwing): 용암 속 칸(ok) 안의 픽셀 점을 던져, 이미 놓은 점과 크기별 반지름(소 24 · 중 32 · 대 44px,
 * 둘 중 큰 것) 안이면 버린다. 한 칸에 하나. 큰 것부터 상한(대 1/40칸 · 중 1/14칸)까지 놓고 소로 남은 자리를 채운다.
 * 판 번호 j: 소 4~9 · 중 0~3 · 대 10~11 (dungeon_cavern _CRUST_SHAPES). 같은 번호가 가까이(64px) 겹치지 않게 다음 번호로 넘긴다.
 * 돌려주는 [x, y, j] 칸에 lava_cell(P, 255, f, ("k", j)) 로 구운 껍질 칸을 아래층에 놓는다.
 */
export function scatterCrust(f: Field, ok: (x: number, y: number) => boolean, seed: number): [number, number, number][] {
  const r = rng(seed), out: { px: number; py: number; rad: number; j: number; x: number; y: number }[] = [];
  const cells = (() => { let n = 0; for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) if (ok(x, y)) n++; return n; })();
  const cls = [{ rad: 44, js: [10, 11], max: Math.max(1, Math.round(cells / 40)) }, { rad: 32, js: [0, 1, 2, 3], max: Math.round(cells / 14) }, { rad: 24, js: [4, 5, 6, 7, 8, 9], max: 999 }];
  for (const c of cls) {
    let n = 0;
    for (let t = 0; t < 3000 && n < c.max; t++) {
      const px_ = r() * f.W * 16, py_ = r() * f.H * 16, x = Math.floor(px_ / 16), y = Math.floor(py_ / 16);
      if (!ok(x, y) || out.some((o) => o.x === x && o.y === y)) continue;
      if (out.some((o) => Math.hypot(o.px - px_, o.py - py_) < Math.max(o.rad, c.rad))) continue;
      let j = c.js[Math.floor(r() * c.js.length)];
      for (let i = 0; i < c.js.length && out.some((o) => o.j === j && Math.hypot(o.px - px_, o.py - py_) < 64); i++) j = c.js[(c.js.indexOf(j) + 1) % c.js.length];
      out.push({ px: px_, py: py_, rad: c.rad, j, x, y }); n++;
    }
  }
  return out.map((o) => [o.x, o.y, o.j]);
}
