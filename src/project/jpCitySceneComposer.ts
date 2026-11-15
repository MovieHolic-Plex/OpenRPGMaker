// project/jpCitySceneComposer.ts
// 일본 도시(jp_city) 거리 장면 구성기 — 조수가 짓는 거리(게임 열쇠가 있는 호출)의 새 짜임.
//
// 왜 (오너 2026-11-14): «근데 생각해보니까 일본 도시랑 한국 도시는 어떻게할거임 ? 아직 퀄리티가 좀 떨어지는거같은데 .. 오브젝트 수랑 도로 뭐 이것저것»
//   옛 구성기(jpCityStreetComposer)는 조립 건물 몇 종류를 되풀이해 세우고(60×48 한 장에 같은 정면이 3~8번), 소품 종류가 21~28, 하천 띠가 지도의 1/3 이었다.
//   이 구성기는 (1) 손 도트 건물 키트를 한 지도에 한 번씩만 세우고(게임마다 순서가 다르다) (2) 주택가는 담·대문·마당·카포트로 길에서 물려 세우고
//   (3) 하천 띠를 13줄로 줄여 산책로 장면을 놓고 (4) 구획마다 쓰임(공원·신사·주차장·공사장·자전거 주차장·역 앞)과 바닥 톤을 달리한다.
//   거리 종류(도로 짜임·건물 섞임·장면 벌·톤)는 자료다 — src/assets/jpCityStreetKinds.json.
// 열쇠 없는 호출(편집기 손 호출·대표작 데모·옛 테스트)은 옛 구성기 그대로다: 대표작이 그 배치의 문 좌표에 기대고 있다.
//
// 순수 계획 → 단계 목록. 실행은 jpCitySceneRun.ts. 줄·구획 채우기는 jpCitySceneRows.ts · jpCityScenePieces.ts.
import type { JpStreetPlan } from "@/project/jpCityStreetComposer";
import { mulberry, Occ, SceneCtx, type SceneBand, type SceneBlock, type SceneLayout, type ScenePlaced, type SceneStreet, type SceneVStreet } from "@/project/jpCitySceneCtx";
import { pickSceneKind, sceneKo, sceneTone, type SceneKind, type SceneStyle, type SceneTone } from "@/project/jpCitySceneKinds";
import { PIECES, type PieceDef } from "@/project/jpCityScenePieces";
import { dressRiver, dressStreets, placeOverpass } from "@/project/jpCitySceneStreets";
import { fillRear, fillRows, rearTop } from "@/project/jpCitySceneRows";
import { lookHash } from "@/project/kitLook";

export interface SceneOptions {
  readonly mapId: string; readonly width: number; readonly height: number; readonly seed: number;
  readonly style?: SceneStyle; readonly shops?: readonly string[];
  /** 게임 열쇠 — 종류·톤·건물 순서를 고른다 */ readonly key: string;
  /** 거리 종류 id 를 직접 고른다(jpCityStreetKinds.json) */ readonly kind?: string;
  readonly crosswalkTile?: number;
}
export interface ScenePlan extends JpStreetPlan {
  readonly kind: SceneKind; readonly tone: SceneTone; readonly placed: readonly ScenePlaced[];
  /** 남은 빈 대지 가운데 빈터 쓰임을 놓아도 되는 칸(1) — 길·산책로·조각 구획 밖 */ readonly lotFree: Uint8Array;
  /** 놓인 장면 벌(이름) · 구획 조각 */ readonly scenes: readonly string[]; readonly pieces: readonly string[];
}

const RIVER_W = 3;

