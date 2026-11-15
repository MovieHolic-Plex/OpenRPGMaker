// project/jpCityScenePieces.ts
// 거리 장면의 구획 조각 — 건물 줄 대신 구획(또는 그 한쪽)을 차지하는 쓰임: 동네 공원 · 신사 경내 · 골목 사당 · 코인 주차장 · 공사장 · 자전거 주차장 · 빈터 · 역 앞 광장.
// 조각마다 바닥·둘레(담·생울타리·철망)·들어가는 틈·정해진 짜임을 놓는다. 소품 목록은 자료(jpCityStreetKinds.json 의 scenes)에서 읽는다.
import { Occ, type PutOpts, type SceneBlock, type SceneCtx, type SceneLayout } from "@/project/jpCitySceneCtx";
import { SCENE_BUILDINGS, sceneList, yardGround } from "@/project/jpCitySceneKinds";

export interface PieceDef {
  readonly minW: number; readonly minH: number; readonly prefW: number;
  /** 맨 아래 띠를 먼저 고른다 */ readonly bottom?: boolean;
  readonly band?: (index: number, bands: number) => boolean;
  readonly run: (c: SceneCtx, L: SceneLayout, b: SceneBlock) => boolean;
}

const TREES = ["jp-prop-tree-zelkova", "jp-prop-tree-ginkgo", "jp-prop-tree-sakura"];

function scatter(c: SceneCtx, x: number, y: number, w: number, h: number, pool: readonly string[], n: number, o: PutOpts = { gap: true }): number {
  let done = 0;
  for (let t = 0; t < n * 12 && done < n; t++) if (c.putAny(pool, x + Math.floor(c.rng() * w), y + Math.floor(c.rng() * h), o)) done++;
  return done;
}
/** 둘레 고리(틈 칸은 비운다). */
function ring(c: SceneCtx, x: number, y: number, w: number, h: number, material: string, open: (px: number, py: number) => boolean, sides = "NESW"): void {
  const cells = [
    ...(sides.includes("N") ? c.hline(x, y, w) : []), ...(sides.includes("S") ? c.hline(x, y + h - 1, w) : []),
    ...(sides.includes("W") ? c.vline(x, y + 1, h - 2) : []), ...(sides.includes("E") ? c.vline(x + w - 1, y + 1, h - 2) : []),
  ];
  c.edge(cells.filter((q) => !open(q.x, q.y)), material);
}
/** 들어가는 틈 앞(길 쪽 두 줄)은 걷는 자리로 비워 둔다 — 가로 시설이 입구를 막지 않게. */
const keepFront = (c: SceneCtx, x: number, w: number, foot: number) => c.mark(x, foot + 1, w, 2, Occ.Walk, [Occ.Lot]);
const rect = (b: SceneBlock) => ({ x: b.sx, w: b.ex - b.sx, top: b.band.top, foot: b.band.foot, h: b.band.foot - b.band.top + 1 });

function park(c: SceneCtx, _L: SceneLayout, b: SceneBlock): boolean {
  const { x, w, top, foot, h } = rect(b), { tone, kind } = c;
  c.fill(x, top, w, h, kind.noGreen ? yardGround(kind, tone, 0) : tone.green);
  const gx = x + Math.floor(w / 2) - 1;
  c.fill(gx, foot - 2, 2, 3, tone.plaza);
  c.mark(gx, foot - 2, 2, 3, Occ.Walk); keepFront(c, gx, 2, foot);
  ring(c, x, top, w, h, kind.noGreen ? "철망 울타리" : "생울타리", (px, py) => py === foot && (px === gx || px === gx + 1));
  if (h >= 9) for (let tx = x + 1 + Math.floor(c.rng() * 2); tx + 4 < x + w; tx += 5 + Math.floor(c.rng() * 4)) if (tx + 4 <= gx - 1 || tx >= gx + 3 || top + 6 < foot - 2) c.putFoot(TREES[Math.floor(c.rng() * 3)]!, tx, top + 6, { gap: true });
  scatter(c, x + 1, foot - 3, w - 2, 3, sceneList("koen", "play"), Math.max(2, Math.floor(w / 4)));
  scatter(c, x + 1, foot - 2, w - 2, 2, sceneList("koen", "rest"), Math.max(2, Math.floor(w / 5)));
  c.scenesUsed.add("koen");
  return true;
}

