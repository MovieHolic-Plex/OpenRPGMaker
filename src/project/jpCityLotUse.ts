// project/jpCityLotUse.ts
// 일본 도시(jp_city) 거리의 빈터 쓰임(lot use) 단계 — 건물·소품이 다 선 뒤 남은 대지를 「쓰임」으로 채운다.
//
// 왜 (2026-10-14 사용자 「거리·광장의 빈 땅이 거슬린다」): 실제 일본 도시는 남는 땅을 쓰임으로 메운다 — 코인 주차, 자판기·자전거가 선 골목 틈,
//   쓰레기 집하장, 작은 놀이터, 동네 텃밭, 공사장, 광장의 분수·시계탑·화단·매점. 소품을 아무 데나 흩뿌리는 대신 남은 직사각형마다 크기·위치·구획(상가/주택)으로
//   쓰임 하나를 고르고, 그 쓰임의 정해진 짜임(코인 주차 = 아스팔트 + 칸 선 + 차 + 요금 기둥)을 놓는다.
//
// 규칙
// - 남은 땅 = 건물 칸도 도로·보도·물도 아니고 아무 타일도 얹히지 않은 대지 칸(지도에서 읽는다). 가장 큰 빈 직사각형부터 쓴다(같은 씨앗이면 같은 결과).
// - 쓰임마다 1칸 여백을 둔다(쓰임끼리·소품끼리 붙어 쌓이지 않게). 쓰임 안도 빽빽이 채우지 않는다(숨 쉴 자리).
// - 멈춤: 「반경 2칸 안에 소품이 없는 대지 칸」 비율이 TARGET 이하가 되거나, 남은 직사각형이 작거나, 쓰임 수 상한에 닿으면.
// - 바닥은 지도 한 가지 대지(자갈)를 그대로 쓴다. 띠 전체를 칠하지 않는다 — 아스팔트(주차장)·생울타리·철망 울타리는 그 쓰임의 칸에만.
// - 키트는 3/4 관문(object-gate)을 통과한 것만 쓴다(scripts/content/jp-city/blocks/lot_art.py ENABLED · street_hand 통과분 · 기존 번들 소품).

import type { GameMap, TilesetDef } from "@/project/types";

