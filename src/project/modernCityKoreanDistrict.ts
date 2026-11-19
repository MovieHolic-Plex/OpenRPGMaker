// project/modernCityKoreanDistrict.ts
// 한국 도시 지구 구성기 — 지구 종류(modernCityDistrictKinds)의 길 줄을 위에서 아래로 쌓고, 건물 줄을 벽을 맞대어 세우고, 남는 자리는 쓰임으로 채운다.
// 길 위계: 대로는 많아야 하나(차도 4~6칸·중앙선·횡단보도·넓은 보도) · 이면도로 2칸(일방, 중앙선 없음) · 골목 3~4칸(차선 없음, 골목 바닥 — 차도가 아니다).
// 블록: 건물 줄은 남쪽 길로 문을 내고, 줄 사이 1~2칸 골목 틈이 위아래 길을 잇는다. 건물 뒤는 마당(뒤 주차·나무·잡동사니), 빈 필지는 주차장·쌈지 공원·놀이터·시장 통로·공사장.
// 잔디밭은 쌈지 공원 가장자리와 천변 둑뿐이다. 순수 함수(프로젝트를 모른다) — 도달은 여기서 보수적으로 한 번 재고, 도구가 엔진 통행으로 다시 잰다.
import { transitLane } from "./mapTransit";
import { autoTrafficRoutes, DEFAULT_MODERN_CAR_MIX, type RoadBand, type StopAnchor } from "./transitAuto";
import { BIG_STREET_TREES, Board, mulberry, pick, shuffle, type MCPalette } from "./modernCityBoard";
import { KR_DISTRICT_DATA, pickDistrictKind, type KRDistrictKind, type KRStrip } from "./modernCityDistrictKinds";
import { fillBuildingRow, koreanBuildingCatalog, type KRPlaced, type KRRowState } from "./modernCityKoreanBuildings";
import { koreanGround, type KRGround } from "./modernCityKoreanGround";
import { backYard, fillLot, lineProps, parkingLane, putDecal, putOn, putScene, roofScene, slotKits } from "./modernCityKoreanLots";
import type { MCStreetResult, MCStreetSpec, MCSubwayExit } from "./modernCityStreetComposer";

interface Band { readonly s: KRStrip; y0: number; y1: number; roadY?: number; roadW?: number; /** 차도 아래에 붙은 길가 주차 띠(아스팔트, 달리는 차선이 아니다)의 줄 수 */ parkW?: number }
const NS_W = 4;   // 세로 이면도로: 보도 1 + 차도 2 + 보도 1
interface VRoad { readonly x: number; readonly y0: number; readonly y1: number; readonly w: number; readonly lane: boolean; readonly through: boolean }

function stripHeight(s: KRStrip, wide: boolean): number {
  return s.t === "blvd" ? 7 + (wide ? 6 : 4) : s.t === "side" ? 5 : s.t === "sidep" ? 7 : s.t === "alley" ? s.h ?? 3 : s.t === "plaza" ? s.h ?? 4 : s.t === "river" ? 7 : s.min ?? 7;
}
/** 줄을 맵 높이에 맞춘다: 모자라면 줄을 덜고(기본 위에서, trim:"bottom" 은 아래에서), 남으면 건물 줄+골목을 더하고, 나머지는 건물 줄 높이로 나눈다. */
function fitStrips(kind: KRDistrictKind, H: number, wide: boolean, r: () => number, tall = 0, anchorH: (s: KRStrip) => number = () => 0): Band[] {
  // 낮은 맵(40줄 미만)에는 대로를 두지 않는다 — 11~13줄 대로가 건물 줄 하나를 밀어낸다. 그 자리는 이면도로다.
  let list = H < 40 ? kind.strips.map((s): KRStrip => (s.t === "blvd" ? { t: "side" } : s)) : [...kind.strips];
  const minSum = () => list.reduce((a, s) => a + stripHeight(s, wide), 0);
  while (minSum() > H && list.length > 2) {
    if (kind.trim === "bottom") { list.pop(); while (list.length > 2 && list[list.length - 1]!.t === "B") list.pop(); }
    else { list.shift(); while (list.length > 2 && list[0]!.t !== "B") list.shift(); }
  }
  // 높은 건물(랜드마크·바란 가게)이 설 줄이 안 나오면 건물 줄 하나와 그 옆 길을 덜어 높이를 번다 — 건물 줄은 둘은 남긴다.
  const roomFor = () => H - list.reduce((a, s) => a + stripHeight(s, wide), 0) + Math.max(...list.filter((s) => s.t === "B").map((s) => s.min ?? 7));
  while (tall > 0 && roomFor() < tall && list.filter((s) => s.t === "B").length > 2) {
    const i = kind.trim === "bottom" ? list.map((s) => s.t).lastIndexOf("B") : list.findIndex((s) => s.t === "B");
    const j = list[i + 1] && list[i + 1]!.t !== "B" && list[i + 1]!.t !== "blvd" ? i + 1 : list[i - 1] && list[i - 1]!.t !== "B" && list[i - 1]!.t !== "blvd" ? i - 1 : -1;
    list = list.filter((_, k) => k !== i && k !== j);
  }
  const firstB = list.find((s) => s.t === "B") ?? { t: "B" as const, min: 7, max: 9, mix: "shop" };
  while (H - tall - list.reduce((a, s) => a + (s.t === "B" ? s.max ?? 9 : stripHeight(s, wide)), 0) >= (firstB.min ?? 7) + 3) list = [{ ...firstB, anchor: undefined }, { t: "alley" }, ...list];
  if (list[list.length - 1]!.t === "B") list.push({ t: "alley" });
  const h = list.map((s) => stripHeight(s, wide));
  let extra = H - h.reduce((a, c) => a + c, 0);
  if (extra < 0) throw new Error(`맵 높이 ${H} 로는 ${kind.ko} 지구를 세울 수 없다`);
  const bs = shuffle(r, list.map((s, i) => (s.t === "B" ? i : -1)).filter((i) => i >= 0));
  if (tall > 0 && bs.length) {
    // 가장 높이 자랄 수 있는 줄을 tall 까지 — 남는 줄이 모자라면 다른 건물 줄에서 한 줄씩 덜어 온다(최소 높이는 지킨다).
    const top = [...bs].sort((p, q) => (list[q]!.max ?? 9) - (list[p]!.max ?? 9))[0]!;
    while (h[top]! < tall) {
      if (extra > 0) extra--;
      else { const from = bs.find((i) => i !== top && h[i]! > (list[i]!.min ?? 7)); if (from === undefined) break; h[from]!--; }
      h[top]!++;
    }
  }
  // 제자리 건물 줄: 그 줄에 설 초대형·랜드마크 키트의 높이까지(남는 줄, 모자라면 다른 건물 줄에서 한 줄씩) — 그다음 최대 높이까지.
  for (const i of bs) {
    const want = Math.min(16, anchorH(list[i]!));
    while (h[i]! < want) {
      if (extra > 0) extra--;
      else { const from = bs.find((j) => j !== i && h[j]! > (list[j]!.min ?? 7)); if (from === undefined) break; h[from]!--; }
      h[i]!++;
    }
    if (list[i]!.anchor?.length) while (extra > 0 && h[i]! < (list[i]!.max ?? 9)) { h[i]!++; extra--; }
  }
  for (let pass = 0; pass < 8 && extra > 0; pass++) for (const i of bs) if (extra > 0 && h[i]! < (list[i]!.max ?? 9)) { h[i]!++; extra--; }
  for (const t of ["plaza", "alley"] as const) for (let i = 0; i < list.length && extra > 0; i++) if (list[i]!.t === t && h[i]! < 5) { h[i]!++; extra--; }
  for (let k = 0; extra > 0 && bs.length; k++, extra--) h[bs[k % bs.length]!]!++;
  let y = 0;
  return list.map((s, i) => { const band: Band = { s, y0: y, y1: y + h[i]! - 1 }; y += h[i]!; return band; });
}

