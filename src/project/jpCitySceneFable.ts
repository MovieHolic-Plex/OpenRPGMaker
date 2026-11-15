// project/jpCitySceneFable.ts
// 새 거리(fable_street 조각)의 마무리 — 강둑, 노면 표시, 경계 줄 짓기, 재료가 만나는 자리의 테, 건물 발치 그림자, 아케이드(입면), 바닥 덧조각, 그리고 검사.
// 왜(오너 2026-11-15, jp-redo/BRIEF.md 6~15): 표지판이 차도에 서고, 담 없는 대문 기둥이 줄지어 서고, 담이 허공에서 끊기고, 포장이 테 없이 맞닿고,
//   차선이 아무 데서나 끊기고, 아케이드가 평면도 지붕으로 길을 덮었다. 여기 규칙은 그 꼴을 «만들 수 없게» 한다 — 규칙마다 auditScene 의 검사 하나.
import { Occ, type SceneBand, type SceneCtx, type SceneLayout, type SceneVStreet, type SceneKaki } from "@/project/jpCitySceneCtx";
import { GROUND_FAMILIES, groundFamilyOf, STREET_PIECES, STREET_RUNS, streetTagged, type GroundFamily } from "@/project/jpCityStreetPieces";
import type { JpStreetStep } from "@/project/jpCityStreetComposer";

const key = (x: number, y: number) => `${x},${y}`;
const touching = (L: SceneLayout, b: SceneBand): SceneVStreet[] => L.vstreets.filter((v) => v.y0 <= b.front.road1 + 1 && v.y1 >= b.front.road0 - 1);

/** 길의 등급: alley 골목(표시 없음) · one 한 차로(가장자리 선만) · two 두 차로(가장자리 선 + 중앙선) */
export type RoadClass = "alley" | "one" | "two";
export interface FableRoad { readonly dir: "h" | "v"; readonly cls: RoadClass; /** 가로 길: 줄 a..b, 세로 길: 열 a..b */ readonly a: number; readonly b: number; /** 길이 방향 범위 */ readonly from: number; readonly to: number }
export interface FableRun { readonly family: string; readonly cells: readonly { x: number; y: number }[]; readonly gates: readonly { x: number; y: number }[]; /** 붙지 못한 끝(검사가 0 을 기대한다) */ readonly loose: readonly { x: number; y: number }[] }
export interface FableInfo {
  readonly W: number; readonly H: number; readonly occ: Uint8Array; readonly gfam: Uint8Array;
  readonly placed: readonly { name: string; look: string; x: number; y: number; w: number; h: number; anchor: string; repeat: boolean }[];
  readonly runs: readonly FableRun[]; readonly roads: readonly FableRoad[];
  /** 횡단보도·교차로 칸(차선이 끊겨도 되는 칸) */ readonly crossings: ReadonlySet<string>;
  /** 테 조각이 놓인 칸 */ readonly borders: ReadonlySet<string>;
  /** 노면 선이 놓인 칸 → 조각 이름 */ readonly marks: ReadonlyMap<string, string>;
  /** 집 필지 앞줄의 담·대문 키트(jp-bldg-f-kaki-*) */ readonly kaki: readonly SceneKaki[];
}

// ───────────────────────── 강둑 ─────────────────────────
/** 하천 띠: 북쪽 둑(갓돌·돌 면·물가 3칸 조각, 길이를 따라 네 가지가 섞인다) · 물 · 남쪽 둑 갓돌 · 난간 줄 · 계단 · 다리(차도가 물 위로 이어지고 양옆에 난간). */
export function fableRiver(c: SceneCtx, L: SceneLayout): void {
  const { W, rng } = c;
  const emb = streetTagged("emb"), far = streetTagged("bankfar"), shade = streetTagged("watershade");
  for (const b of L.bands) {
    const s = b.front, rv = s.river;
    if (!rv || !emb.length) continue;
    const cross = L.vstreets.filter((v) => v.from <= b.index && v.to > b.index);
    const inSpan = (x: number, pad = 0) => cross.some((v) => x >= v.x - pad && x < v.x + v.w + pad);
    c.fillFamily(0, rv.wall, W, rv.bank0 - rv.wall + 1, "water");
    c.fillFamily(0, rv.bank1, W, 1, "pave");
    c.mark(0, rv.bank1, W, 1, Occ.Lot);
    for (const v of cross) {                                                // 다리: 세로 길의 바닥이 물 위로 이어진다
      const deck = v.sw ? "tarmac" : groundFamilyOf(c.tone.alley);              // 다리 바닥: 그 길의 바닥 그대로
      c.fillFamily(v.x, rv.wall, v.w, rv.bank1 - rv.wall + 1, v.sw ? "pave" : deck);
      c.fillFamily(v.x + v.sw, rv.wall, v.lane, rv.bank1 - rv.wall + 1, deck);
      c.mark(v.x, rv.wall, v.w, rv.bank1 - rv.wall + 1, Occ.Walk);
      c.mark(v.x + v.sw, rv.wall, v.lane, rv.bank1 - rv.wall + 1, Occ.Road);
      // 다리 난간: 길 양옆(물 쪽 칸)에 콘크리트 난간이 둑에서 둑까지 — 북쪽 끝 기둥 · 가운데 · 남쪽 끝 기둥
      for (const [x, side] of [[v.x - 1, "w"], [v.x + v.w, "e"]] as const) {
        if (x < 0 || x >= W) continue;
        if (!STREET_PIECES[`bridge-${side}`]) { c.runCells.push({ family: "rail", cells: c.vline(x, rv.wall, rv.bank0 - rv.wall + 1) }); continue; }
        for (let y = rv.wall; y <= rv.bank0; y++) c.stStamp(`bridge-${side}${y === rv.wall ? "-n" : y === rv.bank0 ? "-s" : ""}`, x, y);
      }
    }
    let stairX = -1;
    const stair = streetTagged("embstair")[0];
    if (stair) for (let t = 0; t < 16 && stairX < 0; t++) { const x = 2 + Math.floor(rng() * (W - 6)); if (!inSpan(x, 2) && !inSpan(x + 1, 2)) stairX = x; }
    for (let x = 0; x < W; x++) {
      if (inSpan(x)) continue;
      if (x === stairX) { c.stStamp(stair!, x, rv.wall + 2); x++; continue; }
      c.stStamp(emb[(x * 7 + c.seed * 3 + (x % 3 === 0 ? 0 : Math.floor(rng() * emb.length))) % emb.length]!, x, rv.wall + 2);
      if (shade.length) c.stStamp(shade[Math.floor(rng() * shade.length)]!, x, rv.wall + 3);
      if (far.length) c.stStamp(far[(x * 5 + c.seed) % far.length]!, x, rv.bank0);
    }
    // 난간: 북쪽은 갓돌 위(둑 맨 윗줄), 남쪽은 남쪽 갓돌 위 — 다리와 계단 자리에서 끊기고 끝 기둥으로 닫힌다.
    const north = c.hline(0, rv.wall, W).filter((q) => !inSpan(q.x, 1) && q.x !== stairX && q.x !== stairX + 1);   // 다리 난간 끝 기둥 칸은 비운다
    const south = c.hline(0, rv.bank0, W).filter((q) => !inSpan(q.x, 1));
    c.runCells.push({ family: "railcap", cells: north }, { family: "rail", cells: south });
    for (const q of [...north, ...south]) c.drawn[(q.y - 1) * W + q.x] = 1;
    const boats = streetTagged("afloat");
    for (let t = 0, n = 0; t < 12 && n < 2 && boats.length; t++) { const x = 1 + Math.floor(rng() * (W - 5)); if (!inSpan(x, 1) && !inSpan(x + 3, 1) && c.stPut(boats, x, rv.water0 + 1)) n++; }
    // 산책로: 북쪽 걷는 줄 위쪽(건물 쪽)과 남쪽 줄에 낮은 것
    const low = streetTagged("promenade");
    for (const y of [s.nA, s.sB]) for (let x = 2 + Math.floor(rng() * 4); x < W - 2; x += 4 + Math.floor(rng() * 5)) if (!inSpan(x, 1)) c.stPut(low, x, y, { lax: true });
    c.scenesUsed.add("kawa"); c.piecesUsed.push("river");
  }
}

