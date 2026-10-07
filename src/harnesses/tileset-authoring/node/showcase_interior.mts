/** 실내·체육관 쇼케이스: 구운 타일셋으로 방 여럿을 엔진 오토타일(퍼즐 칸막이)·물체 규칙대로 찍어 verify-room-*.json 에 쓴다. 렌더는 lib/render_map.py. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { shapeAllAutotileGroupsAround } from "../../../project/defaults/autotileEngine";
import { slideAfterStep } from "../../../project/slideTiles";
const dir = resolve(process.argv[2] ?? "");
const ts = JSON.parse(readFileSync(`${dir}/tileset.json`, "utf8"));
const objects = JSON.parse(readFileSync(`${dir}/objects.json`, "utf8")) as any[];
const tiles = JSON.parse(readFileSync(`${dir}/../tiles.json`, "utf8"));
const id = (n: string) => { const v = tiles.ids[n]; if (v === undefined) throw new Error(`칸 이름 없음: ${n}`); return v as number; };
const groups = ts.autotileGroups as any[];
const names: Record<number, string> = {};
for (const [k, v] of Object.entries(tiles.ids)) if (names[v as number] === undefined) names[v as number] = k;
const obj = (n: string) => { const o = objects.find((q) => q.name === n); if (!o) throw new Error(`물체 없음: ${n}`); return o; };

/** 실내 2차 방: 뒷벽 두 줄(방마다 다른 벽) · 옆·아래 검은 여백에 흰 천장 끝 띠 · 벽 아래 한 톤 그늘 · 아래 벽선 가운데 매트. */
class Room2 {
  lower: number[]; upper: number[];
  fl: string; wl: string; mt: string; pts: { x: number; y: number }[] = [];
  constructor(public name: string, public W: number, public H: number, style: string, gym = false, wallStyle = style) {
    this.fl = gym ? `g2_fl_${style}` : `i2_fl_${style}`;
    this.wl = gym ? `g2_wall_${wallStyle}` : `i2_wall_${style}`;
    this.mt = gym ? `g2_mat_${style}` : `i2_mat_${style}`;
    this.lower = new Array(W * H).fill(id("i2_edge_v")); this.upper = new Array(W * H).fill(-1);
    for (let y = 2; y < H - 1; y++) for (let x = 1; x < W - 1; x++) this.floor(x, y);
    for (let x = 1; x < W - 1; x++) for (const [r, part] of [[0, "up"], [1, "dn"]] as const) {
      const side = x === 1 ? "_l" : x === W - 2 ? "_r" : "";
      this.lower[r * W + x] = id(`${this.wl}_${part}${side}`);
    }
    for (let y = 0; y < H - 1; y++) { this.lower[y * W] = id("i2_edge_r"); this.lower[y * W + W - 1] = id("i2_edge_l"); }
    for (let x = 1; x < W - 1; x++) this.lower[(H - 1) * W + x] = id("i2_edge_t");
    this.lower[(H - 1) * W] = id("i2_edge_rt"); this.lower[(H - 1) * W + W - 1] = id("i2_edge_lt");
    const mx = W >> 1;
    this.lower[(H - 2) * W + mx] = id(this.mt); this.lower[(H - 1) * W + mx] = id(gym ? "g2_edge_mat" : "i2_edge_mat");
  }
  floor(x: number, y: number, fl = this.fl) { this.lower[y * this.W + x] = id(y === 2 ? `${fl}_s` : `${fl}${(x + y) % 2}`); }
  /** 판(화살표·정지)은 그 자리 바닥이 이미 받던 그늘을 그대로 이어 받는다(L8 N76·L9 N76b): 벽·칸막이 밑 띠(_s·_s_w·_se) → _s, 칸막이 동쪽 띠(_e·_e_top·_c) → _e. */
  put(x: number, y: number, n: string) {
    const under = names[this.lower[y * this.W + x]] ?? "";
    const sh = /^g2_fl_[a-z]+_(s|s_w|se)$/.test(under) ? "_s" : /^g2_fl_[a-z]+_(e|e_top|c)$/.test(under) ? "_e" : "";
    this.lower[y * this.W + x] = id(/^g2_spin_([udlr]|stop)$/.test(n) ? `${n}${sh}` : n);
  }
  up(x: number, y: number, n: string) { this.upper[y * this.W + x] = id(n); }
  /** 올린 칸막이 칠: 엔진 오토타일로 모양을 맞추고, 앞면 아래 바닥 칸은 한 톤 그늘(_s)로 바꾼다. */
  blocks(grp: string, cells: [number, number][]) {
    const full = groups.find((g) => g.id === grp).variantMap["255"];
    for (const [x, y] of cells) { this.lower[y * this.W + x] = full; this.pts.push({ x, y }); }
    const m: any = { width: this.W, height: this.H, lowerTiles: this.lower, upperTiles: this.upper };
    shapeAllAutotileGroupsAround(m, groups, this.pts);
    const mem = new Set(groups.find((g) => g.id === grp).memberTileIds);
    const key = new Set(cells.map(([x, y]) => `${x},${y}`));
    for (let y = 2; y < this.H - 1; y++) for (let x = 1; x < this.W - 1; x++) {
      if (key.has(`${x},${y}`)) continue;
      const n = mem.has(this.lower[(y - 1) * this.W + x]) || y === 2, w = mem.has(this.lower[y * this.W + x - 1]);
      const nm = names[this.lower[y * this.W + x]] ?? "";
      const m = /^(g2_fl_[a-z]+)(\d|_s)$/.exec(nm);
      if (m && !n && !w && y > 2 && mem.has(this.lower[(y - 1) * this.W + x - 1]) && !key.has(`${x},${y}`)) { this.lower[y * this.W + x] = id(`${m[1]}_c`); continue; }   // 남동 모서리(L5 N61)
      if (!m || (!n && !w)) continue;
      // 동쪽 그늘 띠는 칸막이를 따라 이어진다: 바로 위 칸도 칸막이 동쪽(서북 칸이 칸막이)이면 곧은 _e, 아니면 띠가 시작하는 _e_top(L4 N51)
      const contUp = mem.has(this.lower[(y - 1) * this.W + x - 1]) || /^g2_fl_[a-z]+_(e|se|e_top)$/.test(names[this.lower[(y - 1) * this.W + x]] ?? "");
      // 칸막이 서쪽 끝 바로 밑(위는 칸막이, 서북은 아님): 외곽선이 칸 x=2 에서 시작하니 그늘도 x=2 부터 — _s_w(L6 N66)
      const westEnd = !w && mem.has(this.lower[(y - 1) * this.W + x]) && !mem.has(this.lower[(y - 1) * this.W + x - 1]);
      this.lower[y * this.W + x] = id(`${m[1]}${w ? (n ? "_se" : contUp ? "_e" : "_e_top") : westEnd ? "_s_w" : "_s"}`);
    }
  }
  stamp(n: string, x: number, y: number) {
    const o = obj(n);
    for (let r = 0; r < o.height; r++) for (let c = 0; c < o.width; c++) {
      const i = (y + r) * this.W + x + c;
      if (o.rowsLower[r][c] >= 0) this.lower[i] = o.rowsLower[r][c];
      if (o.rowsUpper[r][c] >= 0) this.upper[i] = o.rowsUpper[r][c];
    }
  }
  save() {
    // 남동 모서리 그늘(_c)은 바로 위 칸이 바닥(동쪽 띠가 보이는 칸)일 때만 — 칸막이 뒤에 화살표·정지 판을 깔면 띠가 가려져 모서리만 떠 남는다(L7 N72)
    for (let y = 1; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      const m = /^(g2_fl_[a-z]+)_c$/.exec(names[this.lower[y * this.W + x]] ?? "");
      if (m && !/^(g2_fl_|g2_spin_\w+_e$)/.test(names[this.lower[(y - 1) * this.W + x]] ?? "")) this.lower[y * this.W + x] = id(`${m[1]}${(x + y) % 2}`);   // 위가 동쪽 띠를 덮은 판(_e)이면 띠가 이어지니 모서리를 둔다(L9 N76b)
    }
    writeFileSync(`${dir}/verify-room-${this.name}.json`, JSON.stringify({ width: this.W, height: this.H, lower: this.lower, upper: this.upper })); }
}

