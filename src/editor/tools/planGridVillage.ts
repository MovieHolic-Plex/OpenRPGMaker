// editor/tools/planGridVillage.ts
// 도면 코드(ai/planGrid.ts) → 코드 지형 + 칸 배치 마을(bboxVillage.ts). 도안 칸 = 맵 칸. 구역 높이·물이 지형이 되고, 길·광장·집·밭·숲·소품은 도안 자리 그대로 놓는다.
// 마을 규칙(계단은 남북으로만·정해진 모양, 집 문앞은 같은 단의 길, 길 그물은 하나, 빈 풀밭 55% 이하)을 그림은 모르므로 여기서 지형을 조금 다듬고 길을 잇는다 — 다듬은 것은 notes 에 남긴다.
import type { PlanGrid } from "@/ai/planGrid";
import { reverseCutLength, CUT_MAX_RISE } from "@/project/relief/cutPieces";
import type { BboxVillageLayout, BboxVillageTerrain, VillageCheck, VillageKit } from "./bboxVillage";

export interface PlanVillageResult {
  readonly terrain: BboxVillageTerrain;
  readonly layout: BboxVillageLayout;
  readonly notes: string[];
  readonly missing: { name: string; x: number; y: number; w: number; h: number }[];
  readonly repair: (check: (L: BboxVillageLayout, T: BboxVillageTerrain) => VillageCheck) => { layout: BboxVillageLayout; ok: boolean; errors: string[] };
}

type Rect = { x: number; y: number; w: number; h: number };

const PROP_WORDS: readonly [RegExp, readonly string[]][] = [
  [/가판|노점|좌판|천막|stall|market/iu, ["prop-stall_veg", "prop-stall_herb_flower", "prop-stall_cheese_meat", "prop-stall_jug_bottle"]],
  [/우물|well/iu, ["prop-well_roofed"]],
  [/석상|동상|조각상|statue/iu, ["prop-statue_sage"]],
  [/기념비|비석|선돌|오벨리스크|monument|obelisk|석등|등롱/iu, ["prop-column_monument"]],
  [/가로등|등불|lamp/iu, ["prop-lamp_double", "prop-lamp_crook"]],
  [/벤치|bench/iu, ["prop-bench_wood"]],
  [/장작|woodpile|원목|통나무/iu, ["out-woodpile"]],
  [/표지판|이정표|sign/iu, ["out-signpost"]],
  [/수레|cart/iu, ["prop-veg_cart", "prop-flower_cart"]],
  [/화단|꽃밭|flower/iu, ["prop-flowerbed", "prop-flowerbox_long"]],
  [/빨래|건조대|채반|laundry|rack/iu, ["prop-laundry_rack"]],
  [/상자|궤짝|crate/iu, ["prop-crate_apple", "prop-goods_pile"]],
  [/통|barrel|장독/iu, ["prop-fish_barrel", "prop-sword_barrel"]],
  [/탁자|식탁|table/iu, ["prop-table_mugs", "prop-parasol_table"]],
  [/산울타리|덤불|hedge/iu, ["prop-hedge"]],
  [/그물|net/iu, ["prop-net_rack"]],
  [/닻|anchor/iu, ["prop-anchor_display"]],
];
const TREE_WORDS = /나무|tree|벚|소나무|전나무|고목|세계수|신목/iu;
const BOAT_WORDS = /배|보트|boat|나룻/iu;
const HOUSE_WORDS = /집|가옥|오두막|회관|상점|가게|창고|여관|대장간|제재소|방앗간|사당|신전|교회|예배당|탑|헛간|house|hall|shop|inn|mill|barn|chapel|church|tower/iu;
const FIELD_WORDS = /밭|논|농장|과수|포도|field|farm|crop|orchard/iu;