// ───────────────────────── 길: 등급·횡단보도·표시 ─────────────────────────
function roadsOf(c: SceneCtx, L: SceneLayout): FableRoad[] {
  const out: FableRoad[] = [];
  for (const b of L.bands) {
    const s = b.front;
    if (s.type === "kerb") out.push({ dir: "h", cls: s.road1 - s.road0 + 1 >= 4 ? "two" : "one", a: s.road0, b: s.road1, from: 0, to: c.W - 1 });
    else if (s.type === "lane") out.push({ dir: "h", cls: "alley", a: s.road0 + 1, b: s.road1, from: 0, to: c.W - 1 });   // 생활도로: 북쪽 한 줄은 길가 띠, 차도에는 선을 긋지 않는다(흰 선은 길가 띠 그림에 있다)
  }
  for (const v of L.vstreets) if (!v.arcade) out.push({ dir: "v", cls: !v.sw ? "alley" : v.lane >= 4 ? "two" : "one", a: v.x + v.sw, b: v.x + v.sw + v.lane - 1, from: v.y0, to: v.y1 });
  return out;
}

/**
 * 노면 표시: 골목은 없음 · 한 차로 길은 가장자리 선만 · 두 차로 길은 가장자리 선 + 중앙선. 선은 교차로와 횡단보도에서만 끊긴다.
 * 횡단보도: 연석 큰길마다 하나(2칸 폭, 양옆 정지선, 보도 쪽에 점자 블록) + 세로 길이 큰길 보도를 가로지르는 모퉁이.
 */
export function fableMarks(c: SceneCtx, L: SceneLayout, roads: readonly FableRoad[], crossings: Set<string>, marks: Map<string, string>): void {
  const { W, H, rng } = c;
  const put = (name: string, x: number, y: number) => { if (c.inside(x, y) && STREET_PIECES[name] && !marks.has(key(x, y))) { marks.set(key(x, y), name); c.stStamp(name, x, y); } };
  // 교차로 칸: 가로 길과 세로 길의 차도가 겹치는 칸
  const roadCell = (x: number, y: number) => c.at(x, y) === Occ.Road && c.famAt(x, y) === "tarmac";
  for (const h of roads.filter((r) => r.dir === "h")) for (const v of roads.filter((r) => r.dir === "v")) {
    if (v.from > h.b + 1 || v.to < h.a - 1) continue;
    for (let y = h.a; y <= h.b; y++) for (let x = v.a; x <= v.b; x++) crossings.add(key(x, y));
  }
  // 큰길 횡단보도
  for (const b of L.bands) {
    const s = b.front;
    if (s.type !== "kerb") continue;
    const vs = touching(L, b), inV = (x: number, pad: number) => vs.some((v) => x >= v.x - pad && x < v.x + v.w + pad);
    for (let t = 0; t < 14; t++) {
      const x = 4 + Math.floor(rng() * Math.max(1, W - 10));
      if (inV(x, 3) || inV(x + 1, 3)) continue;
      for (let y = s.road0; y <= s.road1; y++) {
        const row = y === s.road0 ? "n" : y === s.road1 ? "s" : "m";
        put(`mark-zebra-h-${row}`, x, y); put(`mark-zebra-h-${row}`, x + 1, y);
        crossings.add(key(x, y)); crossings.add(key(x + 1, y));
        put(`mark-stop-w-${row}`, x - 1, y); put(`mark-stop-e-${row}`, x + 2, y);
        crossings.add(key(x - 1, y)); crossings.add(key(x + 2, y));         // 정지선 칸까지가 횡단보도다
      }
      for (const [y, side] of [[s.nK ?? s.nA, "s"], [s.sA ?? s.sB, "n"]] as const) for (const xx of [x, x + 1]) if (c.famAt(xx, y) === "pave" && !c.drawn[y * W + xx]) { c.stStamp(`kerb-${side}-tactile`, xx, y); marks.set(key(xx, y), `kerb-${side}-tactile`); }
      break;
    }
    // 모퉁이: 세로 길 차도가 큰길 보도 줄을 지나는 칸(보도가 구획 사이로 이어진다)
    for (const v of vs) if (v.sw && !v.arcade) for (const y of [s.nA, s.nK, s.sA, s.sB]) if (y !== undefined && y >= v.y0 && y <= v.y1) for (let x = v.x + v.sw; x < v.x + v.sw + v.lane; x++) if (roadCell(x, y)) { put("mark-zebra-v", x, y); crossings.add(key(x, y)); }
  }
  // 생활도로의 좁은 횡단보도: 세로 길이 만나는 줄에 가끔 한 칸 폭(조용한 길도 건널 자리 하나)
  for (const b of L.bands) {
    const s = b.front;
    if (s.type !== "lane" || rng() >= 0.5) continue;
    const vs = touching(L, b);
    const v = vs[Math.floor(rng() * vs.length)];
    if (!v) continue;
    const x = v.x + v.w + 1 < W - 2 ? v.x + v.w + 1 : v.x - 2;
    if (x < 1 || x >= W - 1 || c.at(x, s.road1) !== Occ.Road) continue;
    put("mark-zebra-h-n", x, s.road0 + 1); put("mark-zebra-h-s", x, s.road1);
    crossings.add(key(x, s.road0 + 1)); crossings.add(key(x, s.road1));
  }
  // 선
  for (const r of roads) {
    if (r.cls === "alley") continue;
    const two = r.cls === "two", n = r.b - r.a + 1;
    for (let k = r.from; k <= r.to; k++) for (let j = r.a; j <= r.b; j++) {
      const x = r.dir === "h" ? k : j, y = r.dir === "h" ? j : k;
      if (!c.inside(x, y) || !roadCell(x, y) || crossings.has(key(x, y)) || marks.has(key(x, y))) continue;
      const first = j === r.a, last = j === r.b, mid = two && j === r.a + n / 2 - 1;
      const d = r.dir;
      if (first && last) put(`mark-edge-${d}-both`, x, y);
      else if (first) put(`mark-edge-${d}-a`, x, y);
      else if (last) put(`mark-edge-${d}-b`, x, y);
      else if (mid) put(`mark-centre-${d}`, x, y);
    }
  }
  void H;
}