// 1) 포켓몬 센터 15×11 — 가운데 ㄷ자 접수대(안쪽 한 줄이 간호사 자리, 뒤 벽에 회복기), 왼쪽 벽 에스컬레이터, 오른쪽 벽 PC, 오른쪽 아래 쉼터, 바닥 몬스터볼 문양
{
  const r = new Room2("center", 15, 11, "center");
  r.stamp("c_counter", 4, 2); r.stamp("c_healer", 5, 1); r.stamp("c_screen", 8, 0); r.stamp("c_pc", 11, 1);
  r.stamp("c_escalator", 1, 1); r.stamp("plant2", 13, 2); r.stamp("plant2", 1, 7);
  r.stamp("c_emblem", 6, 6);
  r.stamp("c_table", 11, 6); r.stamp("c_sofa_y", 10, 6); r.stamp("c_sofa_y", 10, 7); r.stamp("c_sofa_b", 13, 6); r.stamp("c_sofa_b", 13, 7);
  r.save();
}
// 2) 상점 13×10 — 뒷벽 냉장 유리장 넷, 입구 왼쪽 계산대(뒤 한 줄이 점원 자리), 가운데 통로 양쪽에 진열대 둘, 오른쪽 위 냉동 평대
{
  const r = new Room2("mart", 13, 10, "mart");
  for (let x = 3; x <= 6; x++) r.stamp("m_fridge", x, 0);
  r.stamp("m_poster", 8, 0); r.stamp("plant2", 1, 2); r.stamp("m_freezer", 9, 2);
  r.stamp("m_gondola", 3, 4); r.stamp("m_gondola", 8, 4);
  r.stamp("m_counter", 1, 6);
  r.stamp("m_box", 11, 6); r.stamp("m_box", 11, 7); r.stamp("m_box", 10, 7);
  r.save();
}
// 3) 집 1층 13×9 — 뒷벽 한 줄을 부엌·찬장·냉장고·TV 가 채우고, 가운데 초록 깔개 위 식탁 섬, 오른쪽 벽 계단
{
  const r = new Room2("house", 13, 9, "house");
  r.stamp("h_kitchen", 1, 1); r.stamp("h_cupboard", 4, 1); r.stamp("h_fridge", 5, 1); r.stamp("h_bin", 6, 2);
  r.stamp("h_tv", 7, 1); r.stamp("h_clock", 6, 0); r.stamp("h_window", 8, 0);
  r.stamp("h_stairs", 10, 1); r.stamp("h_mat", 10, 4);
  r.stamp("h_rug", 3, 3); r.stamp("h_table", 5, 4);
  r.stamp("h_chair_r", 4, 4); r.stamp("h_chair_r", 4, 5); r.stamp("h_chair_l", 7, 4); r.stamp("h_chair_l", 7, 5);
  r.stamp("plant2", 1, 6); r.stamp("plant2", 11, 6);
  r.save();
}
// ---- 체육관 퍼즐 검사: 회전·정지·스위치를 실제 규칙대로 돌려 「장치 없이는 못 가고, 장치로는 간다」를 확인한다 ----
type Gate = { cells: [number, number][]; set: "A" | "B" };
const fails: string[] = [];
function solve(r: Room2, start: [number, number], targets: [number, number][], opt: { gates?: Gate[]; useDevices: boolean; block?: [number, number]; boulders?: [number, number][] }) {
  const W = r.W, H = r.H;
  const nm = (x: number, y: number) => names[r.lower[y * W + x]] ?? "";
  const shutT = (t: number) => t >= 0 && !Object.values(ts.passability[t]).some(Boolean);
  const gateCells = (st: number) => new Set((opt.gates ?? []).filter((g) => (g.set === "A") === (st === 0)).flatMap((g) => g.cells.map(([x, y]) => `${x},${y}`)));
  const closed = [gateCells(0), gateCells(1)];
  const arcIds = new Set([id("g2_arc0"), id("g2_arc1")]);
  // 밀 바위(괴력): 처음 놓인 칸의 위층 돌 그림은 바위가 옮겨 가면 사라진다 — 그 칸은 바닥으로 보고, 지금 바위가 있는 칸만 막는다
  const homes = new Set((opt.boulders ?? []).map(([x, y]) => `${x},${y}`));
  const free = (x: number, y: number, st: number, bs: Set<string>) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    if (opt.block && opt.block[0] === x && opt.block[1] === y) return false;
    if (closed[st].has(`${x},${y}`)) return false;
    if (bs.has(`${x},${y}`)) return false;
    const up = r.upper[y * W + x];
    if (shutT(r.lower[y * W + x])) return false;
    if (up >= 0 && !arcIds.has(up) && !homes.has(`${x},${y}`) && shutT(up)) return false;
    if (!opt.useDevices && /^g2_spin_[udlr](_s|_e)?$/.test(nm(x, y))) return false;
    return true;
  };
  const D: Record<string, [number, number]> = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
  const key = (x: number, y: number, st: number, bs: Set<string>) => `${x},${y},${st}|${[...bs].sort().join(";")}`;
  const b0 = new Set(homes);
  const seen = new Set<string>(); const q: [number, number, number, Set<string>][] = [[start[0], start[1], 0, b0]];
  const at = new Set<string>();
  const stopsUsed = new Set<string>();
  seen.add(key(start[0], start[1], 0, b0)); at.add(`${start[0]},${start[1]}`);
  let pushes = 0;
  while (q.length) {
    const [x, y, st, bs] = q.shift()!;
    for (const [dx, dy] of Object.values(D)) {
      let nx = x + dx, ny = y + dy, ns = st, nb = bs;
      if (bs.has(`${nx},${ny}`)) {
        // 바위 밀기: 장치를 쓸 때만, 바위 너머 칸이 비어 있어야 한다(바위는 미끄러지지 않는다)
        if (!opt.useDevices || !free(nx + dx, ny + dy, st, bs)) continue;
        nb = new Set(bs); nb.delete(`${nx},${ny}`); nb.add(`${nx + dx},${ny + dy}`); pushes++;
      } else {
        if (!free(nx, ny, st, bs)) continue;
        if (opt.useDevices) {
          // 엔진과 같은 규칙(project/slideTiles.slideAfterStep)으로 미끄러진다
          const mapObj: any = { width: W, height: H, lowerTiles: r.lower, upperTiles: r.upper };
          let sdx = dx, sdy = dy; let kind: "arrow" | "ice" | null = null; let guard = 0;
          for (;;) {
            const nxt = slideAfterStep(ts, mapObj, nx, ny, sdx, sdy, kind);
            if (!nxt || ++guard > 200) { if (kind && /^g2_spin_stop(_s|_e)?$/.test(nm(nx, ny))) stopsUsed.add(`${nx},${ny}`); break; }
            if (!free(nx + nxt.dx, ny + nxt.dy, ns, bs)) break;
            nx += nxt.dx; ny += nxt.dy; sdx = nxt.dx; sdy = nxt.dy; kind = nxt.kind;
          }
        }
      }
      if (opt.useDevices && nm(nx, ny) === "g2_switch") ns = 1 - st;
      const k = key(nx, ny, ns, nb); if (seen.has(k)) continue; seen.add(k); at.add(`${nx},${ny}`); q.push([nx, ny, ns, nb]);
    }
  }
  const reached = targets.some(([tx, ty]) => at.has(`${tx},${ty}`));
  return { reached, stopsUsed, pushes };
}
function checkGym(r: Room2, start: [number, number], targets: [number, number][], gates: Gate[] = [], choke?: [number, number], boulders?: [number, number][]) {
  const a = solve(r, start, targets, { gates, useDevices: true, boulders });
  const b = solve(r, start, targets, { gates, useDevices: false, boulders });
  if (!a.reached) fails.push(`${r.name}: 장치를 써도 관장에게 못 간다`);
  if (b.reached && !choke) fails.push(`${r.name}: 장치 없이 관장에게 걸어간다(퍼즐이 길을 못 막는다)`);
  for (let y = 0; y < r.H; y++) for (let x = 0; x < r.W; x++) {
    const n = names[r.lower[y * r.W + x]] ?? "";
    const m = /^g2_spin_([udlr])(?:_s|_e)?$/.exec(n);
    if (m) { const [dx, dy] = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }[m[1] as "u"]; const t = r.lower[(y + dy) * r.W + x + dx]; if (!Object.values(ts.passability[t]).some(Boolean)) fails.push(`${r.name}: 죽은 화살표 ${x},${y}(바로 앞이 벽)`); }
    if (/^g2_spin_stop(_s|_e)?$/.test(n) && !a.stopsUsed.has(`${x},${y}`)) fails.push(`${r.name}: 어떤 미끄럼도 끝나지 않는 정지 칸 ${x},${y}`);
  }
  if (choke && solve(r, start, targets, { gates, useDevices: true, block: choke }).reached) fails.push(`${r.name}: ${choke} 칸이 막혀도 관장에게 간다(중앙 통로 강제 실패)`);
  console.log(`${r.name}: 장치로 도달 ${a.reached} · 장치 없이 도달 ${b.reached}${choke ? ` · 가운데 틈 ${choke} 막으면 도달 ${solve(r, start, targets, { gates, useDevices: true, block: choke }).reached}` : ""}${boulders ? ` · 밀 바위 ${boulders.length}개(밀지 않으면 도달 ${b.reached})` : ""}`);
}
const off = (ox: number, oy: number, cells: [number, number][]): [number, number][] => cells.map(([x, y]) => [x + ox, y + oy]);
const span = (x0: number, y0: number, x1: number, y1: number, except: [number, number][] = []): [number, number][] => {
  const out: [number, number][] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!except.some(([a, b]) => a === x && b === y)) out.push([x, y]);
  return out;
};