function paintBand(b: Board, g: KRGround, band: Band, wide: boolean) {
  const { s, y0, y1 } = band, W = b.W;
  const row = (y: number, f: (x: number, y: number) => void) => { for (let x = 0; x < W; x++) f(x, y); };
  if (s.t === "blvd") {
    const rw = wide ? 6 : 4; band.roadY = y0 + 4; band.roadW = rw;
    for (const y of [y0, y0 + 1, y0 + 2]) row(y, g.walk);
    row(y0 + 3, (x, y) => g.curb(x, y, "s"));
    for (let x = 0; x < W; x++) g.roadColumn(x, y0 + 4, rw);
    row(y0 + 4 + rw, (x, y) => g.curb(x, y, "n"));
    for (const y of [y0 + 5 + rw, y0 + 6 + rw]) row(y, g.walk);
  } else if (s.t === "side" || s.t === "sidep") {
    band.roadY = y0 + 2; band.roadW = 2;
    row(y0, g.walk); row(y0 + 1, (x, y) => g.curb(x, y, "s"));
    row(y0 + 2, g.asphalt); row(y0 + 3, g.asphalt);
    // 길가 주차 띠: 차도와 같은 아스팔트 두 줄(달리는 차선이 아니다) — 주차한 차가 보도가 아니라 길 가장자리에 선 것으로 읽힌다.
    if (s.t === "side") row(y0 + 4, (x, y) => g.curb(x, y, "n")); else { band.parkW = 2; for (const y of [y0 + 4, y0 + 5]) row(y, g.asphalt); row(y0 + 6, (x, y) => g.curb(x, y, "n")); }
  } else if (s.t === "alley") { for (let y = y0; y <= y1; y++) row(y, s.arcade ? g.arcade : (x, yy) => g.alley(x, yy, "walk")); }
  else if (s.t === "plaza") { for (let y = y0; y <= y1; y++) row(y, g.plaza); }
  else if (s.t === "river") {
    // 둑 위 보도 · 붉은 자전거길 · 풀 둑(나무·벤치) · 물 · 남쪽 산책로 두 줄
    row(y0, g.walk); row(y0 + 1, g.bike); row(y0 + 2, g.lawn);
    for (let y = y0 + 3; y <= y1 - 2; y++) row(y, g.water);
    row(y1 - 1, g.deck); row(y1, g.walk);
  }
}

/** 보수적 도달 검사(막힌 칸 = 건물·기물·차·물) — 시작 칸에서 모든 문 접근칸·출구 발판. */
function reaches(b: Board, start: { x: number; y: number }, targets: readonly { x: number; y: number }[]): boolean {
  // 행인의 길: 차선(아스팔트)은 횡단보도 칸으로만 건넌다 — 행인 도구(add_street_walkers)의 길 찾기와 같은 규칙.
  const cross = new Set(b.pal.group("mc:crosswalk"));
  const open = (i: number) => b.use[i] !== "bld" && b.use[i] !== "prop" && b.use[i] !== "veh" && (b.use[i] !== "road" || cross.has(b.lower[i]!));
  if (!open(b.k(start.x, start.y))) return false;
  const seen = new Uint8Array(b.W * b.H); const q = [b.k(start.x, start.y)]; seen[q[0]!] = 1;
  while (q.length) {
    const i = q.pop()!, x = i % b.W, y = (i - x) / b.W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const X = x + dx, Y = y + dy; if (!b.in(X, Y)) continue; const j = b.k(X, Y); if (!seen[j] && open(j)) { seen[j] = 1; q.push(j); } }
  }
  return targets.every((t) => seen[b.k(t.x, t.y)] === 1);
}