// ───────────────────────── 경계 줄 ─────────────────────────
/**
 * 모아 둔 경계 칸을 줄로 짓는다. 규칙: 줄의 끝은 건물 옆·다른 줄·필지 끝(바닥 가족이 바뀌는 칸·길)·지도 끝에 닿아야 한다 —
 * 허공에서 끝나는 팔은 닿을 때까지 늘이고(막히면 잘라 낸다). 한 칸 트인 자리(대문 자리)에는 대문과 두 기둥이 선다.
 */
export function fableRuns(c: SceneCtx, isStreet: (x: number, y: number) => boolean = () => false): FableRun[] {
  const { W, H } = c;
  const out: FableRun[] = [];
  const families = [...new Set(c.runCells.map((r) => r.family))];
  const owner = new Map<string, string>();
  for (const r of c.runCells) for (const q of r.cells) {
    if (!c.inside(q.x, q.y) || owner.has(key(q.x, q.y))) continue;
    if (c.doorFront(q.x, q.y)) { c.openings.add(key(q.x, q.y)); if (c.at(q.x, q.y) === Occ.Wall) c.occ[q.y * W + q.x] = Occ.Walk; continue; }   // 문 앞 칸은 담이 막지 않는다(트인 자리)
    owner.set(key(q.x, q.y), r.family);
  }
  for (const b of c.placed) for (const d of b.doors) c.openings.add(key(b.x + d, b.foot + 1));
  const has = (x: number, y: number) => owner.has(key(x, y));
  const solid = (x: number, y: number) => !c.inside(x, y) || c.at(x, y) === Occ.Bldg || c.at(x, y) === Occ.Slit || c.at(x, y) === Occ.Road || c.at(x, y) === Occ.Water || (c.at(x, y) === Occ.Wall && !has(x, y));   // 먼저 선 난간(다리)도 닿는 곳
  const free = (x: number, y: number) => c.inside(x, y) && !has(x, y) && !c.openings.has(key(x, y)) && (c.at(x, y) === Occ.Lot || c.at(x, y) === Occ.Walk) && !c.drawn[y * W + x];
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
  const deg = (x: number, y: number) => DIRS.filter(([dx, dy]) => has(x + dx, y + dy)).length;
  const gateAt = new Set(c.gates.map((g) => key(g.x, g.y)));
  const kakiCell = new Set<string>();
  for (const k of c.kaki) for (let yy = k.y; yy < k.y + k.h; yy++) for (let xx = k.x; xx < k.x + k.w; xx++) kakiCell.add(key(xx, yy));
  /** 끝 칸에서 줄이 뻗는 방향 너머가 닿아 있는가: 막힌 칸(건물·길·물·지도 끝) 또는 바닥 가족이 바뀌는 칸(필지 끝). */
  const attached = (x: number, y: number, dx: number, dy: number) => solid(x + dx, y + dy) || has(x + dx, y + dy) || isStreet(x + dx, y + dy) || gateAt.has(key(x + dx, y + dy)) || c.openings.has(key(x + dx, y + dy))
    || (dy !== 0 && (kakiCell.has(key(x - 1, y)) || kakiCell.has(key(x + 1, y))));   // 세로 줄의 끝이 집 앞 담 키트 옆에 닿았다(모서리)
  // 지도 맨 윗줄의 가로 줄은 윗칸(갓돌 칸)이 지도 밖이다 — 짓지 않는다.
  for (const k of [...owner.keys()]) { const [x, y] = k.split(",").map(Number) as [number, number]; if (y === 0 && !has(x, 1)) { owner.delete(k); c.occ[x] = Occ.Lot; } }
  // 1) 허공에서 끝나는 팔을 늘이거나 잘라 낸다
  for (let pass = 0; pass < 64; pass++) {
    let changed = false;
    for (const k of [...owner.keys()]) {
      const [x, y] = k.split(",").map(Number) as [number, number];
      if (!owner.has(k)) continue;
      const nb = DIRS.filter(([dx, dy]) => has(x + dx, y + dy));
      if (nb.length > 1) continue;
      const fam = owner.get(k)!;
      // 끝 칸: 이웃이 하나면 그 반대쪽으로, 외톨이면 가로 양쪽으로 본다
      const outs = nb.length === 1 ? [[-nb[0]![0], -nb[0]![1]] as const] : [[-1, 0] as const, [1, 0] as const];
      for (const [dx, dy] of outs) {
        if (attached(x, y, dx, dy)) continue;
        // 늘이기: 닿을 때까지(가로 6칸·세로 14칸까지)
        const path: [number, number][] = [];
        let cx = x + dx, cy = y + dy, ok = false;
        for (let n = 0; n < (dx ? 6 : 14) && free(cx, cy); n++) { path.push([cx, cy]); if (attached(cx, cy, dx, dy)) { ok = true; break; } cx += dx; cy += dy; }
        if (ok) { for (const [px, py] of path) { owner.set(key(px, py), fam); c.occ[py * W + px] = Occ.Wall; } changed = true; }
        else { owner.delete(k); c.occ[y * W + x] = Occ.Lot; changed = true; break; }   // 못 닿는 끝 칸은 잘라 낸다(다음 바퀴에서 그 안쪽 칸을 다시 본다)
      }
    }
    if (!changed) break;
  }
  // 2) 가족마다 조각을 놓는다
  const upperOwned = new Set<string>();
  for (const family of families) {
    const run = STREET_RUNS[family];
    if (!run) continue;
    const mine = [...owner.entries()].filter(([, f]) => f === family).map(([k]) => k.split(",").map(Number) as [number, number]);
    if (!mine.length) continue;
    const inFam = (x: number, y: number) => owner.get(key(x, y)) === family;
    const cx = mine.reduce((a, q) => a + q[0], 0) / mine.length;
    const gates: { x: number; y: number }[] = [], loose: { x: number; y: number }[] = [];
    const hor: { x: number; y: number; name: string }[] = [], ver: { x: number; y: number; name: string }[] = [];
    for (const [x, y] of mine) {
      const n = inFam(x, y - 1), e = inFam(x + 1, y), s = inFam(x, y + 1), w = inFam(x - 1, y);
      const vertical = (n || s) && !e && !w;
      if (vertical && run.sideL) { ver.push({ x, y, name: x <= cx ? run.sideL : run.sideR ?? run.sideL }); continue; }
      let name = run.mid;
      if (e && !w && s && run.nw) name = run.nw;
      else if (w && !e && s && run.ne) name = run.ne;
      else if (e && !w && n && run.sw) name = run.sw;
      else if (w && !e && n && run.se) name = run.se;
      else if (e && !w && !n && !s) name = solid(x - 1, y) || has(x - 1, y) ? run.mid : run.endL;
      else if (w && !e && !n && !s) name = solid(x + 1, y) || has(x + 1, y) ? run.mid : run.endR;
      else if (e && w && run.mids.length && (x * 13 + y * 7 + c.seed) % 5 === 0) name = run.mids[(x + y) % run.mids.length]!;
      if (!n && !s && !e && !w) { if (!attached(x, y, -1, 0) && !attached(x, y, 1, 0)) loose.push({ x, y }); }
      hor.push({ x, y, name });
    }
    // 대문: 한 칸 트인 자리 양옆이 같은 가족의 가로 줄 칸이면 기둥·문·기둥
    if (run.gate) for (const g of c.gates) {
      const l = hor.find((q) => q.x === g.x - 1 && q.y === g.y), r = hor.find((q) => q.x === g.x + 1 && q.y === g.y);
      if (!l || !r || inFam(g.x, g.y)) continue;
      l.name = run.gate[0]; r.name = run.gate[2];
      hor.push({ x: g.x, y: g.y, name: run.gate[1] });
      gates.push({ x: g.x, y: g.y });
    }
    for (const q of hor) {
      const p = STREET_PIECES[q.name];
      if (!p || q.y - p.h + 1 < 0) continue;
      c.stStamp(q.name, q.x, q.y);
      if (q.name === run.gate?.[1]) c.occ[q.y * W + q.x] = Occ.Walk;        // 대문 칸은 지나다닌다
      for (let k = 1; k < p.h; k++) upperOwned.add(key(q.x, q.y - k));
    }
    for (const q of ver) if (!upperOwned.has(key(q.x, q.y)) && STREET_PIECES[q.name]) c.stStamp(q.name, q.x, q.y);
    // 붙지 못한 끝이 남았는가(검사용)
    for (const [x, y] of mine) {
      const nb = DIRS.filter(([dx, dy]) => has(x + dx, y + dy));   // 다른 가족의 줄과 이어진 것도 이어진 것이다(담이 산울타리로 바뀌는 모퉁이)
      if (nb.length === 1 && !attached(x, y, -nb[0]![0], -nb[0]![1])) loose.push({ x, y });
    }
    out.push({ family, cells: mine.map(([x, y]) => ({ x, y })), gates, loose });
  }
  void H; void deg;
  return out;
}