function layout(c: SceneCtx): SceneLayout {
  const { W, H, kind, rng } = c;
  const rw = kind.mainW[0]! + Math.floor(rng() * (kind.mainW[1]! - kind.mainW[0]! + 1));
  const rowsOf = (t: string) => (t === "kerb" ? rw + 4 : t === "lane" ? 4 : t === "mall" ? 6 : 10 + RIVER_W);
  const wantRiver = W >= 44 && rng() < kind.river;
  const typesFor = (n: number, river: boolean): SceneStreet["type"][] => {
    const t: SceneStreet["type"][] = Array.from({ length: n - 1 }, (_, i) => (kind.main === "mall" && i > 0 ? "lane" : kind.main));
    if (river && n >= 2) t[n >= 3 ? n - 2 : 0] = "river";
    return t;
  };
  const N0 = H >= 62 ? 4 : H >= 44 ? 3 : 2;
  let N = N0, types = typesFor(N, wantRiver), total = 0;
  // 띠 수: 띠 평균이 가게 키(10줄)에 닿는 짜임을 먼저 — 하천이 있으면 띠를 하나 줄여 키 큰 띠(앞줄 + 뒷골목 + 뒷줄)로 만든다.
  const N1 = Math.max(2, N0 - 1);
  for (const [n, r, need] of [[N0, wantRiver, 9.5], [N1, wantRiver, 9.5], [N0, wantRiver, 8], [N1, wantRiver, 8], [N0, false, 8], [N1, false, 0]] as const) {
    N = n; types = typesFor(n, r);
    total = H - 3 - types.reduce((a, t) => a + rowsOf(t), 0);
    if (total / n >= need) break;
  }
  // 띠 높이: 맨 아래 띠는 낮게(공원·주차장·낮은 집), 가운데는 가게 키(10)에 맞추고, 남는 줄은 맨 위 띠(뒷줄·고층)가 받는다.
  const heights = new Array<number>(N).fill(0);
  if (N === 2) { heights[1] = Math.min(10, Math.floor(total / 2)); heights[0] = total - heights[1]!; }
  else {
    heights[N - 1] = total >= N * 10 ? 9 : total >= N * 9 ? 8 : 7;
    const mid = Math.max(8, Math.min(kind.tall ? 10 : 11, Math.floor((total - heights[N - 1]!) / (N - 1))));
    for (let i = 1; i < N - 1; i++) heights[i] = mid;
    heights[0] = total - heights[N - 1]! - mid * (N - 2);
  }
  const bands: SceneBand[] = [];
  let y = 0;
  for (let i = 0; i < N; i++) {
    const top = y, foot = top + heights[i]! - 1, y0 = foot + 1;
    const t = i < N - 1 ? types[i]! : "edge";
    let front: SceneStreet;
    if (t === "kerb") front = { type: t, y0, nA: y0, nK: y0 + 1, road0: y0 + 2, road1: y0 + 1 + rw, sA: y0 + 2 + rw, sB: y0 + 3 + rw, end: y0 + 3 + rw };
    else if (t === "lane") front = { type: t, y0, nA: y0, road0: y0, road1: y0 + 3, sB: y0 + 3, end: y0 + 3 };
    else if (t === "mall") front = { type: t, y0, nA: y0, road0: y0 + 1, road1: y0 + 4, sB: y0 + 5, end: y0 + 5 };
    else if (t === "river") {
      const wall = y0 + 2, water0 = wall + 4, water1 = water0 + RIVER_W - 1;
      front = { type: t, y0, nA: y0, nK: y0 + 1, road0: wall, road1: water1 + 2, sA: water1 + 3, sB: water1 + 4, end: water1 + 4, river: { wall, water0, water1, bank0: water1 + 1, bank1: water1 + 2 } };
    } else front = { type: "edge", y0, nA: y0, road0: kind.main === "lane" ? y0 : y0 + 1, road1: H - 1, sB: H - 1, end: H - 1 };
    bands.push({ index: i, top, foot, front });
    y = front.end + 1;
  }

  // 세로 길: 지도를 끝까지 지나는 큰 길 하나(다리·육교가 여기 선다) + 넓은 지도면 하나 더(끝까지 또는 T자).
  const wantOverpass = kind.pieces.includes("overpass") && kind.cross === "kerb" && bands[0]!.foot - bands[0]!.top + 1 >= 10 && rng() < 0.85;
  const mk = (x: number, lane: number, from: number, to: number, main: boolean): SceneVStreet => {
    const sw = kind.cross === "lane" ? 0 : 1;
    return { x, lane, sw, w: lane + 2 * sw, from, to, main, arcade: kind.cross === "arcade", y0: from === 0 ? 0 : bands[from - 1]!.front.road1 + 1, y1: to === N - 1 ? H - 1 : bands[to]!.front.road0 - 1 };
  };
  const laneOf = () => (kind.cross === "arcade" ? 3 : kind.crossLane[0]! + Math.floor(rng() * (kind.crossLane[1]! - kind.crossLane[0]! + 1)));
  const vstreets: SceneVStreet[] = [];
  const two = W >= 52 && rng() < 0.8;
  const mainLane = wantOverpass ? 4 : laneOf();
  const mx = two ? Math.floor(W * (rng() < 0.5 ? 0.28 : 0.6) + rng() * 4) : Math.floor(W * 0.38 + rng() * W * 0.2);
  vstreets.push(mk(Math.max(7, Math.min(W - 12, mx)), mainLane, 0, N - 1, true));
  if (two) {
    const m = vstreets[0]!;
    const left = m.x > W / 2;
    const x2 = left ? 8 + Math.floor(rng() * Math.max(1, m.x - 26)) : m.x + m.w + 15 + Math.floor(rng() * Math.max(1, W - m.x - m.w - 26));
    if (x2 >= 7 && x2 + 5 <= W - 7 && Math.abs(x2 - m.x) >= 14) {
      const r = rng();
      const river = bands.findIndex((b) => b.front.type === "river");
      let from = 0, to = N - 1;
      if (r < 0.3 && N >= 3) from = 1; else if (r < 0.55 && N >= 3) to = N - 2;
      if (river >= 0 && from <= river && to > river && rng() < 0.5) { if (river + 1 <= N - 1) from = river + 1; }   // 다리는 하나면 된다 — 가끔 둘
      vstreets.push(mk(x2, laneOf(), from, to, false));
    }
  }
  return { bands, vstreets, blocks: [], ...(wantOverpass ? { overpass: true } : {}) } as SceneLayout & { overpass?: boolean };
}