function shrine(c: SceneCtx, _L: SceneLayout, b: SceneBlock): boolean {
  const { x, w, top, foot, h } = rect(b), { tone } = c;
  const hall = c.fable ? c.buildingPool.find((k) => k.cat === "sacred" && k.w >= 5) : SCENE_BUILDINGS.find((k) => k.id === "jp-bldg-shrine-haiden");
  if (!hall || h < hall.h + 4 || w < hall.w + 4) return false;
  const px = x + Math.floor(w / 2) - 1, hx = px - (hall.doors[0] ?? 4), hfoot = top + hall.h;
  if (hx < x + 1 || hx + hall.w > x + w - 1) return false;
  c.fill(x, top, w, h, "자갈 참배길");
  c.fill(px, hfoot + 1, 2, foot - hfoot, tone.plaza);
  c.placeKit(hall, hx, hfoot);
  c.mark(px, hfoot + 1, 2, foot - hfoot, Occ.Walk); keepFront(c, px - 1, 4, foot);
  ring(c, x, top, w, h, "블록담", (qx, qy) => qy === foot && qx >= px - 1 && qx <= px + 2);
  c.putFoot("jp-torii", px - 1, foot - 1, { base: [Occ.Lot, Occ.Walk], over: [Occ.Lot, Occ.Walk] });
  for (let y = foot - 3; y > hfoot + 1; y -= 3) for (const lx of [px - 1, px + 2]) c.putAny(sceneList("jinja", "lantern"), lx, y);
  const side = sceneList("jinja", "side");
  scatter(c, x + 1, hfoot + 2, Math.max(1, px - x - 3), Math.max(1, foot - hfoot - 2), side, 2);
  scatter(c, px + 4, hfoot + 2, Math.max(1, x + w - px - 6), Math.max(1, foot - hfoot - 2), side, 2);
  for (const tx of [x + 1, x + w - 5]) if (tx + 4 <= hx || tx >= hx + hall.w) c.putFoot(TREES[Math.floor(c.rng() * 2)]!, tx, top + 6, { gap: true });
  for (const fx of [px - 2, px + 3]) c.putAny(sceneList("jinja", "flag"), fx, foot - 1);
  c.scenesUsed.add("jinja");
  return true;
}

/** 골목 사당: 도리이 하나 뒤에 작은 감실 · 돌등롱 · 나무. */
function shrineSmall(c: SceneCtx, _L: SceneLayout, b: SceneBlock): boolean {
  const { x, w, top, foot, h } = rect(b);
  c.fill(x, top, w, h, "자갈 참배길");
  const tx = x + Math.floor((w - 4) / 2);
  ring(c, x, top, w, h, "블록담", (qx, qy) => qy === foot && qx >= tx && qx <= tx + 3);
  c.mark(tx + 1, foot - 2, 2, 3, Occ.Walk); keepFront(c, tx, 4, foot);
  c.putFoot("jp-torii", tx, foot - 1, { base: [Occ.Lot, Occ.Walk], over: [Occ.Lot, Occ.Walk] });
  c.putAny(["jp-hokora-jizo", "jp-jizo"], tx + 1, foot - 3);
  for (const lx of [tx - 1, tx + 4]) c.putAny(sceneList("jinja", "lantern"), lx, foot - 2);
  if (h >= 9) c.putFoot(TREES[Math.floor(c.rng() * 3)]!, x + 1 + Math.floor(c.rng() * Math.max(1, w - 6)), top + 6);
  scatter(c, x + 1, foot - 3, w - 2, 2, [...sceneList("jinja", "flag"), "jp-spring-basin", "jp-keijiban", "jp-prop-bench"], 2);
  c.scenesUsed.add("jinja");
  return true;
}