export interface LotUseView { readonly map: GameMap; readonly tileset: TilesetDef }
export interface LotUsePlaced { readonly use: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export interface LotUseResult { readonly uses: readonly LotUsePlaced[]; readonly props: number; readonly emptyBefore: number; readonly emptyAfter: number }
type Call = (tool: string, args: Record<string, unknown>) => unknown;

/** 「소품 없는 대지」 비율 목표. 낮출수록 빽빽해진다 — 숨 쉴 자리를 남기려고 0 으로 몰지 않는다. */
const TARGET = 0.07;
const RADIUS = 2;

function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const INFRA_AUTOTILES = ["jp-sidewalk-curb", "jp-lane-road", "jp-water-canal", "jp-water-pond", "jp-rail-track", "jp-lane-center", "jp-lane-dash", "jp-crosswalk-ew", "jp-crosswalk-ns", "jp-tactile"];
const INFRA_GROUPS = ["jp:street:sidewalk", "jp:street:road", "jp:street:crosswalk", "jp:street:lane", "jp:street:rail", "jp:street:water"];
const EDGE_AUTOTILES = ["jp-wall-block", "jp-hedge", "jp-fence-mesh", "jp-guardrail"];

interface Rect { x: number; y: number; w: number; h: number }

export function fillLotUses(opts: {
  readonly mapId: string;
  readonly seed: number;
  readonly style: "shopping" | "residential";
  /** 건물 칸(지어진 건물 rect + 완성 큰 건물) — 소품 덮개로 세지 않는다 */
  readonly buildings: readonly Rect[];
  readonly view: () => LotUseView;
  readonly call: Call;
}): LotUseResult {
  const { mapId, call } = opts;
  const { map, tileset } = opts.view();
  const W = map.width, H = map.height, N = W * H;
  const rng = mulberry((opts.seed ^ 0x6c0f1e57) >>> 0);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;

  const infra = new Set<number>(), edge = new Set<number>(), paver = new Set<number>();
  for (const a of tileset.autotileGroups ?? []) {
    const ids = a.memberTileIds ?? [];
    if (INFRA_AUTOTILES.includes(a.id)) ids.forEach((t) => infra.add(t));
    if (EDGE_AUTOTILES.includes(a.id)) ids.forEach((t) => edge.add(t));
    if (a.id === "jp-plaza-pave") ids.forEach((t) => paver.add(t));
  }
  for (const g of tileset.tileGroups ?? []) if (INFRA_GROUPS.includes(g.id)) (g.tileIds ?? []).forEach((t) => infra.add(t));
  const kits = new Map<string, { w: number; h: number; upper: number[][] }>();
  for (const k of tileset.structureKits ?? []) kits.set(k.id, { w: k.width, h: k.height, upper: k.rows.map((r) => [...(r.upperTiles ?? new Array(k.width).fill(-1))]) });

  const building = new Uint8Array(N);
  for (const b of opts.buildings) for (let y = Math.max(0, b.y); y < Math.min(H, b.y + b.h); y++) for (let x = Math.max(0, b.x); x < Math.min(W, b.x + b.w); x++) building[y * W + x] = 1;
  const free = new Uint8Array(N), cover = new Uint8Array(N), reserved = new Uint8Array(N), infraCell = new Uint8Array(N);
  const isPaver = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const ups = [map.upperTiles[i] ?? -1, map.upperOverlayTiles?.[i] ?? -1, map.lowerOverlayTiles?.[i] ?? -1].filter((t) => t >= 0);
    const low = map.lowerTiles[i] ?? -1;
    if (infra.has(low)) infraCell[i] = 1;
    if (paver.has(low)) isPaver[i] = 1;
    if (building[i]) continue;
    if (ups.length) { if (!ups.every((t) => edge.has(t))) cover[i] = 1; continue; }
    if (!infra.has(low)) free[i] = 1;
  }
  const emptyRatio = (): number => {
    let lot = 0, empty = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!free[i] && !cover[i]) continue;
      lot++;
      if (cover[i]) continue;
      let near = false;
      for (let dy = -RADIUS; dy <= RADIUS && !near; dy++) for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && cover[yy * W + xx]) { near = true; break; }
      }
      if (!near) empty++;
    }
    return lot ? empty / lot : 0;
  };
  const uncoveredIn = (r: Rect): number => {
    let n = 0;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      let near = false;
      for (let dy = -RADIUS; dy <= RADIUS && !near; dy++) for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < W && yy < H && cover[yy * W + xx]) { near = true; break; }
      }
      if (!near) n++;
    }
    return n;
  };
  const avail = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && free[y * W + x] === 1 && !reserved[y * W + x];
  const availRect = (x: number, y: number, w: number, h: number): boolean => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (!avail(xx, yy)) return false; return true; };
  const occupy = (x: number, y: number, w: number, h: number, asCover = true) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < H) { free[yy * W + xx] = 0; if (asCover) cover[yy * W + xx] = 1; }
  };
  const reserve = (r: Rect, margin: number) => {
    for (let yy = r.y - margin; yy < r.y + r.h + margin; yy++) for (let xx = r.x - margin; xx < r.x + r.w + margin; xx++) if (xx >= 0 && yy >= 0 && xx < W && yy < H) reserved[yy * W + xx] = 1;
  };

  let props = 0;
  /** 키트 한 개 — 발자국 칸이 모두 비어 있어야 한다. */
  const put = (id: string, x: number, y: number): boolean => {
    const k = kits.get(id);
    if (!k || !availRect(x, y, k.w, k.h)) return false;
    try { call("stamp_object", { objectId: `kit:${tileset.id}/${id}`, mapId, x, y }); } catch { return false; }
    occupy(x, y, k.w, k.h); props++;
    return true;
  };
  /** 바닥 표시 키트(코인 주차 칸 선)를 2층(바닥 장식)에 — 위에 서는 차(3층)가 선을 지우지 않게. */
  const putFloor = (id: string, x: number, y: number): boolean => {
    const k = kits.get(id);
    if (!k) return false;
    try { call("stamp_layer_block", { mapId, x, y, layers: { "2": k.upper }, reshape: false }); } catch { return false; }
    occupy(x, y, k.w, k.h); props++;
    return true;
  };
  const fillMat = (r: Rect, material: string): boolean => {
    try { call("fill_region", { mapId, rect: r, material }); return true; } catch { return false; }
  };
  /** 선형 위층 오토타일(생울타리·철망 울타리)을 칸 목록에 직접 모양을 맞춰 3층에 찍는다 — fill_region·build_wall 은 이 재료를 받지 않는다(2026-10-14 실측). 4방 비트 N1 E2 S4 W8. */
  const edgeLine = (cells: readonly { x: number; y: number }[], autotileId: string): void => {
    const g = (tileset.autotileGroups ?? []).find((a) => a.id === autotileId);
    if (!g || !cells.length) return;
    const key = (x: number, y: number) => y * W + x;
    const set = new Set(cells.filter((c) => c.x >= 0 && c.y >= 0 && c.x < W && c.y < H && !building[key(c.x, c.y)]).map((c) => key(c.x, c.y)));
    if (!set.size) return;
    const xs = [...set].map((i) => i % W), ys = [...set].map((i) => Math.floor(i / W));
    const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
    const grid: number[][] = [];
    for (let y = y0; y <= y1; y++) {
      const row: number[] = [];
      for (let x = x0; x <= x1; x++) {
        if (!set.has(key(x, y))) { row.push(-1); continue; }
        const m = (set.has(key(x, y - 1)) ? 1 : 0) | (set.has(key(x + 1, y)) ? 2 : 0) | (set.has(key(x, y + 1)) ? 4 : 0) | (set.has(key(x - 1, y)) ? 8 : 0);
        row.push(Number((g.variantMap as Record<string, number>)[String(m)] ?? -1));
      }
      grid.push(row);
    }
    try { call("stamp_layer_block", { mapId, x: x0, y: y0, layers: { "3": grid }, reshape: false }); } catch { return; }
    for (const i of set) { free[i] = 0; cover[i] = 0; }
  };
  const hline = (x: number, y: number, w: number) => Array.from({ length: Math.max(0, w) }, (_, k) => ({ x: x + k, y }));
  const vline = (x: number, y: number, h: number) => Array.from({ length: Math.max(0, h) }, (_, k) => ({ x, y: y + k }));
  /** 직사각형 안에 소품 목록을 1칸 띄워 놓는다(앞=아래쪽부터 또는 뒤=위쪽부터). 놓인 것들의 경계 상자를 돌려준다. */
  const pack = (r: Rect, ids: readonly string[], fromFront: boolean): Rect | undefined => {
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const id of ids) {
      const k = kits.get(id);
      if (!k) continue;
      let done = false;
      const ys: number[] = [];
      for (let y = r.y; y + k.h <= r.y + r.h; y++) ys.push(y);
      if (fromFront) ys.reverse();
      for (const y of ys) {
        for (let x = r.x; x + k.w <= r.x + r.w && !done; x++) {
          // 이미 놓은 소품과 1칸 띄움: 발자국 둘레 한 칸도 비어 있어야 한다(지도 끝·이 직사각형 밖 경계는 봐주지 않는다 — 다른 쓰임도 1칸 여백을 둔다)
          let ok = true;
          for (let yy = y - 1; yy <= y + k.h && ok; yy++) for (let xx = x - 1; xx <= x + k.w; xx++) {
            const inside = xx >= r.x && xx < r.x + r.w && yy >= r.y && yy < r.y + r.h;
            if (!inside) continue;
            const i = yy * W + xx;
            if (!free[i] && cover[i]) { ok = false; break; }
          }
          if (ok && put(id, x, y)) { done = true; bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x + k.w); by1 = Math.max(by1, y + k.h); }
        }
        if (done) break;
      }
    }
    return bx1 > bx0 ? { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 } : undefined;
  };

  // ── 쓰임들 ──
  const counts: Record<string, number> = {};
  const caps: Record<string, number> = { parking: 2, park: 2, construction: 1, plaza: 2, veg: 3, garbage: 2, yard: 5, nook: 99, strip: 99 };
  const cars = ["jp-prop-car-white", "jp-prop-car-silver", "jp-prop-car-black", "jp-prop-car-blue", "jp-prop-car-red"];
  const front = (r: Rect): boolean => { let n = 0; for (let x = r.x; x < r.x + r.w; x++) if (r.y + r.h < H && infraCell[(r.y + r.h) * W + x]) n++; return n >= Math.ceil(r.w / 2); };
  /** 위(북쪽)가 보도인 띠 — 아래 줄 건물의 뒤가 큰길을 보는 자리. */
  const backOnStreet = (r: Rect): boolean => { let n = 0; for (let x = r.x; x < r.x + r.w; x++) if (r.y > 0 && infraCell[(r.y - 1) * W + x]) n++; return n >= Math.ceil(r.w / 2); };
  const paverRect = (r: Rect): boolean => { let n = 0; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (isPaver[y * W + x]) n++; return n * 2 > r.w * r.h; };

  const uses: Record<string, (r: Rect) => Rect | undefined> = {
    // 코인 주차: 아스팔트 + 칸 선(세로로 3줄 간격) + 절반쯤 찬 차 + 요금 기둥. 앞(보도 쪽) 직사각형.
    parking: (r) => {
      const cols = r.w >= 14 ? 2 : 1, rows = Math.min(3, Math.floor(r.h / 3));
      if (rows < 1) return undefined;
      const pw = cols * 6 + (cols - 1), ph = rows * 3;
      const x0 = r.x + (r.w - pw - 2 >= 0 ? 1 : 0), y0 = r.y + r.h - ph;
      if (!availRect(x0, y0, pw, ph)) return undefined;
      fillMat({ x: x0, y: y0, w: pw, h: ph }, "생활도로");
      for (let c = 0; c < cols; c++) for (let k = 0; k < rows; k++) {
        const bx = x0 + c * 7, by = y0 + k * 3;
        putFloor("jp-lot-bay", bx, by);
        if (rng() < 0.55 || (c === 0 && k === rows - 1)) {
          const id = pick(cars) + (c === 1 ? "-r" : "");
          try { call("stamp_object", { objectId: `kit:${tileset.id}/${id}`, mapId, x: bx, y: by }); props++; } catch { /* 자리 없음 */ }
        }
      }
      occupy(x0, y0, pw, ph);
      let bx1 = x0 + pw;
      const px = x0 + pw;                                               // 요금 기둥: 주차장 오른쪽(보도 쪽 끝)
      if (put("jp-lot-board", px, y0 + ph - 3)) bx1 = px + 1;
      else if (put("jp-lot-board", x0 - 1, y0 + ph - 3)) { /* 왼쪽 */ }
      return { x: x0 - 1, y: y0, w: bx1 - x0 + 1, h: ph };
    },
    // 작은 놀이터: 앞줄 생울타리(입구 2칸 비움) + 미끄럼틀·모래판·스프링·벤치·나무.
    park: (r) => {
      const w = Math.min(r.w, 12), h = Math.min(r.h, 9), x0 = r.x + Math.floor((r.w - w) / 2), y0 = r.y + r.h - h;
      const inner = { x: x0, y: y0, w, h: h - 1 };
      const gate = x0 + Math.floor(w / 2) - 1;
      // 생울타리로 두른다: 앞(보도 쪽)이면 앞줄에 입구 2칸, 아니면 윗줄·양옆만(아랫변은 뒤 건물의 담)
      if (front(r)) edgeLine([...hline(x0, y0 + h - 1, gate - x0), ...hline(gate + 2, y0 + h - 1, x0 + w - gate - 2), ...vline(x0, y0, h - 1), ...vline(x0 + w - 1, y0, h - 1)], "jp-hedge");
      else { edgeLine([...hline(x0, y0, w), ...vline(x0, y0 + 1, h - 1), ...vline(x0 + w - 1, y0 + 1, h - 1)], "jp-hedge"); inner.y = y0 + 1; inner.h = h - 1; }
      inner.x = x0 + 1; inner.w = w - 2;
      if (inner.w < 4 || inner.h < 4) return undefined;
      const items = ["jp-lot-slide", "jp-lot-sandbox", "jp-lot-spring", "jp-prop-bench", h >= 8 ? `jp-prop-tree-${pick(["zelkova", "sakura", "ginkgo"])}` : "jp-lot-spring"];
      const got = pack(inner, items, false);
      return got ? { x: x0, y: y0, w, h } : undefined;
    },
    // 동네 텃밭(주택 뒤 대지): 생울타리로 세 변(위·왼·오른)을 두르고 안에 두둑 1~2 + 빨래 장대나 나무. 아랫변은 집 뒤 블록담이 경계다.
    veg: (r) => {
      const n = r.w >= 11 && rng() < 0.6 ? 2 : 1;
      const gw = Math.min(r.w, n * 5 + 1 + (r.w >= n * 5 + 5 && rng() < 0.5 ? 4 : 0)), gh = Math.min(r.h, 5);
      if (gh < 4 || gw < 6) return undefined;
      const x0 = r.x + Math.floor(rng() * (r.w - gw + 1)), y0 = r.y + r.h - gh;
      if (!availRect(x0, y0, gw, gh)) return undefined;
      edgeLine([...hline(x0, y0, gw), ...vline(x0, y0 + 1, gh - 1), ...vline(x0 + gw - 1, y0 + 1, gh - 1)], "jp-hedge");
      let got = 0;
      for (let k = 0; k < n; k++) if (put("jp-lot-veg", x0 + 1 + k * 5, y0 + gh - 3)) got++;
      if (!got) return undefined;
      const rest = x0 + 1 + n * 5;
      if (x0 + gw - 1 - rest >= 3) put("jp-monohoshi", rest, y0 + gh - 2);
      return { x: x0, y: y0, w: gw, h: gh };
    },
    // 집 뒤 작은 숲·쉼터: 나무 1~2 그루 + 벤치(높이 6+). 나무끼리 2칸 띄운다.
    yard: (r) => {
      if (r.h < 6 || r.w < 4) return undefined;
      const n = r.w >= 11 ? 2 : 1;
      let got: Rect | undefined;
      for (let k = 0; k < n; k++) {
        const tx = r.x + Math.floor((k + 0.5) * r.w / n) - 2, ty = r.y + r.h - 6;
        if (put(`jp-prop-tree-${pick(["zelkova", "sakura", "ginkgo"])}`, tx, ty)) got = got ? { x: Math.min(got.x, tx), y: ty, w: Math.max(got.x + got.w, tx + 4) - Math.min(got.x, tx), h: 6 } : { x: tx, y: ty, w: 4, h: 6 };
      }
      if (got && r.w >= 7) put("jp-prop-bench", got.x + got.w + 1 <= r.x + r.w - 2 ? got.x + got.w + 1 : got.x - 3, r.y + r.h - 1);
      return got;
    },
    // 공사장: 뒤에 현장 사무소, 앞줄 철망 울타리(입구 2칸) + 입구 옆 콘·바리케이드 + 게시판.
    construction: (r) => {
      const w = Math.min(r.w, 12), h = Math.min(r.h, 8), x0 = r.x, y0 = r.y + r.h - h;
      if (!put("jp-lot-cabin", x0 + 1, y0)) return undefined;
      const gate = x0 + w - 4;
      edgeLine([...hline(x0, y0 + h - 1, gate - x0), ...hline(gate + 2, y0 + h - 1, x0 + w - gate - 2), ...vline(x0, y0, h - 1), ...vline(x0 + w - 1, y0, h - 1)], "jp-fence-mesh");   // 철망 울타리(앞 입구 2칸)
      pack({ x: x0 + 5, y: y0, w: w - 5, h: h - 1 }, ["jp-keijiban", "jp-prop-barricade3", "jp-prop-cone"], true);
      return { x: x0, y: y0, w, h };
    },
    // 광장: 가운데 분수 또는 시계탑, 둘레에 화단·벤치, 가장자리에 매점.
    plaza: (r) => {
      const cx = r.x + Math.floor(r.w / 2), cy = r.y + Math.floor(r.h / 2);
      const centre = r.w >= 7 && r.h >= 6 && rng() < 0.6 ? "jp-lot-fountain" : "jp-lot-clock";
      const ck = kits.get(centre)!;
      if (!put(centre, cx - Math.floor(ck.w / 2), cy - Math.floor(ck.h / 2))) return undefined;
      const ring: [string, number, number][] = [["jp-lot-planter", -ck.w - 1, 0], ["jp-lot-planter", ck.w + 1, 0], ["jp-prop-bench", -1, ck.h + 1]];
      for (const [id, dx, dy] of ring) put(id, cx - Math.floor(ck.w / 2) + dx, cy - Math.floor(ck.h / 2) + dy);
      if (r.w >= 10) pack({ x: r.x, y: r.y, w: r.w, h: r.h }, ["jp-lot-kiosk"], false);
      return { x: r.x, y: r.y, w: r.w, h: r.h };
    },
    // 쓰레기 집하장: 철망 상자 + 게시판(주택가 골목 앞).
    garbage: (r) => pack(r, ["jp-gomi-box", "jp-keijiban"], true),
    // 골목 틈(폭 2~3): 앞(보도 쪽)에 자판기·자전거, 안쪽에 실외기·가스통·화분.
    nook: (r) => {
      const fr = front(r);
      const ids = fr
        ? [pick(["jp-prop-vending-aka", "jp-prop-vending-sora", "jp-prop-vending-midori"]), r.w >= 3 ? "jp-prop-bike-cluster" : pick(["jp-prop-bike-sora", "jp-prop-bike-aka"]), opts.style === "residential" ? "jp-gomi-box" : "jp-prop-garbage-net", "jp-ac-unit", "jp-propane"]
        : ["jp-ac-unit", "jp-propane"];
      return pack(r, ids.slice(0, r.h >= 6 ? 3 : 2), fr);                 // 틈 하나에 셋까지(기둥처럼 쌓지 않게)
    },
    // 납작한 띠(높이 1~2): 화분·자전거·벤치.
    strip: (r) => {
      if (!front(r) && !backOnStreet(r)) return undefined;
      // 길을 보는 납작한 띠: 화분·자전거·벤치를 5~7칸 간격으로(줄 맞춘 리듬, 빽빽하지 않게)
      const pool = opts.style === "residential" ? ["jp-pots", "jp-prop-planter", "jp-prop-bike-cluster", "jp-pots"] : ["jp-prop-planter", "jp-prop-bike-cluster", "jp-prop-vending-sora", "jp-prop-planter", "jp-prop-bench"];
      const y = front(r) ? r.y + r.h - 1 : r.y;
      let bx0 = Infinity, bx1 = -Infinity;
      for (let x = r.x + 1 + Math.floor(rng() * 3); x < r.x + r.w - 1; ) {
        const id = pick(pool), k = kits.get(id);
        if (!k) break;
        const yy = k.h > 1 ? (front(r) ? y - k.h + 1 : y) : y;
        if (yy >= r.y && put(id, x, yy)) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x + k.w); }
        x += k.w + 4 + Math.floor(rng() * 3);
      }
      return bx1 > bx0 ? { x: bx0, y: r.y, w: bx1 - bx0, h: r.h } : undefined;
    },
  };

  const choose = (r: Rect): string[] => {
    const fr = front(r), pv = paverRect(r), res = opts.style === "residential";
    if (r.w <= 3) return fr ? [res && rng() < 0.4 ? "garbage" : "nook", "nook"] : [];
    if (r.h <= 2) return ["strip"];
    if (r.h <= 3 && backOnStreet(r) && !fr) return ["strip"];
    const order: string[] = [];
    if (pv && r.w >= 6 && r.h >= 5) order.push("plaza");
    if (res) {
      if (!fr && r.w >= 6 && r.h >= 4) order.push("veg");
      if (fr && r.w >= 7 && r.h >= 3 && rng() < 0.5) order.push("parking");
      if (r.w >= 6 && r.h >= 5) order.push("park");
      if (r.w >= 7 && r.h >= 3) order.push("parking");
      order.push("veg");
    } else {
      if (fr && r.w >= 7 && r.h >= 3) order.push("parking");
      if (r.w >= 8 && r.h >= 5 && rng() < 0.5) order.push("construction");
      if (r.w >= 6 && r.h >= 5) order.push("park");
      if (r.w >= 7 && r.h >= 3) order.push("parking");
      if (r.w >= 8 && r.h >= 5) order.push("construction");
      if (!fr && r.w >= 6 && r.h >= 4 && rng() < 0.4) order.push("veg");
    }
    order.push("yard");
    if (fr) order.push("nook");
    if (backOnStreet(r)) order.push("strip");
    return order;
  };

  const emptyBefore = emptyRatio();
  const placed: LotUsePlaced[] = [];
  const maxUses = 6 + Math.floor(N / 220);
  for (let guard = 0; guard < 200 && placed.length < maxUses; guard++) {
    if (emptyRatio() <= TARGET) break;
    const r = largestRect(W, H, (x, y) => avail(x, y));
    if (!r || r.w * r.h < 4) break;
    // 쓰임 하나가 너무 큰 직사각형을 통째로 먹지 않게 자른다(남은 쪽은 다음 차례).
    const cut: Rect = { ...r, w: Math.min(r.w, 16), h: Math.min(r.h, 10) };
    if (cut.h < r.h) cut.y = r.y + r.h - cut.h;                              // 앞(아래)부터
    if (uncoveredIn(cut) < 3) { reserve(cut, 0); continue; }
    let done: Rect | undefined, used = "";
    for (const u of choose(cut)) {
      if ((counts[u] ?? 0) >= (caps[u] ?? 99)) continue;
      done = uses[u]!(cut);
      if (done) { used = u; break; }
    }
    if (!done) { reserve(cut, 0); continue; }
    counts[used] = (counts[used] ?? 0) + 1;
    placed.push({ use: used, ...done });
    reserve(done, 1);
    if (used === "nook" || used === "strip" || used === "garbage") reserve(cut, 0);   // 작은 쓰임은 그 틈을 다 쓴 것으로 — 같은 틈에 또 쌓지 않는다
  }
  return { uses: placed, props, emptyBefore, emptyAfter: emptyRatio() };
}

/** 가장 큰 빈 직사각형(히스토그램 방식, 같은 넓이면 아래쪽·왼쪽 우선). 폭·높이 2 이상. */
function largestRect(W: number, H: number, ok: (x: number, y: number) => boolean): Rect | undefined {
  const hts = new Array<number>(W).fill(0);
  let best: Rect | undefined, bestA = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) hts[x] = ok(x, y) ? hts[x]! + 1 : 0;
    const stack: number[] = [];
    for (let x = 0; x <= W; x++) {
      const hh = x < W ? hts[x]! : 0;
      let start = x;
      while (stack.length && hts[stack[stack.length - 1]!]! >= hh) {
        const top = stack.pop()!;
        const height = hts[top]!;
        const left = stack.length ? stack[stack.length - 1]! + 1 : 0;
        const width = x - left;
        const a = width * height;
        if (width >= 2 && height >= 2 && a >= bestA) { bestA = a; best = { x: left, y: y - height + 1, w: width, h: height }; }
        start = top;
      }
      void start;
      if (x < W) stack.push(x);
    }
  }
  return best;
}