// 4) 상록 체육관(회전 바닥) 18×18 — 관장은 왼쪽 위 칸막이 방, 입구는 아래. 회전 칸 사슬로만 들어간다
{
  const r = new Room2("gymspin", 18, 18, "teal", true);
  const X = 1, Y = 2;
  const walls: [number, number][] = [
    ...span(5, 0, 5, 12, [[5, 8]]),
    ...span(0, 5, 4, 6, [[2, 5], [2, 6]]),
    ...span(0, 11, 4, 12),
    ...span(6, 6, 13, 7, [[9, 6], [9, 7]]),
    ...span(6, 9, 15, 10, [[15, 9], [15, 10]]),
    // 오른쪽 위 섬 — 넓은 빈 바닥을 막고, 위아래 두 줄의 미끄럼 길을 만든다(적대 검수 2026-10-02 「오른쪽 위가 비었다」)
    ...span(10, 1, 13, 3),
  ];
  r.blocks("pb_teal", off(X, Y, walls));
  for (const [x, y, n] of [[2, 5, "u"], [2, 6, "u"], [5, 8, "l"], [14, 8, "l"], [9, 6, "d"], [9, 7, "d"], [15, 9, "u"], [15, 10, "u"], [12, 11, "l"], [7, 1, "d"], [9, 0, "r"], [15, 2, "d"], [14, 4, "l"]] as [number, number, string][]) r.put(x + X, y + Y, `g2_spin_${n}`);
  r.put(15 + X, 5 + Y, "g2_spin_stop"); r.put(7 + X, 4 + Y, "g2_spin_stop");
  r.stamp("g_leader_mat", 0 + X, 0 + Y); r.stamp("g_emblem_teal", 8, 0);
  r.stamp("g_statue", 5 + X, 13 + Y); r.stamp("g_statue", 11 + X, 13 + Y);
  checkGym(r, [9, 16], [[2 + X, 0 + Y], [1 + X, 1 + Y]]);
  r.save();
}
// 5) 보라 체육관(전기 문) 11×20 — 세로 복도를 기둥 쌍 세 줄이 가로막고, 양옆 오목한 칸의 스위치가 두 묶음(A/B)을 번갈아 연다
{
  const r = new Room2("gymelec", 11, 20, "yel", true, "elec");
  const X = 1, Y = 2;
  const walls: [number, number][] = [
    ...span(0, 0, 1, 16, span(0, 8, 1, 10)), ...span(7, 0, 8, 16, span(7, 4, 8, 6)),
  ];
  r.blocks("pb_elec", off(X, Y, walls));
  const gates: Gate[] = [];
  for (const [gy, set] of [[3, "B"], [7, "A"], [11, "B"]] as [number, "A" | "B"][]) {
    const pyl = set === "A" ? "g_pylon" : "g_pylon_off";
    r.stamp(pyl, 2 + X, gy - 1 + Y); r.stamp(pyl, 6 + X, gy - 1 + Y);
    const cells = span(3, gy, 5, gy).map(([x, y]) => [x + X, y + Y] as [number, number]);
    gates.push({ cells, set });
    if (set === "A") cells.forEach(([x, y], k) => r.up(x, y, `g2_arc${k % 2}`));
  }
  r.put(0 + X, 9 + Y, "g2_switch"); r.put(8 + X, 5 + Y, "g2_switch"); r.stamp("g_emblem_elec", 4, 0);
  r.stamp("g_edais", 2 + X, 0 + Y);
  r.stamp("g_statue", 2 + X, 14 + Y); r.stamp("g_statue", 6 + X, 14 + Y);
  checkGym(r, [5, 18], [[3 + X, 0 + Y], [5 + X, 0 + Y], [4 + X, 1 + Y]], gates);
  r.save();
}
// 6) 회색 체육관(바위) 15×17 — 금탄(RSE)·회색(FRLG) 문법: 돌 칸막이 두 줄이 방을 가른다. 아래 줄(행 11~12)은 오른쪽 끝 한 칸만 열려 있고,
//    위 줄(행 7~8)의 유일한 틈(x=3)은 밀 바위가 막는다 — 바위를 북쪽으로 세 번 밀어야 관장 단상에 닿는다(적대 검수 L1 N1). 트레이너는 꺾이는 자리(아래 줄 오른쪽 끝 틈 앞)에 선다.
{
  const r = new Room2("gymrock", 15, 17, "dirt", true, "rock");
  for (let y = 13; y <= 15; y++) for (let x = 1; x <= 13; x++) r.floor(x, y, "g2_fl_plank");         // 입구 마루(같은 높이 — 앞턱 없음)
  r.put(7, 15, "g2_mat_plank");
  const walls: [number, number][] = [
    ...span(1, 7, 13, 8, [[3, 7], [3, 8]]),                                                   // 위 칸막이: 틈 x=3
    ...span(1, 11, 12, 12),                                                                    // 아래 칸막이: x=13 만 열림
    // 한 칸 혹(턱)은 두지 않는다 — 1칸 칸막이는 앞면이 칸보다 좁게 그려져 「칸막이 위로 오르는 계단」으로 읽혔다(적대 검수 L2 N29).
    // 칸막이는 늘 두 칸 두께로 깐다.
  ];
  r.blocks("pb_rock", walls);
  r.up(3, 8, "g2_boulder0");                                                                   // 틈을 막은 밀 바위
  r.stamp("g_dais", 6, 3);
  r.stamp("g_bigrock", 1, 2); r.stamp("g_bigrock", 12, 2);
  for (const x of [3, 5, 9, 11]) r.stamp("g_window", x, 0);
  r.stamp("g_statue", 5, 14); r.stamp("g_statue", 9, 14);
  checkGym(r, [7, 15], [[7, 4], [6, 4], [8, 4]], [], undefined, [[3, 8]]);
  r.save();
}
for (const f of fails) console.log("X", f);
if (fails.length) process.exit(1);
console.log("rooms ok");