function parking(c: SceneCtx, _L: SceneLayout, b: SceneBlock): boolean {
  const { x, w, top, foot, h } = rect(b);
  const rows = Math.min(2, Math.floor((h - 1) / 3)), cols = Math.floor((w - 2) / 6);
  if (rows < 1 || cols < 1) return false;
  const y0 = foot - rows * 3 + 1;
  c.fill(x, Math.max(top + 1, y0 - 1), w, foot - Math.max(top + 1, y0 - 1) + 1, "거리 · 주차장");
  ring(c, x, Math.max(top, y0 - 2), w, foot - Math.max(top, y0 - 2) + 1, "철망 울타리", () => false, "NEW");
  keepFront(c, x + 1, Math.min(w - 2, 5), foot);
  const cars = sceneList("doro", "cars").filter((id) => id.includes("-car-"));
  let any = false;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const bx = x + 1 + k * 6, by = foot - 3 * (r + 1) + 1;
    if (!c.put("jp-lot-bay", bx, by, { floor: true, baseRows: 3 })) continue;
    if (c.rng() < 0.3 || !any) { const car = c.least(cars); if (car && c.put(car, bx, by, { baseRows: 3, stack: true })) any = true; }
  }
  const sx = x + 1 + cols * 6;
  for (const id of sceneList("chuusha", "sign")) if (c.putFoot(id, Math.min(x + w - 2, sx), foot, { gap: true })) break;
  scatter(c, x + 1, y0 - 1, w - 2, 1, sceneList("chuusha", "extra"), 2);
  c.scenesUsed.add("chuusha");
  return true;
}

function construction(c: SceneCtx, _L: SceneLayout, b: SceneBlock): boolean {
  const { x, w, top, foot, h } = rect(b);
  const y0 = Math.max(top, foot - 7), hh = foot - y0 + 1;
  c.fill(x, y0, w, hh, "산길 흙");
  const gx = x + 2 + Math.floor(c.rng() * Math.max(1, w - 6));
  c.mark(gx, foot - 1, 2, 2, Occ.Walk); keepFront(c, gx, 2, foot);
  ring(c, x, y0, w, hh, "철망 울타리", (qx, qy) => qy === foot && (qx === gx || qx === gx + 1));
  const cabin = sceneList("kouji", "cabin")[0];
  if (cabin) c.put(cabin, gx > x + w / 2 ? x + 1 : x + w - 4, y0 + 1, { baseRows: 2 });
  scatter(c, x + 1, y0 + 3, w - 2, Math.max(1, hh - 4), sceneList("kouji", "stuff"), Math.max(3, Math.floor(w / 3)));
  for (const cx of [gx - 1, gx + 2]) c.put("jp-prop-cone", cx, foot + 1);
  void h;
  c.scenesUsed.add("kouji");
  return true;
}

function bikepark(c: SceneCtx, _L: SceneLayout, b: SceneBlock): boolean {
  const { x, w, top, foot, h } = rect(b), { tone } = c;
  const y0 = Math.max(top, foot - 6);
  c.fill(x, y0, w, foot - y0 + 1, tone.sidewalk);
  ring(c, x, y0, w, foot - y0 + 1, "철망 울타리", () => false, "NEW");
  keepFront(c, x + 1, 3, foot);
  const shelter = sceneList("churin", "shelter")[0];
  let n = 0;
  if (shelter) for (let sx = x + 1; sx + 6 <= x + w - 1; sx += 7) if (c.put(shelter, sx, y0 + 1, { baseRows: 1 })) n++;
  const bikes = sceneList("churin", "bikes");
  for (let bx = x + 1; bx < x + w - 2; ) { const id = c.putAny(bikes, bx, foot - 1, { gap: false }); bx += (id ? c.size(id)![0] : 1) + 1; }
  for (let bx = x + 1; bx < x + w - 1; bx += 2) c.decal("jp-road-mark-bike-stop", bx, foot, "prop");
  c.putAny(sceneList("churin", "sign"), x + w - 2, foot);
  void h;
  c.scenesUsed.add("churin");
  return n > 0 || w >= 6;
}