function paintStreets(c: SceneCtx, L: SceneLayout): void {
  const { W, tone } = c;
  c.fill(0, 0, W, c.H, tone.lot[0]!);
  for (const b of L.bands) {
    const s = b.front;
    if (s.type === "kerb") {
      c.fill(0, s.nA, W, 2, tone.sidewalk); c.fill(0, s.road0, W, s.road1 - s.road0 + 1, tone.road); c.fill(0, s.sA!, W, 2, tone.sidewalk);
      c.mark(0, s.road0, W, s.road1 - s.road0 + 1, Occ.Road); c.mark(0, s.sA!, W, 1, Occ.Walk);
    } else if (s.type === "lane") {
      c.fill(0, s.road0, W, 4, tone.road); c.mark(0, s.road0, W, 4, Occ.Road);
    } else if (s.type === "mall") {
      c.fill(0, s.y0, W, 6, tone.plaza); c.mark(0, s.y0 + 1, W, 1, Occ.Walk); c.mark(0, s.y0 + 4, W, 1, Occ.Walk);
    } else if (s.type === "river") {
      const rv = s.river!;
      c.fill(0, s.nA, W, s.end - s.nA + 1, tone.plaza);
      c.fill(0, rv.water0, W, rv.water1 - rv.water0 + 1, "수로");
      c.mark(0, s.nA, W, 1, Occ.Walk); c.mark(0, rv.wall, W, rv.bank1 - rv.wall + 1, Occ.Water); c.mark(0, s.sA!, W, 1, Occ.Walk);
    } else {
      if (s.road0 > s.y0) c.fill(0, s.y0, W, 1, tone.sidewalk);
      c.fill(0, s.road0, W, s.road1 - s.road0 + 1, tone.road); c.mark(0, s.road0, W, s.road1 - s.road0 + 1, Occ.Road);
    }
  }
  for (const v of L.vstreets) {
    const h = v.y1 - v.y0 + 1;
    if (v.arcade) {
      // 시장 길: 띠 구간만 판석으로 덮고(차도 줄은 큰길 그대로) 양끝 칸은 지붕 밑 진열대(막힘).
      for (const b of L.bands) if (b.index >= v.from && b.index <= v.to) {
        const y0 = b.index === 0 ? 0 : (L.bands[b.index - 1]!.front.sA ?? b.top), y1 = b.front.type === "edge" ? b.front.y0 : (b.front.nK ?? b.foot);
        c.fill(v.x, y0, v.w, y1 - y0 + 1, tone.plaza);
        c.mark(v.x + 1, y0, v.w - 2, y1 - y0 + 1, Occ.Walk); c.mark(v.x, y0, 1, y1 - y0 + 1, Occ.Wall); c.mark(v.x + v.w - 1, y0, 1, y1 - y0 + 1, Occ.Wall);
      }
      continue;
    }
    c.fill(v.x + v.sw, v.y0, v.lane, h, tone.road); c.mark(v.x + v.sw, v.y0, v.lane, h, Occ.Road);
    if (v.sw) for (const b of L.bands) if (b.index >= v.from && b.index <= v.to) {
      const y0 = b.top, hh = b.foot - b.top + 1;
      for (const x of [v.x, v.x + v.w - 1]) { c.fill(x, y0, 1, hh, tone.sidewalk); c.mark(x, y0, 1, hh, Occ.Walk); }
    }
    // 중앙 점선: 띠 구간만(큰길·하천 줄은 비운다)
    if (v.lane >= 2) for (const b of L.bands) if (b.index >= v.from && b.index <= v.to) for (let y = b.top + 1; y < b.foot; y += 2) c.raw(v.lane % 2 === 0 ? "jp-mark-center-v-l" : "jp-mark-center-v", v.x + v.sw + Math.floor(v.lane / 2), y, "road");
  }
}