function build(spec: MCStreetSpec, pal: MCPalette, kind: KRDistrictKind, r: () => number): MCStreetResult {
  const W = spec.width, H = spec.height, D = KR_DISTRICT_DATA, district = spec.district ?? {};
  const b = new Board(W, H, pal), g = koreanGround(b, pal, kind.ground);
  b.krSets = kind.sets;
  const wide = W >= 56 && H >= 46 && kind.blvdLanes !== 4;
  // 바란 가게·랜드마크가 서려면 그 키트 높이의 건물 줄이 하나는 있어야 한다 — 가장 낮은 후보의 높이를 줄 하나에 먼저 준다.
  const cat = koreanBuildingCatalog(pal);
  const wishTypes = [...(spec.shops ?? []).map((w) => w.replace(/^mc-bld-/, "")), ...(district.landmark ? [district.landmark] : [])];
  const tall = Math.min(14, Math.max(0, ...wishTypes.map((w) => Math.min(99, ...cat.filter((c) => (D.wish[w] ?? [w]).includes(c.type)).map((c) => c.h))).filter((h) => h < 99)));
  // 제자리 건물 순서: 시트에 있는 한국 키트를 씨앗으로 섞어 먼저, 그다음 자료 순서(공용 키트). 줄 높이는 그 첫 후보가 서도록 잡는다.
  const have = new Set(cat.map((c) => c.type));
  const anchors = new Map<KRStrip, string[]>();
  for (const s of kind.strips) if (s.anchor?.length) { const here = s.anchor.filter((t) => have.has(t)); anchors.set(s, [...shuffle(r, here.filter((t) => t.startsWith("kr-"))), ...here.filter((t) => !t.startsWith("kr-"))]); }
  const anchorH = (s: KRStrip) => { const t = anchors.get(s)?.[0]; return t ? Math.min(...cat.filter((c) => c.type === t).map((c) => c.h)) : 0; };
  const bands = fitStrips(kind, H, wide, r, tall, anchorH);
  for (const band of bands) paintBand(b, g, band, wide);
  // 세로 길 — 종류마다 뼈대가 다르다(씨앗이 후보 가운데 하나를 고른다): 맵을 꿰는 이면도로 · 한 길에서 끝나는 T자 · 위아래가 어긋난 두 T자 · 차 없는 보행 통로 · 없음(골목 틈으로만 잇는다).
  const isB = (x: Band) => x.s.t === "B";
  const pickX = () => Math.max(12, Math.min(W - 12 - NS_W, Math.floor(W * (0.3 + r() * 0.4))));
  const vroads: VRoad[] = [];
  const shape = kind.ns.length ? kind.ns[Math.floor(r() * kind.ns.length)]! : "none";
  const junctions = bands.map((x, i) => (!isB(x) && i > 0 && i < bands.length - 1 && bands.slice(0, i).some(isB) && bands.slice(i + 1).some(isB) ? i : -1)).filter((i) => i >= 0);
  if (shape === "through" || shape === "lane" || (shape !== "none" && !junctions.length)) vroads.push({ x: pickX(), y0: 0, y1: H - 1, w: shape === "lane" ? 3 : NS_W, lane: shape === "lane", through: true });
  else if (shape !== "none") {
    const roads = junctions.filter((i) => bands[i]!.roadY !== undefined);
    const J = bands[pick(r, roads.length ? roads : junctions)]!;
    const up = (x: number): VRoad => ({ x, y0: 0, y1: J.roadY !== undefined ? J.roadY - 1 : J.y0 - 1, w: NS_W, lane: false, through: false });
    const down = (x: number): VRoad => ({ x, y0: J.roadY !== undefined ? J.roadY + J.roadW! : J.y1 + 1, y1: H - 1, w: NS_W, lane: false, through: false });
    if (shape === "t-up") vroads.push(up(pickX()));
    else if (shape === "t-down") vroads.push(down(pickX()));
    else { const a = 12 + Math.floor(r() * Math.max(1, Math.floor(W / 2) - 20)), c = Math.min(W - 12 - NS_W, a + 14 + Math.floor(r() * Math.max(1, W - a - 30))); const flip = r() < 0.5; vroads.push(up(flip ? a : c), down(flip ? c : a)); }
  }
  const bandAt = (y: number) => bands.find((x) => y >= x.y0 && y <= x.y1)!;
  for (const v of vroads) for (let y = v.y0; y <= v.y1; y++) {
    const band = bandAt(y), t = band.s.t;
    const onRoad = band.roadY !== undefined && y >= band.roadY && y < band.roadY + band.roadW! + (band.parkW ?? 0);
    if (band.parkW && y >= band.roadY! + band.roadW!) for (let x = v.x; x < v.x + v.w; x++) b.keep[b.k(x, y)] = true;      // 세로 길 어귀에는 차를 세우지 않는다
    // 세로 길을 건너는 자리: 골목은 지나는 줄, 이면도로·대로는 보도 줄 — 행인은 횡단보도로만 차도를 건넌다.
    const crossRow = t === "alley" || t === "plaza" || t === "river" ? y === band.y0 + 1 : t === "blvd" ? y === band.y0 + 1 || y === band.y1 - 1 : t === "B" ? false : y === band.y0 + 1 || y === band.y1;
    if (v.lane) { for (let x = v.x; x < v.x + v.w; x++) { if (onRoad) g.crosswalk(x, y, "ew"); else g.plaza(x, y); } b.keep[b.k(v.x + 1, y)] = true; continue; }
    for (const x of [v.x + 1, v.x + 2]) { if (crossRow) g.crosswalk(x, y, "ns"); else g.asphalt(x, y); }
    for (const x of [v.x, v.x + 3]) { if (onRoad) g.crosswalk(x, y, "ew"); else g.walk(x, y); b.keep[b.k(x, y)] = true; }      // 세로 길 보도는 지나는 길 — 기물을 세우지 않는다
  }
  // 시장 입구 간판(그림이 있을 때): 보행 통로가 이면도로 보도와 만나는 자리에 하나 — 기둥 둘 사이로 지나간다.
  for (const v of vroads) if (v.lane && pal.kit("mc-prop-kr-market-gate")) {
    const side = bands.find((x) => x.roadY !== undefined && x.y0 >= 3);
    if (side && b.propOver("mc-prop-kr-market-gate", v.x, side.y0 - 2, ["walk"])) b.keep[b.k(v.x + 1, side.y0)] = true;
  }
  const crossing = (band: Band) => vroads.filter((v) => v.y0 <= band.y0 && v.y1 >= band.y1).sort((p, q) => p.x - q.x);
  const segsOf = (band: Band): [number, number][] => { const out: [number, number][] = []; let from = 0; for (const v of crossing(band)) { out.push([from, v.x - 1]); from = v.x + v.w; } out.push([from, W - 1]); return out; };
  const widest = (band: Band) => segsOf(band).reduce((p, q) => (q[1] - q[0] > p[1] - p[0] ? q : p));
  // 길을 건너는 횡단보도(가장 넓은 구간 가운데, 2칸 폭)
  const crossings: { x: number; band: Band }[] = [];
  for (const band of bands) if (band.roadY !== undefined) {
    const far = widest(band); const cx = far[0] + Math.floor((far[1] - far[0]) / 2) + (band.s.t === "blvd" ? 0 : 3);
    for (const x of [cx, cx + 1]) for (let y = band.roadY!; y < band.roadY! + band.roadW! + (band.parkW ?? 0); y++) { g.crosswalk(x, y, "ew"); if (y >= band.roadY! + band.roadW!) b.keep[b.k(x, y)] = true; }
    crossings.push({ x: cx, band });
    // 횡단보도 머리(차도 가장자리에서 지나는 줄까지)에는 기물을 세우지 않는다.
    const top = band.s.t === "blvd" ? band.y0 + 1 : band.y0 + 1, bottom = band.s.t === "blvd" ? band.y1 - 1 : band.y1;
    for (const x of [cx, cx + 1]) { for (let y = top; y < band.roadY!; y++) b.keep[b.k(x, y)] = true; for (let y = band.roadY! + band.roadW! + (band.parkW ?? 0); y <= bottom; y++) b.keep[b.k(x, y)] = true; }
  }
  // ── 건물 줄 ──
  const st: KRRowState = { row: new Map(), counts: new Map(), usedKits: new Set(), wishes: shuffle(r, [...(spec.shops ?? [])].map((s) => s.replace(/^mc-bld-/, ""))) };
  const bBands = bands.filter((x) => x.s.t === "B");
  const below = (band: Band) => bands[bands.indexOf(band) + 1];
  // 빈 필지: 넓은 구간 가운데 씨앗으로 고른 자리에 종류의 쓰임을 하나씩(많아야 셋).
  const lotAt = new Map<string, string>();
  const lotCands = shuffle(r, bBands.flatMap((band) => segsOf(band).filter((s) => s[1] - s[0] + 1 >= 15).map((s) => `${band.y0}:${s[0]}`)));
  const monument = (kind.monument ?? []).find((t) => pal.kit(`mc-bld-${t}`));
  [...(monument ? [`monument:${monument}`] : []), ...shuffle(r, [...kind.lots])].slice(0, Math.max(1, Math.min(kind.lotN ?? 3, bBands.length - 1))).forEach((use, i) => { if (lotCands[i]) lotAt.set(lotCands[i]!, use); });
  // 지하철 출구: 대로·광장을 마주한 줄의 세로 길 쪽 끝(모퉁이)에 5칸 자리.
  const wantExits = Math.max(0, Math.min(4, Math.round(district.subwayExits ?? kind.subway)));
  const exitSlots: { x: number; band: Band }[] = [];
  // 출구 자리: 길을 마주한 줄의 구간 끝(세로 길 쪽 모퉁이 먼저). 대로·광장을 마주한 줄 먼저, 그다음 이면도로, 골목은 마지막.
  const rank = (band: Band) => ({ blvd: 0, plaza: 0, side: 1, sidep: 1, river: 2, alley: 3, B: 9 } as const)[below(band)?.s.t ?? "B"];
  const facing = shuffle(r, bBands.filter((band) => rank(band) < 9).flatMap((band) => segsOf(band).filter((s) => s[1] - s[0] + 1 >= 12).map((s) => ({ band, s })))).sort((p, q) => rank(p.band) - rank(q.band));
  const exitAt = new Map<string, number>();
  for (const f of facing) { if (exitAt.size >= wantExits) break; exitAt.set(`${f.band.y0}:${f.s[0]}`, f.s[1] < W - 1 ? f.s[1] - 4 : f.s[0]); }   // 세로 길 쪽 모퉁이(오른쪽 끝이 길에 닿으면 그 끝)
  const landmark = district.landmark; const tallest = [...bBands].sort((p, q) => (q.y1 - q.y0) - (p.y1 - p.y0))[0];
  const uses: string[] = [];
  for (const band of bBands) {
    const mix = D.mixes[band.s.mix ?? "shop"] ?? D.mixes.shop!;
    let anchor: readonly string[] | undefined = [...(landmark && band === tallest ? [landmark] : []), ...(anchors.get(band.s) ?? [])];
    const placedAll: KRPlaced[] = [];
    st.row = new Map(); st.last = undefined;
    for (const [sx0, sx1] of segsOf(band)) {
      let x0 = sx0, x1 = sx1; const key = `${band.y0}:${sx0}`;
      const ex = exitAt.get(key);
      if (ex !== undefined) { exitSlots.push({ x: ex, band }); if (ex === sx0) x0 += 5; else x1 -= 5; }
      const lot = lotAt.get(key);
      if (lot) {
        const [lo, hi] = (D as unknown as { lots: Record<string, { w: [number, number] }> }).lots[lot]?.w ?? [6, 9];
        const lw = Math.min(x1 - x0 - 7, lo + Math.floor(r() * (hi - lo + 1)));
        if (lw >= 4) { const left = r() < 0.5; const q = left ? { x0, x1: x0 + lw - 1 } : { x0: x1 - lw + 1, x1 }; uses.push(fillLot(b, r, g, lot, { ...q, y0: band.y0, y1: band.y1 })); if (left) x0 += lw; else x1 -= lw; }
      }
      // 건물 둘~넷을 벽을 맞대어 세우고 골목 틈(1~2칸) 하나 — 틈은 위아래 길을 잇는다. 첫 열은 지나는 길, 둘째 열에 잡동사니.
      let cur = x0;
      const gapCells = (g0: number, g1: number) => {
        for (let x = g0; x <= g1; x++) for (let y = band.y0; y <= band.y1; y++) if (b.use[b.k(x, y)] === "ground") { g.alley(x, y, "walk"); if (x === g0) b.keep[b.k(x, y)] = true; }
        const ids = [...slotKits(b, "yard"), ...slotKits(b, "kr-gap")];
        if (g1 > g0 && ids.length) for (let y = band.y0 + 1; y <= band.y1; y += 2 + Math.floor(r() * 2)) putOn(b, pick(r, ids), g1, y, ["walk"]);
      };
      while (cur <= x1) {
        const placed = fillBuildingRow(b, r, cat, mix, st, cur, x1, band.y0, band.y1, anchor?.length ? anchor : undefined, 2 + Math.floor(r() * 3));
        if (anchor?.length && placed[0] && anchor.includes(placed[0].type)) anchor = undefined;   // 제자리 건물은 설 때까지 다음 묶음에서도 먼저 시도한다
        if (!placed.length) {
          // 건물이 더 서지 않는 자리: 넓으면 쓰임(필지)으로, 좁으면 골목 틈으로.
          if (x1 - cur + 1 >= 5) {
            // 한 필지는 6~10칸 — 더 넓게 남으면 쓰임을 바꿔 가며 나눈다(빈 모래밭 한 판이 되지 않게).
            const pool = [...kind.lots, "parking", "pocket"];
            while (x1 - cur + 1 >= 5) {
              if (cur > x0) { gapCells(cur, cur); cur++; }
              const lw = x1 - cur + 1 <= 11 ? x1 - cur + 1 : 6 + Math.floor(r() * 4);
              uses.push(fillLot(b, r, g, pool[(uses.length + lotAt.size) % pool.length]!, { x0: cur, x1: cur + lw - 1, y0: band.y0, y1: band.y1 }));
              cur += lw;
            }
            if (cur <= x1) gapCells(cur, x1);
          }
          else gapCells(cur, x1);
          break;
        }
        placedAll.push(...placed);
        const last = placed[placed.length - 1]!; const filled = last.x + last.w;
        if (filled > x1) break;
        const gapW = x1 - filled + 1 <= 4 ? x1 - filled + 1 : kind.gaps[0] + Math.floor(r() * (kind.gaps[1] - kind.gaps[0] + 1)) >= 3 ? 2 : 1;
        gapCells(filled, filled + gapW - 1);
        cur = filled + gapW;
      }
    }
    for (const p of placedAll) roofScene(b, r, p.kit, p.x, p.y);
    // 가게 앞 타일(작은·중간 가게 문 앞 한 줄)과 시장 통로의 차양(가게 앞머리 위, 밑으로 지나간다).
    const front = below(band);
    if (front && front.s.t !== "B") for (const p of placedAll) {
      if (kind.frontTile && p.h <= 8 && r() < 0.6) for (let x = p.x; x < p.x + p.w; x++) g.front(x, band.y1 + 1);
      const awn = front.s.arcade ? slotKits(b, "awning") : [];
      if (awn.length) for (let x = p.x; x + 3 <= p.x + p.w; x += 3) if (r() < 0.75) b.propOver(pick(r, awn), x, band.y1 + 1, ["walk"]);
    }
    for (const p of placedAll) if (band.y1 - p.h + 1 > band.y0) backYard(b, r, g, { x0: p.x, x1: p.x + p.w - 1, y0: band.y0, y1: band.y1 - p.h }, kind.parked);
    for (let y = band.y0; y <= band.y1; y++) for (let x = 0; x < W; x++) if (b.use[b.k(x, y)] === "ground") g.yard(x, y);
  }
  // 막다른 골목: 골목 하나를 가운데쯤에서 울타리로 막는다 — 모든 문이 여전히 서로 닿을 때만(골목 틈·다른 길로 돌아간다).
  if (kind.deadEnd && pal.kit("mc-prop-fence-a")) {
    const alleys = shuffle(r, bands.filter((x) => x.s.t === "alley" && !x.s.arcade && x !== bands[bands.length - 1] && x.y0 > 0));
    for (const band of alleys) {
      const seg = widest(band); if (seg[1] - seg[0] < 14) continue;
      const x = seg[0] + 5 + Math.floor(r() * (seg[1] - seg[0] - 10));
      const cells = Array.from({ length: band.y1 - band.y0 + 1 }, (_, k) => b.k(x, band.y0 + k));
      if (cells.some((i) => b.use[i] !== "walk" || b.upper[i] >= 0)) continue;
      for (const i of cells) b.use[i] = "prop";
      const acc = b.buildings.flatMap((d) => d.access);
      if (acc.length && reaches(b, acc[0]!, acc)) { for (const i of cells) { b.use[i] = "walk"; b.keep[i] = false; b.prop(pick(r, ["mc-prop-fence-a", "mc-prop-fence-b"].filter((id) => pal.kit(id))), i % W, Math.floor(i / W), ["walk"]); } b.notes.push(`dead-end alley at (${x},${band.y0})`); break; }
      for (const i of cells) b.use[i] = "walk";
    }
  }
  if (b.buildings.length < 2) throw new Error(`건물을 ${b.buildings.length}채밖에 못 세웠다 — 맵을 키운다`);
  if (landmark) { const i = b.buildings.findIndex((d) => d.kind === landmark); if (i > 0) b.buildings.unshift(...b.buildings.splice(i, 1)); else if (i < 0) b.notes.push(`landmark ${landmark} was not placed (no row tall enough, or no such kit)`); }
  // 지하철 출구(입구 3×3 + 번호 표지)
  const subwayExits: MCSubwayExit[] = [];
  const subwayKits = ["mc-prop-subway-a", "mc-prop-subway-b", "mc-prop-subway-c"].filter((id) => pal.kit(id));
  exitSlots.forEach((slot, i) => {
    const id = subwayKits[i % Math.max(1, subwayKits.length)]; if (!id) return;
    const n = i + 1, kx = slot.x + 1, ky = slot.band.y1 - 2;
    for (let y = slot.band.y0; y <= slot.band.y1; y++) for (let x = slot.x; x < slot.x + 5; x++) if (b.use[b.k(x, y)] === "yard") b.use[b.k(x, y)] = "walk";
    if (!b.prop(id, kx, ky, ["walk"])) { b.notes.push(`지하철 ${n}번 출구 자리를 못 찾았다`); return; }
    if (exitSlots.length > 1) putOn(b, `mc-prop-kr-exit-${n}`, kx + 3, slot.band.y1, ["walk"]);
    for (const dx of [0, 1, 2]) if (b.in(kx + dx, ky + 3)) b.keep[b.k(kx + dx, ky + 3)] = true;
    subwayExits.push({ n, at: { x: kx, y: ky }, stair: { x: kx + 1, y: ky + 2 }, step: { x: kx + 1, y: ky + 3 } });
    b.notes.push(`지하철 ${exitSlots.length > 1 ? `${n}번 출구` : "입구"} (${kx},${ky}) — 계단 칸 (${kx + 1},${ky + 2}) 에 이동 이벤트, 나오는 칸 (${kx + 1},${ky + 3})`);
  });
  // ── 길가 ──
  const busStops: Array<{ x: number; y: number; at?: StopAnchor; name?: string; waitSec?: number }> = [];
  const spots: Record<string, { y: number; allow: readonly ("walk" | "yard" | "park")[] }[]> = {};
  const spot = (on: string, y: number) => (spots[on] ??= []).push({ y, allow: ["walk", "yard", "park"] });
  const poleAlong = (y: number) => { const ids = slotKits(b, "pole"); for (let x = 3 + Math.floor(r() * 6); x < W - 1 && ids.length; x += 11 + Math.floor(r() * 5)) putOn(b, pick(r, ids), x, y, ["walk", "yard"]); };
  for (const band of bands) {
    const { s, y0, y1 } = band; if (s.t === "B") continue;
    const hasFront = bands[bands.indexOf(band) - 1]?.s.t === "B";
    if (hasFront) spot("walkN", y0);
    if (s.t === "alley") {
      for (let x = 0; x < W; x++) b.keep[b.k(x, y0 + 1)] = true;      // 가운데 줄은 지나는 길
      spot("alleyS", y1);
      if (s.stalls) { const stalls = slotKits(b, "stall"); for (let x = 1 + Math.floor(r() * 3); x + 1 < W && stalls.length; x += 3 + Math.floor(r() * 3)) putOn(b, pick(r, stalls), x, y1, ["walk"]); }
      poleAlong(y1);
      for (let x = 4 + Math.floor(r() * 8); x < W - 2; x += 9 + Math.floor(r() * 9)) g.manhole(x, y0 + 1);
    } else if (s.t === "side" || s.t === "sidep") {
      // 지나는 줄: 북쪽은 연석 줄, 남쪽은 보도 한 줄 — 기물은 가게 앞 줄(맨 윗줄)에만 선다.
      for (let x = 0; x < W; x++) { b.keep[b.k(x, y0 + 1)] = true; b.keep[b.k(x, y1)] = true; }
      if (s.t === "sidep") parkingLane(b, r, 0, W - 1, y1 - 1, kind.parked + 0.3, ["road"]);
      poleAlong(y0);
      lineProps(b, r, "curb", 0, W - 1, y0, [7, 12], ["walk"]);
      for (let x = 6 + Math.floor(r() * 10); x < W - 2; x += 12 + Math.floor(r() * 10)) g.manhole(x, y0 + 2);
    } else if (s.t === "blvd") {
      const rw = band.roadW!, sy = y1;                                  // 남쪽 보도 맨 아랫줄
      for (let x = 0; x < W; x++) { g.tactile(x, y0 + 1); g.tactile(x, sy - 1); b.keep[b.k(x, sy - 1)] = true; }      // 점자 블록 줄 = 지나는 줄(남쪽). 북쪽은 지하보도 입구를 세운 뒤에 잡는다.
      spot("blvdN", y0 + 2); spot("blvdS", sy);
      const nearX = (x: number, pad: number) => crossing(band).some((v) => x >= v.x - pad && x < v.x + v.w + pad) || crossings.some((c) => c.band === band && x >= c.x - pad && x <= c.x + 1 + pad);
      // 지하보도 입구(그림이 있을 때): 북쪽 보도에 하나 — 계단은 연석 줄로 열린다. 보도 세 줄을 막으므로 연석 줄을 지나는 길로 남긴다.
      if (kind.underpass && pal.kit("mc-prop-kr-underpass")) for (let t = 0; t < 24; t++) {
        const x = 2 + Math.floor(r() * (W - 7)); if (nearX(x - 1, 2) || nearX(x + 3, 2)) continue;
        if (!b.prop("mc-prop-kr-underpass", x, y0, ["walk"])) continue;
        for (let dx = -1; dx <= 3; dx++) if (b.in(x + dx, y0 + 3)) b.keep[b.k(x + dx, y0 + 3)] = true;
        for (const dx of [-1, 3]) for (const dy of [1, 2]) if (b.in(x + dx, y0 + dy)) b.keep[b.k(x + dx, y0 + dy)] = true;      // 입구를 연석 줄로 돌아 지나간다
        b.notes.push(`underpass entrance at (${x},${y0}) — stairs cell (${x + 1},${y0 + 2}), step-out cell (${x + 1},${y0 + 3})`); break;
      }
      for (let x = 0; x < W; x++) if (b.use[b.k(x, y0 + 1)] === "walk") b.keep[b.k(x, y0 + 1)] = true;      // 북쪽 지나는 줄(점자 블록 줄)
      // 남쪽 보도: 큰 가로수와 가로등을 번갈아(줄기 = 맨 아랫줄, 수관은 연석·차도 위)
      const big = BIG_STREET_TREES.filter((id) => pal.kit(id)); let alt = r() < 0.5;
      for (let x = 1 + Math.floor(r() * 3); x < W - 3; x += 5 + Math.floor(r() * 3)) {
        if (nearX(x, 1) || nearX(x + 2, 1)) continue;
        if (alt && big.length) { if (b.propOver(pick(r, big), x, sy - 3, ["walk"])) { const grate = pal.kit("mc-prop-kr-tree-grate")?.rows[0]?.tiles[0]; if (grate !== undefined && grate >= 0) b.lower[b.k(x + 1, sy)] = grate; } }
        else b.propOver("mc-prop-lamp-a", x, sy - 2, ["walk"]);
        alt = !alt;
      }
      // 북쪽 연석 줄: 작은 가로수·가로등·볼라드
      const small = slotKits(b, "yardTree"); alt = r() < 0.5;
      for (let x = 2 + Math.floor(r() * 3); x < W - 2; x += 5 + Math.floor(r() * 3)) {
        if (nearX(x, 1)) continue;
        if (alt && small.length) b.propOver(pick(r, small), x, y0 + 1, ["walk"]); else if (!b.propOver(pal.kit("mc-prop-kr-lamp-flags") && r() < 0.4 ? "mc-prop-kr-lamp-flags" : "mc-prop-lamp-a", x, y0 + 1, ["walk"])) putOn(b, "mc-prop-bollard-a", x, y0 + 3, ["walk"]);
        alt = !alt;
      }
      // 가드레일: 북쪽 연석 줄의 빈 칸에 3~5칸씩(횡단보도·세로 길 앞은 비운다)
      const rail = ["mc-prop-kr-guardrail", "mc-prop-fence-a", "mc-prop-fence-b"].find((id) => pal.kit(id));
      if (rail) for (let x = 2 + Math.floor(r() * 4); x < W - 6; x += 9 + Math.floor(r() * 6)) for (let k = 0; k < 3 + Math.floor(r() * 3); k++) if (!nearX(x + k, 1)) putOn(b, rail, x + k, y0 + 3, ["walk"]);
      // 대로 보도의 한국 기물(자전거 대여소·안내 기둥·쉼터·정류장 표지): 북쪽은 연석 안쪽 줄, 남쪽은 맨 아랫줄.
      lineProps(b, r, "blvdN", 0, W - 1, y0 + 2, [7, 12], ["walk"]);
      lineProps(b, r, "blvdS", 0, W - 1, sy, [9, 15], ["walk"]);
      // 신호등(세로 길 모서리)·횡단보도 보행 신호
      for (const v of crossing(band)) if (!v.lane) { putOn(b, "mc-anim-signal-ns", v.x + 4, sy, ["walk"]); putOn(b, "mc-anim-ped-signal-ew", v.x - 1, y0 + 3, ["walk"]); }
      for (const c of crossings) if (c.band === band) { putOn(b, "mc-anim-ped-signal-ew", c.x - 1, y0 + 3, ["walk"]); putOn(b, "mc-anim-ped-signal-ew", c.x + 2, sy, ["walk"]); }
      // 버스 정류장 장면 하나(남쪽 보도) — 동쪽행 차선에 버스 정차점
      const bus = D.scenes["bus-stop"];
      if (bus) for (let t = 0; t < 30; t++) {
        const x = 2 + Math.floor(r() * (W - 10)); if (nearX(x, 2) || nearX(x + 5, 2)) continue;
        if (putScene(b, bus, x, sy, ["walk"])) { busStops.push({ x: x + 1, y: transitLane("right", band.roadY!, rw, "right").lane, at: "center", name: "버스 정류장", waitSec: 4 }); break; }
      }
      for (let x = 5 + Math.floor(r() * 8); x < W - 2; x += 10 + Math.floor(r() * 8)) if (!nearX(x, 0)) g.manhole(x, band.roadY! + (r() < 0.5 ? 0 : rw - 1));
    } else if (s.t === "plaza") {
      for (let x = 0; x < W; x++) b.keep[b.k(x, y0 + 1)] = true;
      for (let y = y0 + 2; y <= y1; y++) spot("plaza", y);
      // 광장의 큰 것(무대·천막·전광판·조형물)을 먼저 하나둘 — 지나는 줄(둘째 줄) 아래에.
      const bigPlaza = [...new Set(slotKits(b, "plaza").filter((id) => b.kit(id).width >= 3 || b.kit(id).height >= 3))];
      for (let k = 0; k < 2 && bigPlaza.length; k++) for (let tr = 0; tr < 10; tr++) { const id = pick(r, bigPlaza); if (b.kit(id).height <= y1 - y0 + 1 && putOn(b, id, 2 + Math.floor(r() * (W - 6)), y1, ["walk"])) break; }
      const big = BIG_STREET_TREES.filter((id) => pal.kit(id));
      for (let x = 3 + Math.floor(r() * 4); x < W - 4 && big.length && y1 - y0 >= 4; x += 9 + Math.floor(r() * 5)) b.propOver(pick(r, big), x, y1 - 3, ["walk"]);
    } else if (s.t === "river") {
      for (let x = 0; x < W; x++) { b.keep[b.k(x, y0 + 1)] = true; b.keep[b.k(x, y1)] = true; }
      // 징검다리·보행교: 세로 길에서 먼 쪽에 2칸 폭 다리 하나
      const far = widest(band); const bx = far[0] + 3 + Math.floor(r() * Math.max(1, far[1] - far[0] - 7));
      for (const x of [bx, bx + 1]) for (let y = y0 + 2; y <= y1 - 1; y++) { g.deck(x, y); b.keep[b.k(x, y)] = true; }
      spot("river", y0 + 2);
      // 물가 난간(그림이 있을 때): 풀 둑 줄에 넷~여섯 칸씩 이어서, 다리 앞은 비운다.
      if (pal.kit("mc-prop-kr-river-rail")) for (let x = 1 + Math.floor(r() * 4); x < W - 6; x += 9 + Math.floor(r() * 5)) for (let k = 0; k < 4 + Math.floor(r() * 3); k++) if (x + k < bx - 1 || x + k > bx + 2) putOn(b, "mc-prop-kr-river-rail", x + k, y0 + 2, ["park"]);
      lineProps(b, r, "river", 0, W - 1, y0 + 2, [4, 7], ["park"]);
      lineProps(b, r, "plaza", 0, W - 1, y1 - 1, [6, 10], ["walk"]);
    }
    if (hasFront) {
      // 가게 앞: 세로 입간판(가게 종류) → 보도로 번진 물건
      const signFor: Record<string, string> = { cafe: "mc-prop-kr-sign-cafe", conv: "mc-prop-kr-sign-conv", bakery: "mc-prop-kr-sign-cafe", shop: "mc-prop-kr-sign-pharm", hospital: "mc-prop-kr-sign-pharm", low3: "mc-prop-kr-sign-food", mid4: "mc-prop-kr-sign-food" };
      for (const d of b.buildings) { const id = signFor[d.kind]; if (!id || d.access[0]!.y !== y0) continue; for (const sx of [d.rect.x + d.rect.w - 1, d.rect.x]) if (Math.abs(sx - d.access[0]!.x) >= 2 && putOn(b, id, sx, y0, ["walk"])) break; }
      lineProps(b, r, "front", 0, W - 1, y0, [2, 4], ["walk"]);
    }
  }
  // 기물 장면(같이 놓는 킷 묶음) — 종류의 장면마다 자리 종류에 맞는 줄에서 n 번.
  for (const name of kind.scenes) {
    const sc = D.scenes[name]; const where = sc ? spots[sc.on] : undefined; if (!sc || !where?.length || name === "bus-stop") continue;
    for (let n = 0; n < sc.n; n++) for (let t = 0; t < 16; t++) { const at = pick(r, where); if (putScene(b, sc, 1 + Math.floor(r() * (W - 8)), at.y, at.allow)) break; }
  }
  for (const at of spots.alleyS ?? []) lineProps(b, r, "alleyS", 0, W - 1, at.y, [3, 6], ["walk", "yard"]);
  for (const at of spots.plaza ?? []) lineProps(b, r, "plaza", 0, W - 1, at.y, [5, 9], ["walk"]);
  // 눈에 비는 자리 채우기: 건물도 기물도 없는 8×6 창(차도가 절반 넘는 창은 빼고)마다 그 바닥에 맞는 것 하나 — 마당·골목은 나무나 잡동사니, 보도·광장은 나무·벤치·화분.
  const lids = new Set(pal.group("mc:marking-manhole"));      // 맨홀 뚜껑은 바닥 표시다 — 그 칸이 있다고 찬 자리로 치지 않는다
  const taken = (i: number) => (b.upper[i]! >= 0 && !lids.has(b.upper[i]!)) || b.use[i] === "bld" || b.use[i] === "prop" || b.use[i] === "veh";
  for (let pass = 0; pass < 2; pass++) for (let y0 = 0; y0 + 6 <= H; y0++) for (let x0 = 0; x0 + 8 <= W; x0++) {
    let any = false, lanes = 0;
    for (let y = y0; y < y0 + 6 && !any; y++) for (let x = x0; x < x0 + 8; x++) { const i = b.k(x, y); if (taken(i)) { any = true; break; } if (b.use[i] === "road") lanes++; }
    if (any || lanes > 24) continue;
    const spotsIn = shuffle(r, Array.from({ length: 48 }, (_, k) => ({ x: x0 + (k % 8), y: y0 + Math.floor(k / 8) })).filter((c) => { const u = b.use[b.k(c.x, c.y)]; return (u === "walk" || u === "yard" || u === "park") && !b.keep[b.k(c.x, c.y)]; }));
    for (const c of spotsIn.slice(0, 16)) {
      const u = b.use[b.k(c.x, c.y)];
      const ids = (u === "yard" ? [...slotKits(b, "yardTree"), ...slotKits(b, "yard")] : [...slotKits(b, "yardTree"), ...slotKits(b, "plaza")]).filter((id) => b.kit(id).width <= 2);
      if (ids.length && [0, 1, 2].some(() => putOn(b, pick(r, ids), c.x, c.y, ["walk", "yard", "park"]))) break;
    }
  }
  // 머리 위 줄(현수막·등·전구·깃발·파라솔): 골목마다 하나둘, 이면도로에 하나 — 밑으로 지나간다.
  const hang = slotKits(b, "hang");
  if (hang.length) for (const band of bands) {
    const t = band.s.t; if (t !== "alley" && t !== "side" && t !== "sidep") continue;
    const n = t === "alley" ? (band.s.stalls ? 4 : 1 + Math.floor(r() * 2)) : 1, y = t === "alley" ? band.y0 + Math.floor(r() * 2) : band.roadY!;
    for (let k = 0; k < n; k++) for (let tr = 0; tr < 8; tr++) {
      const id = pick(r, hang), kw = b.kit(id).width, kh = b.kit(id).height, had = b.krCount.get(id) ?? 0;
      if (had < 3 && b.propOver(id, 1 + Math.floor(r() * (W - kw - 1)), Math.min(y, band.y1 - kh + 1), ["walk", "road", "yard"])) { b.krCount.set(id, had + 1); break; }
    }
  }
  // 바닥 표시: 과속방지턱·노면 글씨(이면도로), 버스 정차 칸, 횡단보도 앞 바닥 신호, 소방차 전용, 빗물받이·맨홀·얼룩·금·낙엽. 그림이 없으면 아무것도 놓지 않는다.
  const D2 = (id: string) => `mc-prop-kr-${id}`;
  for (const band of bands) {
    const t = band.s.t;
    if (t === "side" || t === "sidep") {
      const clear = (x: number) => !crossing(band).some((v) => x >= v.x - 2 && x < v.x + v.w + 2) && !crossings.some((c) => c.band === band && x >= c.x - 2 && x <= c.x + 3);
      for (let x = 6 + Math.floor(r() * 10); x < W - 6; x += 18 + Math.floor(r() * 10)) if (clear(x) && putDecal(b, D2("speed-bump"), x, band.roadY!, ["road"]) && clear(x + 4)) putDecal(b, D2("road-slow"), x + 3, band.roadY!, ["road"]);
      if (kind.schoolZone) for (let tr = 0; tr < 12; tr++) { const x = 3 + Math.floor(r() * (W - 8)); if (clear(x) && clear(x + 1) && putDecal(b, D2("road-school"), x, band.roadY!, ["road"])) break; }
      for (let x = 3 + Math.floor(r() * 8); x < W - 2; x += 11 + Math.floor(r() * 8)) putDecal(b, D2("drain-grate"), x, band.y0 + 1, ["walk"]);
    } else if (t === "blvd") {
      for (const c of crossings) if (c.band === band) { putDecal(b, D2("floor-signal"), c.x, band.y0 + 3, ["walk"]); putDecal(b, D2("floor-signal"), c.x, band.roadY! + band.roadW!, ["walk"]); }
      for (const s of busStops) putDecal(b, D2("bus-bay"), s.x - 1, s.y, ["road"]);
      for (let x = 4 + Math.floor(r() * 8); x < W - 2; x += 12 + Math.floor(r() * 8)) putDecal(b, D2("drain-grate"), x, band.y0 + 3, ["walk"]);
    } else if (t === "alley") {
      if (kind.fireLane && band === bands.find((x) => x.s.t === "alley")) putDecal(b, D2("fire-lane"), 4 + Math.floor(r() * Math.max(1, W - 12)), band.y0 + 1, ["walk"]);
      for (let x = 5 + Math.floor(r() * 10); x < W - 2; x += 14 + Math.floor(r() * 10)) putDecal(b, D2("manhole-kr"), x, band.y0 + 1, ["walk"]);
    }
  }
  const marks = ["stain-oil", "stain-water", "crack-patch", "leaf-litter"].map(D2).filter((id) => pal.kit(id));
  if (marks.length) for (let k = 0, n = Math.floor(W * H / 260); k < n; k++) putDecal(b, pick(r, marks), Math.floor(r() * W), Math.floor(r() * H), ["walk", "yard"]);
  // 시작 칸: 맨 아래 길의 지나는 줄 가운데에서 가장 가까운 빈 칸
  const lastStreet = [...bands].reverse().find((x) => x.s.t !== "B")!;
  const sy = lastStreet.s.t === "blvd" ? lastStreet.y1 - 1 : Math.min(H - 1, lastStreet.y0 + 1);
  let start = { x: Math.floor(W / 2), y: sy };
  for (let d = 0; d < W; d++) { const c = [{ x: start.x + d, y: sy }, { x: start.x - d, y: sy }].find((p) => b.in(p.x, p.y) && b.use[b.k(p.x, p.y)] === "walk" && b.upper[b.k(p.x, p.y)] < 0); if (c) { start = c; break; } }
  if (!reaches(b, start, [...b.buildings.flatMap((d) => d.access), ...subwayExits.map((e) => e.step)])) throw new Error("문 접근칸에 닿지 못하는 배치");
  const named = new Map<string, number>();
  const buildings = b.buildings.map((d) => { const k = (named.get(d.name) ?? 0) + 1; named.set(d.name, k); return k > 1 ? { ...d, name: `${d.name} ${k}` } : d; });
  // 달리는 차: 대로는 두 방향 + 버스, 이면도로는 일방(승용·택시·승합·스쿠터만)
  const seed = spec.seed ?? 0, grid = { width: W, height: H };
  const mix = DEFAULT_MODERN_CAR_MIX.map((_, i) => DEFAULT_MODERN_CAR_MIX[(i + Math.abs(seed)) % DEFAULT_MODERN_CAR_MIX.length]!);
  const civil = mix.filter((v) => /car2|sedan|taxi|van|scooter/.test(v));
  const main: RoadBand[] = bands.filter((x) => x.s.t === "blvd").map((x) => ({ axis: "ew", edge: x.roadY!, width: x.roadW!, from: 0, to: W - 1, edgeToEdge: true }));
  const minor: RoadBand[] = [...bands.filter((x) => x.s.t === "side" || x.s.t === "sidep").map((x): RoadBand => ({ axis: "ew", edge: x.roadY!, width: 2, from: 0, to: W - 1, edgeToEdge: true })), ...vroads.filter((v) => v.through && !v.lane).map((v): RoadBand => ({ axis: "ns", edge: v.x + 1, width: 2, from: 0, to: H - 1, edgeToEdge: true }))];
  const routes = [
    ...autoTrafficRoutes(main, grid, { vehicles: mix, busVehicle: "mc-veh-bus-a", drive: "right", headwaySec: 14, busHeadwaySec: 40, busStops }).routes,
    ...autoTrafficRoutes(minor, grid, { vehicles: civil.length ? civil : mix, drive: "right", headwaySec: 22 }).routes,
  ];
  if (uses.length) b.notes.push(`lots: ${uses.join(" · ")}`);
  return {
    lower: b.lower, upper: b.upper, upper2: b.upper2, buildings, start, props: b.props,
    roads: { horizontal: bands.filter((x) => x.roadY !== undefined).map((x) => x.roadY!), vertical: vroads.filter((v) => !v.lane).map((v) => v.x + 1) },
    park: null, notes: b.notes, transit: { routes }, subwayExits, district: { id: kind.id, ko: kind.ko, en: kind.en },
  };
}

/** 한국 지구 한 장. 종류는 district.kind(이름 또는 "auto") — 요청 사실(크기·가게 수)과 게임 열쇠·씨앗으로 고른다. 닿지 않는 배치가 나오면 씨앗을 조금 바꿔 다시 짠다. */
export function composeKoreanDistrict(spec: MCStreetSpec, pal: MCPalette): MCStreetResult {
  const d = spec.district ?? {}, seed = spec.seed ?? 0;
  const hint = d.kind && d.kind !== "auto" ? d.kind : undefined;
  const kind = pickDistrictKind(d.key, seed, { width: spec.width, height: spec.height, shops: spec.shops?.length ?? 0 }, hint, d.used);
  let last: unknown;
  for (let k = 0; k < 8; k++) {
    try { return build(spec, pal, kind, mulberry(seed * 7919 + spec.width * 31 + spec.height + k * 104729)); } catch (e) { last = e; }
  }
  throw last instanceof Error ? last : new Error("한국 지구를 짜지 못했다");
}