function vacant(c: SceneCtx, _L: SceneLayout, b: SceneBlock): boolean {
  const { x, w, top, foot } = rect(b), { tone, kind } = c;
  const y0 = Math.max(top, foot - 5);
  c.fill(x, y0, w, foot - y0 + 1, kind.noGreen ? "산길 흙" : tone.green);
  if (w >= 6) c.fill(x + 1 + Math.floor(c.rng() * 2), y0 + 2, w - 3, 2, "산길 흙");
  ring(c, x, y0, w, foot - y0 + 1, "철망 울타리", () => false);
  scatter(c, x + 1, y0 + 2, w - 2, Math.max(1, foot - y0 - 2), sceneList("akichi", "weeds"), Math.max(3, Math.floor(w / 2)), { gap: false });
  c.putAny(sceneList("akichi", "sign"), x + 1 + Math.floor(c.rng() * Math.max(1, w - 3)), foot - 1);
  c.scenesUsed.add("akichi");
  return true;
}

/** 역 앞 광장: 뒤에 작은 역사, 앞은 판석 광장(동상·시계·분수·지하철 출구·매점)과 자전거 보관소·정류장. */
function station(c: SceneCtx, _L: SceneLayout, b: SceneBlock): boolean {
  const { x, w, top, foot, h } = rect(b), { tone } = c;
  const kit = c.fable ? c.buildingPool.find((k) => k.role === "station" || k.cat === "station") : SCENE_BUILDINGS.find((k) => k.id === "jp-bldg-station-small");
  if (!kit || w < kit.w + 2 || h < kit.h + 3) return false;
  c.fill(x, top, w, h, tone.plaza);
  const kx = x + Math.floor((w - kit.w) / 2), kfoot = Math.min(foot - 3, top + kit.h + Math.max(0, h - kit.h - 6));
  const p = c.placeKit(kit, kx, kfoot);
  for (const d of p.doors) { c.mark(kx + d, kfoot + 1, 1, foot - kfoot, Occ.Walk, [Occ.Lot]); keepFront(c, kx + d, 1, foot); }
  const plaza = sceneList("ekimae", "plaza");
  scatter(c, x + 1, kfoot + 2, w - 2, Math.max(1, foot - kfoot - 1), plaza, Math.max(4, Math.floor(w / 3)));
  for (const id of sceneList("ekimae", "transit")) for (const sx of c.rng() < 0.5 ? [x + 1, x + w - 7] : [x + w - 7, x + 1]) if (c.putFoot(id, sx, kfoot, { gap: true })) break;
  c.scenesUsed.add("ekimae");
  return true;
}

export const PIECES: Readonly<Record<string, PieceDef>> = {
  park: { minW: 8, minH: 7, prefW: 9, bottom: true, run: park },
  shrine: { minW: 13, minH: 11, prefW: 13, run: shrine },
  "shrine-small": { minW: 6, minH: 6, prefW: 7, run: shrineSmall },
  parking: { minW: 8, minH: 6, prefW: 8, bottom: true, run: parking },
  construction: { minW: 9, minH: 6, prefW: 9, run: construction },
  bikepark: { minW: 8, minH: 5, prefW: 8, bottom: true, run: bikepark },
  vacant: { minW: 6, minH: 5, prefW: 6, bottom: true, run: vacant },
  station: { minW: 17, minH: 9, prefW: 17, band: (i, n) => i < n - 1, run: station },
};