function makeBlocks(L: SceneLayout, W: number): void {
  for (const b of L.bands) {
    const cuts = L.vstreets.filter((v) => b.index >= v.from && b.index <= v.to).sort((p, q) => p.x - q.x);
    let x = 0;
    const push = (sx: number, ex: number) => { if (ex - sx >= 4) L.blocks.push({ band: b, sx, ex, use: "", edgeW: sx === 0, edgeE: ex === W }); };
    for (const v of cuts) { push(x, v.x); x = v.x + v.w; }
    push(x, W);
  }
}

/** 구획 쓰임: 종류의 조각(공원·신사·주차장 …)을 맞는 구획에 먼저 놓고(큰 구획은 한쪽을 잘라 쓴다), 나머지는 가게 줄 또는 집 줄. */
function assignUses(c: SceneCtx, L: SceneLayout, shops: number): void {
  const { rng, kind } = c;
  const N = L.bands.length;
  const want = [...kind.pieces].filter((p) => PIECES[p]).map((p) => ({ p, r: rng() })).sort((a, b) => a.r - b.r).map((x) => x.p);
  const maxPieces = c.W * c.H >= 2400 ? 3 : c.W * c.H >= 1500 ? 2 : 1;
  let n = 0;
  for (const p of want) {
    if (n >= maxPieces) break;
    const def: PieceDef = PIECES[p]!;
    const fits = L.blocks.filter((b) => !b.use && b.ex - b.sx >= def.minW && b.band.foot - b.band.top + 1 >= def.minH && (!def.band || def.band(b.band.index, N)));
    if (!fits.length) continue;
    // 맨 아래 띠가 조각으로만 차지 않게: 아래 띠를 먼저 고르는 조각은 그 띠에 조각이 적을 때만(띠 둘이면 하나, 셋 이상이면 둘).
    const inBottom = L.blocks.filter((b) => b.band.index === N - 1 && PIECES[b.use]).length;
    const pref = fits.filter((b) => (def.bottom && inBottom < (N >= 3 ? 2 : 1) ? b.band.index === N - 1 : b.band.index !== N - 1 || inBottom < (N >= 3 ? 2 : 1)));
    if (!pref.length) continue;
    const blk = pref[Math.floor(rng() * pref.length)]!;
    const w = blk.ex - blk.sx, pw = Math.min(w, def.prefW + Math.floor(rng() * 3));
    if (w - pw >= 7) {
      // 길모퉁이 쪽(세로 길에 닿는 쪽)을 조각이 쓴다 — 지도 끝이 아닌 쪽
      const atEast = blk.edgeW ? true : blk.edgeE ? false : rng() < 0.5;
      const piece: SceneBlock = { band: blk.band, sx: atEast ? blk.ex - pw : blk.sx, ex: atEast ? blk.ex : blk.sx + pw, use: p, edgeW: !atEast && blk.edgeW, edgeE: atEast && blk.edgeE };
      if (atEast) blk.ex -= pw; else blk.sx += pw;
      L.blocks.push(piece);
    } else blk.use = p;
    n++;
  }
  let shopBlocks = 0;
  for (const b of L.blocks) if (!b.use) { b.use = rng() < kind.houseShare ? "house" : "shop"; if (b.use === "shop") shopBlocks++; }
  if (shops > 0 && !shopBlocks) { const b = L.blocks.filter((q) => q.use === "house").sort((p, q) => (q.ex - q.sx) - (p.ex - p.sx))[0]; if (b) b.use = "shop"; }
}