// ───────────────────────── 재료가 만나는 자리 ─────────────────────────
type Border = "kerb" | "sett" | "turf" | "gutter";
/** a 칸이 b 가족과 맞닿을 때 a 칸에 놓을 테(없으면 undefined). */
export function borderBetween(a: GroundFamily, b: GroundFamily, bRoad: boolean): Border | undefined {
  if (a === b || a === "none" || b === "none" || a === "water" || b === "water" || a === "tarmac" || a === "lane" || a === "laneside") return undefined;
  if (b === "laneside") return undefined;                                                   // 길가 띠는 제 배수로를 갖고 있다
  if (a === "pave") return b === "tarmac" && bRoad ? "kerb" : b === "lane" ? "gutter" : undefined;
  if (a === "lawn") return "turf";
  if (b === "lane") return "gutter";                                                        // 생활도로 옆 필지: 콘크리트 배수로 테
  if (b === "pave" || b === "tarmac") return "sett";
  if (a === "forecourt") return b === "lawn" ? undefined : "sett";
  if (a === "earth") return b === "alley" ? "sett" : undefined;
  return undefined;                                                                         // alley 옆 forecourt·earth·lawn 은 그쪽 칸이 테를 갖는다
}
const SIDES = [["n", 0, -1], ["e", 1, 0], ["s", 0, 1], ["w", -1, 0]] as const;
/** 바닥 가족이 바뀌는 모든 이음에 테 조각을 놓는다: 보도↔차도 = 연석, 필지 바닥↔보도·차도·다른 필지 바닥 = 테 돌, 잔디↔다른 바닥 = 잔디 가장자리. */
export function fableBorders(c: SceneCtx, taken: ReadonlyMap<string, string>): Set<string> {
  const { W, H } = c;
  const done = new Set<string>();
  const covered = (x: number, y: number) => { const v = c.at(x, y); return v === Occ.Bldg || v === Occ.Wall; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (covered(x, y) || taken.has(key(x, y))) continue;
    const a = c.famAt(x, y);
    let kind: Border | undefined, bits = "";
    for (const [s, dx, dy] of SIDES) {
      if (!c.inside(x + dx, y + dy) || covered(x + dx, y + dy)) continue;
      const k = borderBetween(a, c.famAt(x + dx, y + dy), c.at(x + dx, y + dy) === Occ.Road);
      if (k) { kind ??= k; if (k === kind) bits += s; }
    }
    if (!kind) {
      // 안쪽 모퉁이(연석): 대각선만 차도
      if (a === "pave") for (const [s, dx, dy] of [["ne", 1, -1], ["se", 1, 1], ["sw", -1, 1], ["nw", -1, -1]] as const) {
        if (c.at(x + dx, y + dy) === Occ.Road && c.famAt(x + dx, y + dy) === "tarmac" && c.famAt(x + dx, y) === "pave" && c.famAt(x, y + dy) === "pave") { const name = `kerb-i-${s}`; if (STREET_PIECES[name]) { c.stStamp(name, x, y); done.add(key(x, y)); } break; }
      }
      continue;
    }
    const name = `${kind}-${bits}`;
    if (STREET_PIECES[name]) { c.stStamp(name, x, y); done.add(key(x, y)); }
  }
  return done;
}