export function planToVillage(g: PlanGrid, cat: readonly VillageKit[]): PlanVillageResult {
  const notes: string[] = [], missing: PlanVillageResult["missing"] = [];
  const { cols: W, rows: H, code } = g;
  const N = W * H, idx = (x: number, y: number) => y * W + x, inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const nb4 = (c: number) => { const x = c % W, y = (c - x) / W; return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([a, b]) => inb(a!, b!)).map(([a, b]) => idx(a!, b!)); };
  const zoneOf = (c: number) => (g.zone[c]! >= 0 ? code.zones[g.zone[c]!]! : null);
  // ── 지형: 물(강 1·바다 3), 높이 ──
  const water = new Array<number>(N).fill(0), lv = new Array<number>(N).fill(-1);
  const landShare = g.land.reduce((a, v) => a + v, 0) / N;
  for (let c = 0; c < N; c += 1) {
    const z = zoneOf(c);
    if (z?.kind === "water" && !g.path[c]) water[c] = 1;
    else if (!g.land[c] && !z && landShare < 0.9) water[c] = 3;
    if (z && z.kind !== "water") lv[c] = Math.min(CUT_MAX_RISE, z.level);
  }
  if (code.zones.some((z) => z.kind === "water") ) notes.push("water zones laid as river (paths over them become plank bridges)");
  // 빈 땅·물 칸 높이: 가장 가까운 구역 높이로 채운다
  for (let q = [...Array(N).keys()].filter((c) => lv[c]! >= 0), h = 0; h < q.length; h += 1) for (const n of nb4(q[h]!)) if (lv[n]! < 0) { lv[n] = lv[q[h]!]!; q.push(n); }
  for (let c = 0; c < N; c += 1) if (lv[c]! < 0) lv[c] = 0;
  // 작은 단 조각(8칸 미만)은 둘레 높이로 메운다
  for (let pass = 0; pass < 2; pass += 1) {
    const seen = new Uint8Array(N);
    for (let s = 0; s < N; s += 1) {
      if (seen[s]) continue;
      const comp = [s]; seen[s] = 1;
      for (let h = 0; h < comp.length; h += 1) for (const n of nb4(comp[h]!)) if (!seen[n] && lv[n] === lv[s]) { seen[n] = 1; comp.push(n); }
      if (comp.length >= 8) continue;
      const around = new Map<number, number>(); for (const c of comp) for (const n of nb4(c)) if (lv[n] !== lv[s]) around.set(lv[n]!, (around.get(lv[n]!) ?? 0) + 1);
      const to = [...around].sort((a, b) => b[1] - a[1])[0]?.[0];
      if (to !== undefined) for (const c of comp) lv[c] = to;
    }
  }
  // ── 길 칸 ──
  const road = new Uint8Array(N);
  for (let c = 0; c < N; c += 1) if (g.path[c] && water[c] !== 3) road[c] = 1;
  // 입구에서 가장 가까운 맵 가장자리까지 길을 낸다
  if (code.entrance) {
    const { x, y } = code.entrance;
    const d = [y, H - 1 - y, x, W - 1 - x];
    const side = d.indexOf(Math.min(...d));
    const [dx, dy] = [[0, -1], [0, 1], [-1, 0], [1, 0]][side]!;
    for (let k = 0, cx = x, cy = y; k < Math.max(W, H) && inb(cx, cy); k += 1, cx += dx!, cy += dy!) { if (water[idx(cx, cy)] === 3) break; road[idx(cx, cy)] = 1; if (cx === 0 || cy === 0 || cx === W - 1 || cy === H - 1) break; }
  }
  // ── 높이를 넘는 길: 동서로 넘으면 낮은 쪽 칸을 높여 남북 넘기로 바꾸고, 남북 넘기에는 계단을 깎는다 ──
  for (let pass = 0; pass < 60; pass += 1) {
    let changed = false;
    for (let c = 0; c < N; c += 1) {
      if (!road[c] || water[c]) continue;
      const x = c % W;
      for (const n of [x + 1 < W ? c + 1 : -1, x > 0 ? c - 1 : -1]) {
        if (n < 0 || !road[n] || water[n] || lv[n] === lv[c]) continue;
        const lowC = lv[n]! < lv[c]! ? n : c; lv[lowC] = Math.max(lv[n]!, lv[c]!); changed = true;
      }
    }
    if (!changed) break;
  }
  const stairs: (Rect & { dir: string })[] = [];
  const stairCell = new Uint8Array(N);
  const tryStair = (x0: number, yHi: number, yLo: number): boolean => {
    const hi = lv[idx(x0, yHi)]!, lo = lv[idx(x0, yLo)]!;
    if (hi <= lo) return false;
    const north = yHi < yLo;
    const h = north ? 1 : reverseCutLength(hi - lo);
    for (const w of [3, 2]) for (const sx of [x0 - 1, x0, x0 - 2 + w]) {
      const s = north ? { x: sx, y: yLo, w, h } : { x: sx, y: yLo - h + 1, w, h };
      const hiY = north ? s.y - 1 : s.y + s.h, loY = north ? s.y + s.h : s.y - 1;
      if (s.x - 1 < 0 || s.x + w >= W || !inb(s.x, hiY) || !inb(s.x, loY) || s.y < 0) continue;
      let ok = true;
      for (let xx = s.x - 1; xx <= s.x + w && ok; xx += 1) {
        const foot = north ? s.y : s.y + s.h - 1;
        for (let yy = s.y; yy < s.y + s.h; yy += 1) if (xx >= s.x && xx < s.x + w && (lv[idx(xx, yy)] !== lo || water[idx(xx, yy)] || stairCell[idx(xx, yy)])) ok = false;
        const flank = xx === s.x - 1 || xx === s.x + w;
        if (flank && !(water[idx(xx, foot)] || (lv[idx(xx, foot)] === lo && lv[idx(xx, hiY)] === hi))) ok = false;
        if (!flank && (lv[idx(xx, hiY)] !== hi || water[idx(xx, hiY)] || lv[idx(xx, loY)] !== lo || water[idx(xx, loY)])) ok = false;
      }
      if (!ok) continue;
      stairs.push({ ...s, dir: north ? "north" : "south" });
      for (let yy = s.y; yy < s.y + s.h; yy += 1) for (let xx = s.x; xx < s.x + w; xx += 1) { stairCell[idx(xx, yy)] = 1; road[idx(xx, yy)] = 1; }
      for (let xx = s.x; xx < s.x + w; xx += 1) { road[idx(xx, hiY)] = 1; road[idx(xx, loY)] = 1; }
      return true;
    }
    return false;
  };
  let flattened = 0;
  for (let c = 0; c < N; c += 1) {
    if (!road[c] || water[c] || stairCell[c]) continue;
    const x = c % W, y = (c - x) / W;
    if (y + 1 >= H) continue;
    const n = c + W;
    if (!road[n] || water[n] || lv[n] === lv[c] || stairCell[n]) continue;
    const hiY = lv[c]! > lv[n]! ? y : y + 1, loY = hiY === y ? y + 1 : y;
    if (tryStair(x, hiY, loY)) continue;
    // 계단 모양이 안 나오면 그 둘레를 낮은 단으로 고르게 해 길이 평지로 지나가게 한다
    const lo = Math.min(lv[c]!, lv[n]!);
    for (let yy = Math.max(0, y - 2); yy <= Math.min(H - 1, y + 3); yy += 1) for (let xx = Math.max(0, x - 2); xx <= Math.min(W - 1, x + 2); xx += 1) if (!stairCell[idx(xx, yy)]) lv[idx(xx, yy)] = lo;
    flattened += 1;
  }
  if (stairs.length) notes.push(`cut ${stairs.length} north-south stair(s) where paths climb`);
  if (flattened) notes.push(`levelled ${flattened} spot(s) where a path climbed a cliff that cannot take carved stairs`);
  // ── 점유 ──
  const taken = new Uint8Array(N);
  for (let c = 0; c < N; c += 1) if (road[c]) taken[c] = 1;
  const rectCells = (r: Rect) => { const out: number[] = []; for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) out.push(idx(x, y)); return out; };
  const free = (r: Rect, allowWater = false) => r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H && rectCells(r).every((c) => !taken[c] && (allowWater ? water[c] : !water[c]));
  const oneLevel = (r: Rect) => new Set(rectCells(r).map((c) => lv[c])).size === 1;
  // 가장 큰 칸 사각형(마스크 안, 같은 높이, 비어 있음)
  const bestRect = (cells: Set<number>, minW = 2, minH = 2): Rect | null => {
    let best: Rect | null = null;
    const hgt = new Array<number>(W).fill(0);
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) { const c = idx(x, y); hgt[x] = cells.has(c) && !taken[c] && !water[c] && (y === 0 || hgt[x]! === 0 || lv[c] === lv[idx(x, y - 1)]) ? hgt[x]! + 1 : cells.has(c) && !taken[c] && !water[c] ? 1 : 0; }
      for (let x = 0; x < W; x += 1) {
        let mh = Infinity;
        for (let x2 = x; x2 < W && hgt[x2]! > 0; x2 += 1) {
          mh = Math.min(mh, hgt[x2]!);
          const r = { x, y: y - mh + 1, w: x2 - x + 1, h: mh };
          if (r.w >= minW && r.h >= minH && (!best || r.w * r.h > best.w * best.h) && oneLevel(r)) best = r;
        }
      }
    }
    return best;
  };
  const maskOf = (i: number) => { const s = new Set<number>(); g.masks[i]!.forEach((v, c) => { if (v) s.add(c); }); return s; };
  // ── 광장 ──
  const plazas: (Rect & { purpose?: string })[] = [];
  code.zones.forEach((z, i) => {
    if (z.kind !== "plaza") return;
    const r = bestRect(maskOf(i));
    if (!r) return;
    plazas.push({ ...r, purpose: z.name });
    for (const c of rectCells(r)) { taken[c] = 1; road[c] = 0; }
  });
  // ── 집: 집 구역마다 크기가 맞는 건물, 문앞에서 길까지 길을 잇는다 ──
  const buildings: { id: string; x: number; y: number; purpose?: string }[] = [];
  const houses = cat.filter((k) => k.kind === "building" && k.door);
  const pathTo = (from: number, level: number): number[] | null => {
    const prev = new Int32Array(N).fill(-1); prev[from] = from;
    for (let q = [from], h = 0; h < q.length; h += 1) {
      const c = q[h]!;
      if (c !== from && (road[c] || plazas.some((p) => rectCells(p).includes(c))) && lv[c] === level) { const out: number[] = []; for (let k = c; k !== from; k = prev[k]!) out.push(k); return out; }
      for (const n of nb4(c)) if (prev[n] < 0 && lv[n] === level && !water[n] && (!taken[n] || road[n] || plazas.some((p) => rectCells(p).includes(n)))) { prev[n] = c; q.push(n); }
    }
    return null;
  };
  const placeBuilding = (box: Rect, purpose: string): boolean => {
    const fitsBox = houses.filter((k) => k.w <= box.w + 2 && k.h <= box.h + 2).sort((a, b) => b.w * b.h - a.w * a.h);
    for (const k of [...fitsBox, ...houses.filter((k) => k.w <= 5 && k.h <= 6)]) {
      const cx = box.x + (box.w >> 1), by = box.y + box.h - 1;
      for (let r = 0; r <= 3; r += 1) for (let ddx = -r; ddx <= r; ddx += 1) for (const ddy of [0, -1, 1, -2, 2]) {
        const R = { x: cx - (k.w >> 1) + ddx, y: by - k.h + 1 + ddy, w: k.w, h: k.h };
        if (!free(R) || !oneLevel(R)) continue;
        const L0 = lv[idx(R.x, R.y + R.h - 1)]!;
        let hidden = false;
        for (let i2 = 0; i2 < R.w; i2 += 1) for (const kk of [1, 2]) { const Y = R.y + R.h - 1 + kk; if (Y < H && lv[idx(R.x + i2, Y)]! > L0 + kk - 1) hidden = true; }
        if (hidden) continue;
        const fx = R.x + k.door!.dx, fy = R.y + k.door!.dy + 1;
        if (!inb(fx, fy) || water[idx(fx, fy)] || lv[idx(fx, fy)] !== L0 || (taken[idx(fx, fy)] && !road[idx(fx, fy)])) continue;
        for (const c of rectCells(R)) taken[c] = 1;
        const way = road[idx(fx, fy)] ? [] : pathTo(idx(fx, fy), L0);
        if (!way) { for (const c of rectCells(R)) taken[c] = 0; continue; }
        for (const c of [idx(fx, fy), ...way]) { road[c] = 1; taken[c] = 1; }
        buildings.push({ id: k.id, x: R.x, y: R.y, purpose });
        return true;
      }
    }
    return false;
  };
  let lostHouses = 0;
  code.zones.forEach((z, i) => {
    if (z.kind !== "building" && !(z.kind === "shrine" && HOUSE_WORDS.test(z.name))) return;
    const m = maskOf(i); const xs = [...m].map((c) => c % W), ys = [...m].map((c) => Math.floor(c / W));
    if (!xs.length) return;
    const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
    if (!placeBuilding(box, z.name)) lostHouses += 1;
  });
  if (lostHouses) notes.push(`${lostHouses} building zone(s) had no spot where a kit fits on one level with its door on the road`);
  // ── 밭 ──
  const fields: (Rect & { crop: string })[] = [];
  code.zones.forEach((z, i) => {
    if (!(z.kind === "field" || z.kind === "garden") || !FIELD_WORDS.test(`${z.name} ${z.contains.join(" ")}`)) return;
    const r = bestRect(maskOf(i), 2, 2); if (!r) return;
    const crop = /포도|vine/iu.test(z.name) ? "herbs" : /꽃|flower/iu.test(z.name) ? "flowers" : "wheat";
    const even = { ...r, w: crop === "wheat" ? r.w : r.w - (r.w % 2), h: crop === "wheat" ? r.h : r.h - (r.h % 2) };
    if (even.w < 2 || even.h < 2) return;
    fields.push({ ...even, crop });
    for (const c of rectCells(even)) taken[c] = 1;
  });
  // ── 도안 물건: 나무·배·소품 ──
  const trees: { id: string; x: number; y: number }[] = [], props: { id: string; x: number; y: number }[] = [];
  const CAT = new Map(cat.map((k) => [k.id, k] as const));
  const treeKits = cat.filter((k) => k.kind === "tree");
  const placeNear = (id: string, x0: number, y0: number, list: { id: string; x: number; y: number }[], onWater = false): boolean => {
    const k = CAT.get(id); if (!k) return false;
    for (let r = 0; r <= 3; r += 1) for (let ddy = -r; ddy <= r; ddy += 1) for (let ddx = -r; ddx <= r; ddx += 1) {
      if (Math.max(Math.abs(ddx), Math.abs(ddy)) !== r) continue;
      const R = { x: x0 + ddx, y: y0 + ddy, w: k.w, h: k.h };
      if (!free(R, onWater) || (!onWater && !oneLevel(R))) continue;
      if (k.kind === "prop" || k.kind === "tree") { const by = R.y + R.h; let blocksDoor = false; for (let d = 0; d < R.w; d += 1) if (by < H && road[idx(R.x + d, by)] && buildings.some((b) => { const kb = CAT.get(b.id)!; return b.x + kb.door!.dx === R.x + d && b.y + kb.door!.dy + 1 === by; })) blocksDoor = true; if (blocksDoor) continue; }
      for (const c of rectCells(R)) taken[c] = 1;
      list.push({ id, x: R.x, y: R.y });
      return true;
    }
    return false;
  };
  for (const o of [...code.objects].sort((a, b) => b.w * b.h - a.w * a.h)) {
    if (HOUSE_WORDS.test(o.name) && !TREE_WORDS.test(o.name)) continue;
    if (BOAT_WORDS.test(o.name) && !/배나무/u.test(o.name)) {
      const boat = cat.find((k) => k.kind === "boat");
      if (!boat || !placeNear(boat.id, o.x, o.y, props, true)) missing.push({ name: o.name, x: o.x, y: o.y, w: o.w, h: o.h });
      continue;
    }
    if (TREE_WORDS.test(o.name)) {
      const big = o.w * o.h >= 9;
      const pick = treeKits.filter((k) => (big ? k.w >= 3 : k.w <= 3)).sort((a, b) => Math.abs(a.w - o.w) - Math.abs(b.w - o.w))[0] ?? treeKits[0];
      if (pick && placeNear(pick.id, o.x, o.y + o.h - pick.h, trees)) continue;
      if (/세계수|신목|거대|giant/iu.test(o.name)) missing.push({ name: o.name, x: o.x, y: o.y, w: o.w, h: o.h });
      continue;
    }
    const rule = PROP_WORDS.find(([re]) => re.test(o.name));
    if (!rule) { missing.push({ name: o.name, x: o.x, y: o.y, w: o.w, h: o.h }); continue; }
    if (!rule[1].some((id) => placeNear(`bd-${id}`, o.x, o.y + o.h - (CAT.get(`bd-${id}`)?.h ?? 1), props))) notes.push(`plan object «${o.name}» had no free spot`);
  }
  // ── 숲 구역 → 숲 사각형, 그리고 빈 풀밭 55% 아래로 ──
  const forests: Rect[] = [];
  const addForests = (cells: Set<number>, minArea: number, budget: number) => {
    for (let k = 0; k < budget; k += 1) {
      const r = bestRectAny(cells); if (!r || r.w * r.h < minArea) break;
      forests.push(r); for (const c of rectCells(r)) { taken[c] = 1; cells.delete(c); }
    }
  };
  const bestRectAny = (cells: Set<number>): Rect | null => {
    let best: Rect | null = null; const hgt = new Array<number>(W).fill(0);
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) { const c = idx(x, y); hgt[x] = cells.has(c) && !taken[c] && !water[c] ? hgt[x]! + 1 : 0; }
      for (let x = 0; x < W; x += 1) { let mh = Infinity; for (let x2 = x; x2 < W && hgt[x2]! > 0; x2 += 1) { mh = Math.min(mh, hgt[x2]!); if (x2 - x + 1 >= 2 && mh >= 2 && (!best || (x2 - x + 1) * mh > best.w * best.h)) best = { x, y: y - mh + 1, w: x2 - x + 1, h: mh }; } }
    }
    return best;
  };
  code.zones.forEach((z, i) => { if (z.kind === "forest") addForests(maskOf(i), 4, 40); });
  const nearUse = (c: number) => { const x = c % W, y = (c - x) / W; for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) { const X = x + dx, Y = y + dy; if (inb(X, Y) && road[idx(X, Y)]) return true; } return false; };
  const land = () => water.filter((v) => !v).length;
  const bare = () => [...Array(N).keys()].filter((c) => !water[c] && !taken[c]).length;
  let filler = 0;
  if (bare() / land() > 0.5) {
    const open = new Set([...Array(N).keys()].filter((c) => !water[c] && !taken[c] && !nearUse(c)));
    while (bare() / land() > 0.5) { const before = forests.length; addForests(open, 4, 1); if (forests.length === before) break; filler += 1; }
  }
  if (filler) notes.push(`planted ${filler} extra woodland patch(es) on empty grass away from paths (bare-grass rule)`);
  // ── 길 사각형: 칸마다 하나씩 가로 토막으로 묶는다(폭 3 이하) ──
  const plazaCell = (c: number) => plazas.some((p) => { const x = c % W, y = (c - x) / W; return x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h; });
  const zonesOut = code.zones.map((z, i) => { const m = maskOf(i); const xs = [...m].map((c) => c % W), ys = [...m].map((c) => Math.floor(c / W)); return xs.length ? { name: z.name, purpose: z.contains.join(", "), x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 } : { name: z.name }; });
  const emit = (): BboxVillageLayout => {
    const roadRects: Rect[] = [];
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      const c = idx(x, y); if (!road[c] || stairCell[c] || plazaCell(c) || water[c] === 3) continue;
      const prev = roadRects.find((r) => r.y === y && r.x + r.w === x && r.w < 3);
      if (prev) prev.w += 1; else roadRects.push({ x, y, w: 1, h: 1 });
    }
    return { name: code.zones[0]?.name ?? "village", zones: zonesOut, roads: [{ kind: "lane", rects: roadRects }], plazas, stairs, buildings, fields, fences: [], forests, trees, props };
  };
  const terrain: BboxVillageTerrain = { W, H, levels: lv, water };
  return { terrain, layout: emit(), notes, missing, repair: (check) => repairVillage(check) };

  // ── 검사기가 짚은 칸을 고치며 다시 맞춘다(최대 rounds 번) ──
  function repairVillage(check: (L: BboxVillageLayout, T: BboxVillageTerrain) => VillageCheck, rounds = 14): { layout: BboxVillageLayout; ok: boolean; errors: string[] } {
    const P = /\((\d+),(\d+)\)/gu;
    const pts = (s: string) => [...s.matchAll(P)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
    const levelBox = (x0: number, y0: number, x1: number, y1: number, to: number) => {
      for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y += 1) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x += 1) if (!water[idx(x, y)]) lv[idx(x, y)] = to;
      for (let i = stairs.length - 1; i >= 0; i -= 1) { const s = stairs[i]!; if (s.x <= x1 + 1 && s.x + s.w >= x0 - 1 && s.y <= y1 + 3 && s.y + s.h >= y0 - 3) { for (let y = s.y; y < s.y + s.h; y += 1) for (let x = s.x; x < s.x + s.w; x += 1) stairCell[idx(x, y)] = 0; stairs.splice(i, 1); } }
    };
    const dropAt = (x: number, y: number) => {
      const hit = (o: { x: number; y: number }, w: number, h: number) => x >= o.x && x < o.x + w && y >= o.y && y < o.y + h;
      for (const list of [buildings, trees, props] as { id: string; x: number; y: number }[][]) for (let i = list.length - 1; i >= 0; i -= 1) { const k = cat.find((q) => q.id === list[i]!.id); if (k && hit(list[i]!, k.w, k.h)) { for (const c of rectCells({ x: list[i]!.x, y: list[i]!.y, w: k.w, h: k.h })) taken[c] = 0; list.splice(i, 1); } }
      for (const list of [forests, fields, plazas] as Rect[][]) for (let i = list.length - 1; i >= 0; i -= 1) if (hit(list[i]!, list[i]!.w, list[i]!.h)) { for (const c of rectCells(list[i]!)) taken[c] = 0; list.splice(i, 1); }
    };
    const connect = (from: number) => {
      const main = new Set<number>(); for (let c = 0; c < N; c += 1) if ((road[c] || plazaCell(c)) && c !== from) main.add(c);
      const prev = new Int32Array(N).fill(-1); prev[from] = from;
      const comp = new Set<number>(); for (let q = [from], h = 0; h < q.length; h += 1) { comp.add(q[h]!); for (const n of nb4(q[h]!)) if (!comp.has(n) && (road[n] || plazaCell(n))) { comp.add(n); q.push(n); } }
      for (let q = [...comp], h = 0; h < q.length; h += 1) for (const c of comp) prev[c] = c;
      for (let q = [...comp], h = 0; h < q.length; h += 1) {
        const c = q[h]!;
        if (!comp.has(c) && main.has(c)) { for (let k = prev[c]!; !comp.has(k); k = prev[k]!) { road[k] = 1; taken[k] = 1; dropAt(k % W, Math.floor(k / W)); taken[k] = 1; } return; }
        for (const n of nb4(c)) if (prev[n] < 0 && water[n] !== 3 && !buildings.some((b) => { const k = cat.find((q2) => q2.id === b.id)!; const x = n % W, y = (n - x) / W; return x >= b.x && x < b.x + k.w && y >= b.y && y < b.y + k.h; })) { prev[n] = c; q.push(n); }
      }
    };
    let last: VillageCheck | null = null;
    for (let r = 0; r < rounds; r += 1) {
      last = check(emit(), terrain);
      if (last.ok) break;
      let acted = 0;
      for (const e of last.errors) {
        const p = pts(e);
        if (/meet across a cliff without stairs/u.test(e) && p.length >= 2) {
          const [a, b] = p as [{ x: number; y: number }, { x: number; y: number }];
          const hiY = lv[idx(a.x, a.y)]! > lv[idx(b.x, b.y)]! ? a.y : b.y, loY = hiY === a.y ? b.y : a.y;
          if (!tryStair(a.x, hiY, loY)) levelBox(a.x - 2, Math.min(a.y, b.y) - 2, a.x + 2, Math.max(a.y, b.y) + 2, Math.min(lv[idx(a.x, a.y)]!, lv[idx(b.x, b.y)]!));
          acted += 1;
        } else if (/east-west level change/u.test(e) && p.length >= 2) {
          const [a, b] = p as [{ x: number; y: number }, { x: number; y: number }];
          levelBox(Math.min(a.x, b.x) - 1, a.y - 2, Math.max(a.x, b.x) + 1, a.y + 2, Math.min(lv[idx(a.x, a.y)]!, lv[idx(b.x, b.y)]!)); acted += 1;
        } else if (/^stairs\[(\d+)\]/u.test(e)) {
          const i = Number(/^stairs\[(\d+)\]/u.exec(e)![1]); const s = stairs[i];
          if (s) { const lo = lv[idx(s.x, s.y)]!; levelBox(s.x - 1, s.y - 2, s.x + s.w, s.y + s.h + 1, lo); acted += 1; }
        } else if (/path network is split/u.test(e) && p[0]) { connect(idx(p[0].x, p[0].y)); acted += 1; }
        else if (/No road leaves the map/u.test(e)) {
          const all = [...Array(N).keys()].filter((c) => road[c] || plazaCell(c));
          const seenR = new Set<number>(); let mainComp: number[] = [];
          for (const s0 of all) { if (seenR.has(s0)) continue; const comp = [s0]; seenR.add(s0); for (let h = 0; h < comp.length; h += 1) for (const n of nb4(comp[h]!)) if (!seenR.has(n) && (road[n] || plazaCell(n)) && (lv[n] === lv[comp[h]!] || stairCell[n] || stairCell[comp[h]!])) { seenR.add(n); comp.push(n); } if (comp.length > mainComp.length) mainComp = comp; }
          const roadCells = mainComp.filter((c) => !stairCell[c] && !water[c]);
          const best = roadCells.map((c) => { const x = c % W, y = (c - x) / W; return { c, d: Math.min(x, y, W - 1 - x, H - 1 - y) }; }).sort((u, v) => u.d - v.d)[0];
          if (best) { const x = best.c % W, y = (best.c - x) / W; const d = [y, H - 1 - y, x, W - 1 - x]; const side = d.indexOf(Math.min(...d)); const [dx2, dy2] = [[0, -1], [0, 1], [-1, 0], [1, 0]][side]!; const L0 = lv[best.c]!; let causeway = 0;
            for (let cx = x, cy = y; inb(cx, cy); cx += dx2!, cy += dy2!) {
              const c = idx(cx, cy);
              if (water[c] === 3) { for (const [ox, oy] of [[0, 0], [dy2!, dx2!], [-dy2!, -dx2!]] as const) if (inb(cx + ox, cy + oy) && water[idx(cx + ox, cy + oy)] === 3) { water[idx(cx + ox, cy + oy)] = 0; lv[idx(cx + ox, cy + oy)] = L0; } causeway += 1; }
              dropAt(cx, cy); road[c] = 1; taken[c] = 1; if (lv[c] !== L0) levelBox(cx - 1, cy - 1, cx + 1, cy + 1, L0);
            }
            if (causeway) notes.push(`raised a ${causeway}-cell causeway through the sea so the entrance road reaches the map edge`);
            acted += 1; }
        } else if (/bare grass/u.test(e)) {
          const open = new Set([...Array(N).keys()].filter((c) => !water[c] && !taken[c] && !nearUse(c)));
          addForests(open, 4, 6); acted += 1;
        } else if (p[0]) { dropAt(p[0].x, p[0].y); acted += 1; }
        else if (/^(buildings|trees|props|fields|plazas|forests)\[(\d+)\]/u.test(e)) {
          const [, g2, i] = /^(buildings|trees|props|fields|plazas|forests)\[(\d+)\]/u.exec(e)!;
          const list = ({ buildings, trees, props, fields, plazas, forests } as Record<string, unknown[]>)[g2!]!; list.splice(Number(i), 1); acted += 1;
        }
      }
      if (!acted) break;
      notes.push(`repair round ${r + 1}: ${last.errors.length} problem(s) fixed by levelling, stairs, path joins or dropping a piece`);
    }
    const fin = check(emit(), terrain);
    return { layout: emit(), ok: fin.ok, errors: fin.errors };
  }
}