export function planJpCityScene(opts: SceneOptions): ScenePlan {
  const { mapId, width: W, height: H, seed } = opts;
  const style: SceneStyle = opts.style ?? "shopping";
  const key = opts.key || "default";
  const kind = pickSceneKind({ style, shops: opts.shops, key, seed, kind: opts.kind });
  const tone = sceneTone(kind, key);
  const c = new SceneCtx(mapId, W, H, kind, tone, key, seed, mulberry((Math.imul(seed + 1, 0x9e3779b1) ^ lookHash(kind.id)) >>> 0));
  const L = layout(c) as SceneLayout & { overpass?: boolean };
  paintStreets(c, L);
  makeBlocks(L, W);
  if (L.overpass) placeOverpass(c, L);
  dressRiver(c, L);
  assignUses(c, L, opts.shops?.length ?? 0);
  const wanted = [...(opts.shops ?? [])];
  // 구획 바닥: 톤 벌의 대지 재료를 구획마다 돌린다(한 색 한 덩이가 되지 않게)
  L.blocks.forEach((b, i) => {
    const lot = tone.lot[(i + (lookHash(key) & 3)) % tone.lot.length]!;
    if (lot !== tone.lot[0]) c.fill(b.sx, b.band.top, b.ex - b.sx, b.band.foot - b.band.top + 1, lot);
  });
  // 가게 줄부터(요청한 가게가 먼저 선다), 그다음 조각·집 줄
  for (const b of [...L.blocks].sort((p, q) => Number(q.use === "shop") - Number(p.use === "shop") || p.band.index - q.band.index || p.sx - q.sx)) {
    const piece = PIECES[b.use];
    if (piece) {
      // 키 큰 띠에서는 조각이 앞쪽 10줄만 쓰고, 그 뒤는 뒷골목과 뒷줄 건물이다(조각 뒤가 빈 대지로 남지 않게).
      const fTop = rearTop(c, b, Math.max(10, piece.minH));
      const part: SceneBlock = fTop > b.band.top ? { ...b, band: { ...b.band, top: fTop } } : b;
      if (!piece.run(c, L, part)) { b.use = c.kind.houseShare > 0.5 ? "house" : "shop"; fillRows(c, L, b, wanted); }
      else { c.piecesUsed.push(b.use); fillRear(c, b, fTop, c.kind.houseShare > 0.5); }
    }
    else fillRows(c, L, b, wanted);
  }
  dressStreets(c, L, opts.crosswalkTile);
  const built = c.placed;
  const lotFree = new Uint8Array(W * H);
  for (const b of L.blocks) if (!PIECES[b.use]) for (let y = b.band.top + 1; y <= b.band.foot; y++) for (let x = b.sx; x < b.ex; x++) if (c.occ[y * W + x] === Occ.Lot && !c.drawn[y * W + x]) lotFree[y * W + x] = 1;
  const scenes = [...c.scenesUsed];
  const streetKo = (t: string) => ({ kerb: "연석 차도", lane: "생활도로", mall: "보행자 시장 길", river: "하천", edge: "아래 끝 길" } as Record<string, string>)[t] ?? t;
  return {
    steps: c.steps(), mapId, seed, style,
    buildings: built.map((p) => ({ role: p.role, x: p.x, foot: p.foot, w: p.w, h: p.h })),
    walkRows: L.bands.flatMap((b) => [b.front.nA, ...(b.front.sA !== undefined ? [b.front.sA] : [])]),
    parks: [],
    kind, tone, placed: built, lotFree, scenes, pieces: c.piecesUsed,
    summary: `${kind.ko} ${W}×${H} — 띠 ${L.bands.length}줄(발 ${L.bands.map((b) => `y${b.foot}`).join("·")}), 큰길 ${L.bands.slice(0, -1).map((b) => streetKo(b.front.type)).join("·")}, 세로 길 ${L.vstreets.length}, 톤 ${tone.ko}, 구획 ${[...new Set(L.blocks.map((b) => b.use))].join("·")}, 장면 ${scenes.map(sceneKo).join("·")}, 건물 ${built.length}채(${built.map((p) => p.role).join("·")})`,
  };
}