/** 건물 발치 그림자: 건물 벽 바로 아래 칸에 그늘 띠(그 칸 바닥 가족의 어두운 단) — 3층에 찍는다(소품은 4층이라 겹치지 않는다). */
export function fableShades(c: SceneCtx): void {
  for (const p of c.placed) {
    const ml = p.kit?.ml ?? 0, mr = p.kit?.mr ?? 0, y = p.foot + 1;
    for (let x = p.x + ml; x < p.x + p.w - mr; x++) {
      if (!c.inside(x, y) || c.at(x, y) === Occ.Wall || c.at(x, y) === Occ.Bldg || c.famAt(x, y) === "water" || !STREET_PIECES["shade-n"]) continue;
      c.late.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/jp-st-shade-n--${c.famAt(x, y)}`, mapId: c.mapId, x, y }, optional: true, note: "shade" });
    }
  }
}

// ───────────────────────── 아케이드(입면) ─────────────────────────
/**
 * 상점가 아케이드: 세로 시장 길의 양 끝에 정면에서 본 입구 아치(기둥 둘 + 간판 들보), 큰길 가게 줄 정면 위로는 이어진 차양 띠.
 * 길 위를 덮는 평면도 지붕은 없다.
 */
export function fableArcade(c: SceneCtx, L: SceneLayout): void {
  const { W } = c;
  for (const v of L.vstreets) {
    if (!v.arcade || v.w < 4 || !STREET_PIECES["arch-l"]) continue;
    for (const b of L.bands) if (b.index >= v.from && b.index <= v.to) {
      const y0 = b.index === 0 ? 0 : (L.bands[b.index - 1]!.front.sA ?? b.top), y1 = b.front.type === "edge" ? b.front.y0 : (b.front.nK ?? b.foot);
      c.fillFamily(v.x, y0, v.w, y1 - y0 + 1, "pave");
      c.mark(v.x, y0, v.w, y1 - y0 + 1, Occ.Walk);
      for (const foot of [y1, y0 + 3]) {                                    // 남쪽 입구(큰길 쪽) · 북쪽 입구
        if (foot - 3 < 0 || foot > y1 || (foot === y0 + 3 && (y0 === 0 || y1 - y0 < 9))) continue;
        const signX = v.x + Math.floor((v.w - 2) / 2);
        const top = foot - STREET_PIECES["arch-l"]!.h + 1, under = (n: string) => top + STREET_PIECES[n]!.h - 1;   // 들보·간판은 기둥 머리에 맞춘다
        if (top < 0) continue;
        c.stStamp("arch-l", v.x, foot, { late: true }); c.stStamp("arch-r", v.x + v.w - 1, foot, { late: true });
        for (let x = v.x + 1; x < v.x + v.w - 1; x++) { if (x === signX) { c.stStamp("arch-sign", x, under("arch-sign"), { late: true }); x++; } else c.stStamp("arch-beam", x, under("arch-beam"), { late: true }); }
        c.mark(v.x + 1, foot - 3, v.w - 2, 4, Occ.Walk);                    // 기둥 사이는 지나다닌다
      }
    }
    c.scenesUsed.add("shotengai");
  }
  // 차양 띠: 아케이드 종류의 맨 위 띠 가게 줄 — 건물 정면 위(발 줄에서 두 칸 위)로 이어지고, 줄 끝은 끝 조각, 네댓 칸마다 기둥.
  if (c.kind.cross !== "arcade" || !STREET_PIECES["canopy-a"]) return;
  const mids = ["canopy-a", "canopy-b", "canopy-a", "canopy-c"];
  const byFoot = new Map<number, typeof c.placed[number][]>();
  // 새 건물(jp-bldg-f-*)은 차양·간판이 그림에 들어 있다 — 차양 띠를 얹지 않는다.
  for (const p of c.placed) if (p.kit && !p.kit.id.startsWith("jp-bldg-f-") && p.kit.cat !== "house" && p.kit.cat !== "apartment" && p.h >= 4) byFoot.set(p.foot, [...(byFoot.get(p.foot) ?? []), p]);
  for (const [foot, row] of byFoot) {
    const cols = new Uint8Array(W);
    for (const p of row) for (let x = p.x + (p.kit?.ml ?? 0); x < p.x + p.w - (p.kit?.mr ?? 0); x++) cols[x] = 1;
    for (let x = 0; x < W; x++) {
      if (!cols[x]) continue;
      let e = x; while (e + 1 < W && cols[e + 1]) e++;
      if (e - x + 1 >= 4) for (let k = x; k <= e; k++) {
        const name = k === x ? "canopy-l" : k === e ? "canopy-r" : mids[(k - x) % mids.length]!;
        const p = STREET_PIECES[name]!;
        c.late.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/jp-st-${name}`, mapId: c.mapId, x: k, y: foot - 2 }, optional: true, note: "prop4" });
        c.stPlaced.push({ name, look: "canopy", x: k, y: foot - 2, w: 1, h: p.h, anchor: "facade", repeat: true });
      }
      x = e;
    }
  }
}

// ───────────────────────── 꾸밈(앵커 등급대로) ─────────────────────────
/** 옛 줄 꾸밈이 못 채운 자리를 새 조각의 등급대로 채운다: 가게 앞(벽), 연석 줄(낮은 것·키 큰 것은 북쪽 연석만), 집 마당(필지), 광장. */
export function fableDress(c: SceneCtx, L: SceneLayout): void {
  const { W, rng, kind } = c;
  const spill = streetTagged("spill"), front = streetTagged("housefront"), kerbLow = streetTagged("kerb-low"), kerbTall = streetTagged("kerb-tall"), trees = streetTagged("tree"), yard = streetTagged("yard"), critters = streetTagged("critter"), facade = streetTagged("facade");
  for (const p of c.placed) {
    if (!p.kit) continue;
    const house = p.kit.cat === "house" || p.kit.cat === "apartment";
    const x0 = p.x + p.kit.ml, x1 = p.x + p.w - p.kit.mr, y = p.foot + 1;
    const door = (x: number, w: number) => p.doors.some((d) => p.x + d >= x && p.x + d < x + w);
    for (let x = x0; x < x1; x++) {
      // 새 건물은 가게 앞 물건이 정면 그림에 들어 있다 — 같은 것을 또 늘어놓지 않는다(드문드문만)
      if (rng() >= (house ? 0.3 : kind.density.spill * (p.kit.id.startsWith("jp-bldg-f-") ? 0.35 : 1))) continue;
      const pool = (house ? front : spill).filter((n) => !door(x, STREET_PIECES[n]!.w) && x + STREET_PIECES[n]!.w <= x1);
      const id = c.stPut(pool, x, y);
      if (id) { c.scenesUsed.add(house ? "jutaku" : "spill"); x += STREET_PIECES[id]!.w; }
    }
    if (house) {
      // 마당: 집 양옆과 담 안쪽 줄
      for (const xx of [p.x - 2, p.x - 1, p.x + p.w, p.x + p.w + 1]) if (rng() < 0.5) c.stPut(yard, xx, p.foot);
      if (rng() < 0.6) for (let t = 0; t < 4; t++) { const xx = x0 + Math.floor(rng() * Math.max(1, x1 - x0)); if (!door(xx, 1) && c.stPut(facade, xx, p.foot - 1, { stack: true })) break; }
    }
  }
  for (const b of L.bands) {
    const s = b.front;
    if (s.type !== "kerb" && s.type !== "river" && s.type !== "lane") continue;
    const vs = touching(L, b), inV = (x: number, pad = 0) => vs.some((v) => x >= v.x - pad && x < v.x + v.w + pad);
    if (s.type === "lane") {
      // 생활도로의 길가 띠: 전봇대·가로등·표지가 드문드문(윗부분은 북쪽 필지 위에 온다), 사이사이 낮은 것
      for (let x = 3 + Math.floor(rng() * 5); x < W - 2; x += 5 + Math.floor(rng() * 5)) if (!inV(x, 1)) c.stPut(rng() < 0.6 ? kerbTall : kerbLow, x, s.road0, { lax: true });
      continue;
    }
    if (s.nK !== undefined && s.type === "kerb") {
      // 북쪽 연석: 키 큰 것(가로등·전봇대·표지·가로수)의 윗부분은 보도와 필지 위에 온다
      for (let x = 2 + Math.floor(rng() * 4); x < W - 2; x += 3 + Math.floor(rng() * 4)) {
        if (inV(x, 1)) continue;
        const r = rng();
        if (r < 0.3) { if (c.stPut(trees, x, s.nK)) x += 2; }
        else if (r < 0.65) c.stPut(kerbTall, x, s.nK);
        else if (r < 0.65 + kind.density.kerb) c.stPut(kerbLow, x, s.nK);
      }
    }
    if (s.sA !== undefined && s.type === "kerb") for (let x = 1 + Math.floor(rng() * 4); x < W - 2; x += 3 + Math.floor(rng() * 5)) if (!inV(x, 1) && rng() < kind.density.south + 0.2) c.stPut(kerbLow, x, s.sA, { lax: true });   // 얕은 남쪽 보도: 낮은 것만
  }
  for (let t = 0, n = 0; t < 60 && n < 3 + Math.floor(W / 20); t++) { const x = 1 + Math.floor(rng() * (W - 2)), y = 2 + Math.floor(rng() * (c.H - 3)); if (c.at(x, y) === Occ.Lot && c.famAt(x, y) !== "tarmac" && c.famAt(x, y) !== "water" && c.stPut(critters, x, y)) n++; }
}

/**
 * 빈 띠 메우기: 서 있는 것(건물·소품·담)에서 두 칸 넘게 떨어진 필지 칸이 남으면 그 바닥에 맞는 것을 세운다 —
 * 흙·잔디에는 마당 나무와 정원 것, 포장에는 광장 것(돌 벤치·음수대). 걷는 줄(Walk)은 건드리지 않는다.
 */
export function fableFill(c: SceneCtx): void {
  const { W, H } = c;
  // 포장 위 빈 자리: 광장 것(돌 벤치·음수대)이 먼저, 그다음 나무 구덩이의 가로수(나무는 되풀이해도 된다)
  const soft = [...streetTagged("gardentree"), ...streetTagged("garden")], hard = [...streetTagged("plaza"), ...streetTagged("park").filter((n) => STREET_PIECES[n]!.w === 1 || n === "bench-stone")], pitTrees = streetTagged("tree"), gtrees = streetTagged("gardentree"), kerbLow = streetTagged("kerb-low"), critters = streetTagged("critter");
  const thing = new Uint8Array(W * H);
  const mark = (x0: number, y0: number, w: number, h: number) => { for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) thing[y * W + x] = 1; };
  for (const p of c.placed) mark(p.x, p.y, p.w, p.foot - p.y + 1);
  for (const p of c.stPlaced) if (STREET_PIECES[p.name]?.layer !== "floor" && STREET_PIECES[p.name]?.layer !== "ground") mark(p.x, p.y, p.w, p.h);
  const dead = (x: number, y: number) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && thing[yy * W + xx]) return false; }
    return true;
  };
  for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
    if (!dead(x, y)) continue;
    const f = c.famAt(x, y);
    // 보도: 길게 비어 있는 자리 곁의 연석 줄에 낮은 가로 시설(볼라드·화분·소화전 따위 — 같은 그림은 20×15 창에 한 번), 그것도 다 썼으면 비둘기·고양이
    if (c.at(x, y) === Occ.Walk) { if (f === "pave") { const n = [0, -1, 1, -2, 2].reduce<string | undefined>((hit, dy) => hit ?? c.stPut(kerbLow, x, y + dy, { lax: true }), undefined) ?? c.stPut(critters, x, y, { lax: true }); if (n) { const p = STREET_PIECES[n]!, q = c.stPlaced[c.stPlaced.length - 1]!; mark(q.x, q.y, p.w, p.h); } } continue; }
    if (c.at(x, y) !== Occ.Lot) continue;
    const pool = f === "earth" || f === "lawn" ? soft : f === "pave" || f === "forecourt" || f === "alley" ? hard : [];
    // 흙·잔디: 정원 것이 다 떨어졌거나(같은 그림은 20×15 창에 한 번) 윗줄이 막혀 못 서면, 마당 나무를 두 줄 아래 발치로 세운다(나무는 되풀이해도 된다).
    const name = (pool.length ? c.stPut(pool, x, y) : undefined) ?? (pool === hard ? c.stPut(pitTrees, x - 1, y) ?? c.stPut(pitTrees, x, y) : undefined)
      ?? (pool === soft ? c.stPut(gtrees, x, y + 2) ?? c.stPut(gtrees, x - 1, y + 2) ?? c.stPut(gtrees, x, y + 1) : undefined);
    if (name) { const p = STREET_PIECES[name]!, q = c.stPlaced[c.stPlaced.length - 1]!; mark(q.x, q.y, p.w, p.h); }
  }
}

/** 바닥 덧조각(드문드문): 잔디·흙·아스팔트의 한 칸 무늬, 맨홀, 큰길 가운데 줄의 바퀴 띠. 다른 바닥 조각이 있는 칸은 건너뛴다. */
export function fableAccents(c: SceneCtx, taken: ReadonlySet<string>): void {
  const { W, H, rng } = c;
  const pools: Partial<Record<GroundFamily, string[]>> = { lawn: streetTagged("accent-lawn"), earth: streetTagged("accent-earth"), tarmac: streetTagged("accent-tarmac"), lane: streetTagged("accent-lane") };
  const used = new Set<string>();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const f = c.famAt(x, y), pool = pools[f];
    if (!pool?.length || taken.has(key(x, y)) || c.drawn[y * W + x] || (f !== "tarmac" && f !== "lane" && c.at(x, y) !== Occ.Lot && c.at(x, y) !== Occ.Walk)) continue;
    if (rng() >= (f === "tarmac" ? 0.07 : f === "lane" ? 0.04 : 0.1) || used.has(key(x - 1, y)) || used.has(key(x, y - 1)) || used.has(key(x + 1, y - 1)) || used.has(key(x - 1, y - 1))) continue;
    const fits = pool.filter((n) => c.stFits(n, x, y));
    if (!fits.length) continue;
    const name = fits[Math.floor(rng() * fits.length)]!;
    c.stStamp(name, x, y);
    for (let k = 0; k < STREET_PIECES[name]!.w; k++) used.add(key(x + k, y));
  }
}

/** 가족 표에서 바닥 단계를 만든다(가족마다 줄 단위 사각형 목록). 실행기가 가족의 바닥 무늬 키트를 읽어 1층에 찍는다. */
export function fableGround(c: SceneCtx): JpStreetStep[] {
  const { W, H } = c;
  const steps: JpStreetStep[] = [];
  for (let f = 1; f < GROUND_FAMILIES.length; f++) {
    const rects: { x: number; y: number; w: number; h: number }[] = [];
    const open = new Map<string, { x: number; y: number; w: number; h: number }>();
    for (let y = 0; y < H; y++) {
      const next = new Map<string, { x: number; y: number; w: number; h: number }>();
      for (let x = 0; x < W; x++) {
        if (c.gfam[y * W + x] !== f) continue;
        let e = x; while (e + 1 < W && c.gfam[y * W + e + 1] === f) e++;
        const k = `${x}:${e}`, prev = open.get(k);
        if (prev && prev.y + prev.h === y) { prev.h++; next.set(k, prev); } else { const r = { x, y, w: e - x + 1, h: 1 }; rects.push(r); next.set(k, r); }
        x = e;
      }
      open.clear(); for (const [k, r] of next) open.set(k, r);
    }
    if (rects.length) steps.push({ tool: "ground_cells", args: { mapId: c.mapId, family: GROUND_FAMILIES[f], rects }, optional: true, note: "ground" });
  }
  return steps;
}

// ───────────────────────── 검사 ─────────────────────────
/** 새 거리 계획의 규칙 검사 — 어긴 것마다 한 줄. 빈 목록이면 통과. 테스트와 측정 스크립트가 여러 씨앗으로 돌린다. */
export function auditFable(f: FableInfo): string[] {
  const { W, H, occ, gfam } = f;
  const out: string[] = [];
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? occ[y * W + x]! : Occ.Wall);
  const fam = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? GROUND_FAMILIES[gfam[y * W + x]!]! : "none");
  const solid = (v: number) => v === Occ.Bldg || v === Occ.Wall || v === Occ.Slit;
  const standing = f.placed.filter((p) => STREET_PIECES[p.name]?.layer !== "floor" && STREET_PIECES[p.name]?.layer !== "ground");
  for (const p of f.placed) {
    const piece = STREET_PIECES[p.name];
    if (!piece) { out.push(`unknown piece ${p.name}`); continue; }
    // 지도 끝에 잘린 조각
    if (p.x < 0 || p.y < 0 || p.x + p.w > W || p.y + p.h > H) out.push(`cut-by-edge ${p.name} (${p.x},${p.y})`);
    // 차도 칸을 덮는 조각(차·노면 표시·재료 테 제외 — 테는 바닥의 일부다)
    if (p.anchor !== "road" && !(piece.layer === "floor" && (piece.tags.includes("road") || piece.tags.includes("border"))) && p.anchor !== "run") for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) if (at(x, y) === Occ.Road) { out.push(`on-carriageway ${p.name} (${x},${y})`); y = H; break; }
    // 앵커 자리
    const foot = p.y + p.h - 1, cols = Array.from({ length: p.w }, (_, k) => p.x + k);
    if (p.anchor === "wall" && cols.filter((x) => solid(at(x, foot - 1))).length * 2 < p.w) out.push(`anchor-wall ${p.name} (${p.x},${foot})`);
    if (p.anchor === "kerb" && !(cols.every((x) => fam(x, foot) === "pave" || fam(x, foot) === "laneside") && cols.some((x) => at(x, foot + 1) === Occ.Road || at(x, foot - 1) === Occ.Road))) out.push(`anchor-kerb ${p.name} (${p.x},${foot})`);
    if (p.anchor === "road" && !cols.every((x) => at(x, foot) === Occ.Road)) out.push(`anchor-road ${p.name} (${p.x},${foot})`);
    if (p.anchor === "water" && !cols.every((x) => fam(x, foot) === "water")) out.push(`anchor-water ${p.name} (${p.x},${foot})`);
    if ((p.anchor === "lot" || p.anchor === "open") && !cols.every((x) => ["forecourt", "earth", "lawn", "alley", "pave"].includes(fam(x, foot)))) out.push(`anchor-lot ${p.name} (${p.x},${foot})`);
  }
  // 겹친 조각(서 있는 것끼리 — 경계 줄의 윗칸과 차양·차 위 카포트는 제외)
  const grid = new Map<string, string>();
  for (const p of standing) {
    if (p.anchor === "run" || p.anchor === "facade" || STREET_PIECES[p.name]?.tags.includes("cover")) continue;
    for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) { const k = key(x, y), q = grid.get(k); if (q && q !== p.name + p.x) { out.push(`overlap ${p.name} × ${q} (${x},${y})`); } grid.set(k, p.name + p.x); }
  }
  // 같은 그림이 20×15 창에 두 번
  for (let i = 0; i < f.placed.length; i++) for (let j = i + 1; j < f.placed.length; j++) {
    const a = f.placed[i]!, b = f.placed[j]!;
    if (a.repeat || b.repeat || a.look !== b.look) continue;
    if (Math.abs(a.x - b.x) < 20 && Math.abs(a.y - b.y) < 15) out.push(`repeat-in-window ${a.look} (${a.x},${a.y}) (${b.x},${b.y})`);
  }
  // 경계 줄: 허공에서 끝나는 끝
  for (const r of f.runs) for (const q of r.loose) out.push(`loose-run-end ${r.family} (${q.x},${q.y})`);
  // 재료가 만나는 자리: 테가 필요한 이음마다 테 조각(또는 건물·담이 덮는다)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (solid(at(x, y))) continue;
    for (const [, dx, dy] of SIDES) {
      if (x + dx < 0 || y + dy < 0 || x + dx >= W || y + dy >= H || solid(at(x + dx, y + dy))) continue;
      if (borderBetween(fam(x, y), fam(x + dx, y + dy), at(x + dx, y + dy) === Occ.Road) && !f.borders.has(key(x, y)) && !f.marks.has(key(x, y))) { out.push(`bare-seam ${fam(x, y)}|${fam(x + dx, y + dy)} (${x},${y})`); break; }
    }
  }
  // 차선: 등급대로, 교차로·횡단보도 밖에서는 끊기지 않는다
  for (const r of f.roads) {
    for (let k = r.from; k <= r.to; k++) for (let j = r.a; j <= r.b; j++) {
      const x = r.dir === "h" ? k : j, y = r.dir === "h" ? j : k;
      if (at(x, y) !== Occ.Road || fam(x, y) !== "tarmac" || f.crossings.has(key(x, y))) continue;
      const m = f.marks.get(key(x, y)) ?? "";
      const edge = j === r.a || j === r.b, n = r.b - r.a + 1, centre = r.cls === "two" && j === r.a + n / 2 - 1;
      if (r.cls === "alley") { if (m.startsWith("mark-edge") || m.startsWith("mark-centre")) out.push(`alley-marking (${x},${y})`); continue; }
      if (edge && !m.startsWith("mark-edge")) out.push(`edge-line-gap (${x},${y})`);
      if (centre && !edge && !m.startsWith("mark-centre")) out.push(`centre-line-gap (${x},${y})`);
      if (r.cls === "one" && m.startsWith("mark-centre")) out.push(`centre-line-on-one-lane (${x},${y})`);
    }
  }
  // 집 필지 앞줄의 담·대문 키트: 담은 허공에서 끝나지 않는다(끝이 다른 담·대문·집 옆·줄·길·지도 끝에 닿는다), 필지에 대문 하나, 대문은 현관 앞이고 현관까지 걷는 칸이 이어진다, 한 필지 안의 담은 한 종류.
  const kakiAt = new Set<string>();
  for (const k of f.kaki) for (let x = k.x; x < k.x + k.w; x++) kakiAt.add(key(x, k.y + k.h - 1));
  const STREETISH = new Set(["pave", "forecourt", "tarmac", "alley", "lane", "laneside", "water"]);
  const lots = new Map<number, SceneKaki[]>();
  for (const k of f.kaki) {
    lots.set(k.lot, [...(lots.get(k.lot) ?? []), k]);
    const foot = k.y + k.h - 1;
    for (const nx of [k.x - 1, k.x + k.w]) {
      if (kakiAt.has(key(nx, foot))) continue;
      const v = at(nx, foot);
      if (!(solid(v) || v === Occ.Road || v === Occ.Water || STREETISH.has(fam(nx, foot)))) out.push(`kaki-loose-end ${k.id} (${nx},${foot})`);
    }
    if (k.gate) {
      const mid = k.x + 1;
      if (!k.door || k.door.x !== mid) out.push(`kaki-gate-not-at-door (${mid},${foot})`);
      else for (let y = k.door.y + 1; y <= foot; y++) if (at(mid, y) !== Occ.Walk) out.push(`kaki-gate-walk-blocked (${mid},${y})`);
    }
  }
  for (const [lot, ks] of lots) {
    if (ks.filter((k) => k.gate).length !== 1) out.push(`kaki-gate-count lot ${lot}: ${ks.filter((k) => k.gate).length}`);
    if (new Set(ks.filter((k) => !k.gate).map((k) => k.id)).size > 1) out.push(`kaki-mixed-lot lot ${lot}`);
  }
  return out;
}

/** 계획의 마지막 단계: 길 표시 → 경계 줄 → 테 → 덧조각 → 건물 그림자 → 바닥. 검사에 쓸 정보를 돌려준다. */
export function fableFinish(c: SceneCtx, L: SceneLayout): { info: FableInfo; ground: JpStreetStep[] } {
  const roads = roadsOf(c, L);
  const crossings = new Set<string>(), marks = new Map<string, string>();
  fableArcade(c, L);
  fableMarks(c, L, roads, crossings, marks);
  fableDress(c, L);
  // 건물보다 먼저 놓인 것(강가 산책로의 벤치·말뚝)이 문 앞 칸에 서 있으면 치운다 — 모든 문은 걸어서 닿는다.
  for (let i = c.stPlaced.length - 1; i >= 0; i--) {
    const p = c.stPlaced[i]!, piece = STREET_PIECES[p.name];
    if (!piece || piece.layer === "floor" || piece.layer === "ground" || p.anchor === "facade" || p.anchor === "road" || p.anchor === "water" || p.anchor === "run") continue;
    for (let k = 0; k < p.w; k++) if (c.doorFront(p.x + k, p.y + p.h - 1) || c.doorFront(p.x + k, p.y + p.h - 2)) { c.stRemove(i); break; }
  }
  // 길의 줄·열(필지 끝): 줄의 끝이 길에 닿으면 붙은 것이다
  const streetRow = new Uint8Array(c.H);
  for (const b of L.bands) for (let y = b.front.y0; y <= Math.min(c.H - 1, b.front.end); y++) streetRow[y] = 1;
  const runs = fableRuns(c, (x, y) => (y >= 0 && y < c.H && streetRow[y] === 1) || L.vstreets.some((v) => x >= v.x && x < v.x + v.w && y >= v.y0 && y <= v.y1));
  // 줄을 지은 뒤: 기댄 담이 잘려 나간 «벽 앞» 소품은 치운다(벽 없이 서 있는 것이 남지 않게).
  const solid = (v: number) => v === Occ.Bldg || v === Occ.Wall || v === Occ.Slit;
  for (let i = c.stPlaced.length - 1; i >= 0; i--) {
    const p = c.stPlaced[i]!;
    if (p.anchor !== "wall") continue;
    const foot = p.y + p.h - 1;
    let n = 0;
    for (let x = p.x; x < p.x + p.w; x++) if (solid(c.at(x, foot - 1))) n++;
    if (n * 2 < p.w) c.stRemove(i);
  }
  // 세운 뒤에 바닥이 바뀐 «필지 안» 소품(마당 것이 섰던 자리에 주차장·길이 깔렸다)은 치운다.
  const LOT_FAMS = ["forecourt", "earth", "lawn", "alley", "pave"];
  for (let i = c.stPlaced.length - 1; i >= 0; i--) {
    const p = c.stPlaced[i]!;
    if (p.anchor !== "lot" && p.anchor !== "open") continue;
    const foot = p.y + p.h - 1;
    for (let x = p.x; x < p.x + p.w; x++) if (!LOT_FAMS.includes(c.famAt(x, foot))) { c.stRemove(i); break; }
  }
  fableFill(c);
  const borders = fableBorders(c, marks);
  fableAccents(c, new Set([...borders, ...marks.keys()]));
  fableShades(c);
  const ground = fableGround(c);
  return { ground, info: { W: c.W, H: c.H, occ: c.occ, gfam: c.gfam, placed: c.stPlaced, runs, roads, crossings, borders, marks, kaki: c.kaki } };
}
