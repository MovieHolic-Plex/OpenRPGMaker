// project/jpCityScenePieces.ts
// 거리 장면의 구획 조각 — 건물 줄 대신 구획(또는 그 한쪽)을 차지하는 쓰임: 동네 공원 · 신사 경내 · 골목 사당 · 코인 주차장 · 공사장 · 자전거 주차장 · 빈터 · 역 앞 광장.
// 조각마다 바닥·둘레(담·생울타리·철망)·들어가는 틈·정해진 짜임을 놓는다. 소품 목록은 자료(jpCityStreetKinds.json 의 scenes)에서 읽는다.
import { Occ, type PutOpts, type SceneBlock, type SceneCtx, type SceneLayout } from "@/project/jpCitySceneCtx";
import { SCENE_BUILDINGS, SCENE_SIZES, sceneList, yardGround } from "@/project/jpCitySceneKinds";
import { streetTagged } from "@/project/jpCityStreetPieces";

export interface PieceDef {
  readonly minW: number; readonly minH: number; readonly prefW: number;
  /** 맨 아래 띠를 먼저 고른다 */ readonly bottom?: boolean;
  readonly band?: (index: number, bands: number) => boolean;
  /** 구획 높이 h 가운데 이 조각이 실제로 쓰는 줄 수(앞쪽) — 없으면 통째로 쓴다. 남는 뒤쪽은 뒷길이 받는다(새 거리) */ readonly depth?: (h: number) => number;
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
  for (const q of cells) if (open(q.x, q.y)) c.openings.add(`${q.x},${q.y}`);   // 새 거리: 트인 자리는 줄 짓기가 메우지 않는다(양옆은 끝 조각)
  c.edge(cells.filter((q) => !open(q.x, q.y)), material);
}
/** 들어가는 틈 앞(길 쪽 두 줄)은 걷는 자리로 비워 둔다 — 가로 시설이 입구를 막지 않게. */
const keepFront = (c: SceneCtx, x: number, w: number, foot: number) => c.mark(x, foot + 1, w, 2, Occ.Walk, [Occ.Lot]);
const rect = (b: SceneBlock) => ({ x: b.sx, w: b.ex - b.sx, top: b.band.top, foot: b.band.foot, h: b.band.foot - b.band.top + 1 });

const SANMON = "jp-bldg-f-sanmon", TORII = "jp-bldg-f-torii";

function park(c: SceneCtx, _L: SceneLayout, b: SceneBlock): boolean {
  const { x, w, top, foot, h } = rect(b), { tone, kind } = c;
  if (c.fable && kind.noGreen) c.fillFamily(x, top, w, h, "forecourt");       // 새 거리: 초록을 안 쓰는 종류의 놀이터는 포장 마당(맨흙은 빈터 하나뿐)
  else c.fill(x, top, w, h, kind.noGreen ? yardGround(kind, tone, 0) : tone.green);
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
  if (c.fable && c.placed.some((p) => p.kit?.id === hall.id)) return false;      // 새 거리: 같은 본전은 지도에 한 번
  const px = x + Math.floor(w / 2) - 1, hx = px - (hall.doors[0] ?? 4), hfoot = top + hall.h;
  if (hx < x + 1 || hx + hall.w > x + w - 1) return false;
  c.fill(x, top, w, h, "자갈 참배길");
  if (c.fable) c.fillFamily(px, hfoot + 1, 2, foot - hfoot, "alley"); else c.fill(px, hfoot + 1, 2, foot - hfoot, tone.plaza);   // 새 거리: 참배길은 돌 포장
  c.placeKit(hall, hx, hfoot);
  c.mark(px, hfoot + 1, 2, foot - hfoot, Occ.Walk); keepFront(c, px - 1, 4, foot);
  // 새 거리: 경내 입구에 산몬(지나가는 문 — 가운데 두 열이 참배길)이 담 선에 선다. 자리가 얕으면 도리이.
  const sm = c.fable ? SCENE_SIZES[SANMON] : undefined;
  const gate = !!sm && c.kind.id === "tera-machi" && foot - sm[1] > hfoot + 1 && px - 2 > x && px + 4 < x + w && c.stampPassage(SANMON, px - 2, foot, [2, 3]);
  // 산몬이 서지 않는 경내(신사): 참배길이 깊으면(도리이 뒤로 두 줄 넘게) 길 선에 도리이(지나가는 문 — 가운데 두 열). 얕으면 문 없이 담만 트인다.
  const tr = c.fable ? SCENE_SIZES[TORII] : undefined;
  const torii = !gate && !!tr && foot - tr[1] > hfoot + 1 && c.stampPassage(TORII, px - 1, foot, [1, 2]);
  const gateH = gate ? sm![1] : torii ? tr![1] : 0;
  ring(c, x, top, w, h, "블록담", (qx, qy) => qy === foot && (gate ? qx >= px - 2 && qx <= px + 3 : qx >= px - 1 && qx <= px + 2));
  if (!c.fable) c.putFoot("jp-torii", px - 1, foot - 1, { base: [Occ.Lot, Occ.Walk], over: [Occ.Lot, Occ.Walk] });
  // 석등은 참배길 양옆에 짝으로(새 거리: 문 안쪽부터 본전 앞까지 세 줄 걸러 한 쌍)
  if (c.fable) { for (let y = foot - gateH - 2; y > hfoot + 1; y -= 3) if (c.stFits("lantern-stone", px - 1, y, { pair: true }) && c.stFits("lantern-stone", px + 2, y, { pair: true })) { c.stStamp("lantern-stone", px - 1, y, { pair: true }); c.stStamp("lantern-stone", px + 2, y, { pair: true }); } }
  else for (let y = foot - 3; y > hfoot + 1; y -= 3) for (const lx of [px - 1, px + 2]) c.putAny(sceneList("jinja", "lantern"), lx, y);
  const side = sceneList("jinja", "side");
  scatter(c, x + 1, hfoot + 2, Math.max(1, px - x - 3), Math.max(1, foot - hfoot - 2), side, 2);
  scatter(c, px + 4, hfoot + 2, Math.max(1, x + w - px - 6), Math.max(1, foot - hfoot - 2), side, 2);
  for (const tx of [x + 1, x + w - 5]) if (tx + 4 <= hx || tx >= hx + hall.w) c.putFoot(TREES[Math.floor(c.rng() * 2)]!, tx, top + 6, { gap: true });
  if (c.fable) for (const tx of [x + 1, x + w - 4]) for (let ty = top + 11; ty < foot - 2; ty += 5) c.putFoot(TREES[Math.floor(c.rng() * 2)]!, tx, ty, { gap: true });   // 깊은 경내: 양옆에 나무가 줄지어 선다
  for (const fx of [px - 2, px + 3]) c.putAny(sceneList("jinja", "flag"), fx, foot - 1);
  c.scenesUsed.add("jinja");
  return true;
}

/** 골목 사당: 도리이 하나 뒤에 작은 감실 · 돌등롱 · 나무. */
function shrineSmall(c: SceneCtx, _L: SceneLayout, b: SceneBlock): boolean {
  const { x, w, top, foot, h } = rect(b);
  if (c.fable) {
    // 새 거리: 길 선에 도리이(지나가는 문), 돌 참배길 끝 뒤 담에 지장 사당, 참배길 양옆에 석등 한 쌍 — 도리이가 못 서는 자리에는 만들지 않는다.
    const tr = SCENE_SIZES[TORII], fx = x + Math.floor((w - 4) / 2);
    if (!tr || h < tr[1] + 3 || w < 6 || c.scenesUsed.has("jinja") || !c.stampPassage(TORII, fx, foot, [1, 2])) return false;   // 사당·신사는 지도에 하나
    c.fill(x, top, w, h, "자갈 참배길");
    ring(c, x, top, w, h, "블록담", (qx, qy) => qy === foot && qx >= fx && qx <= fx + 3);
    c.fillFamily(fx + 1, top + 2, 2, foot - top - 1, "alley");
    c.mark(fx + 1, top + 2, 2, foot - top - 1, Occ.Walk); keepFront(c, fx, 4, foot);
    c.stPut(["jizo"], fx + 1, top + 1, { lax: true });
    const ly = Math.min(foot - tr[1] - 1, top + 3);
    if (ly > top + 1 && c.stFits("lantern-stone", fx, ly, { pair: true }) && c.stFits("lantern-stone", fx + 3, ly, { pair: true })) { c.stStamp("lantern-stone", fx, ly, { pair: true }); c.stStamp("lantern-stone", fx + 3, ly, { pair: true }); }
    if (h >= 9 && w >= 10) c.putFoot(TREES[Math.floor(c.rng() * 3)]!, x + 1, top + 6);
    c.scenesUsed.add("jinja");
    return true;
  }
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

/** 단지·맨션: 필지 맨 뒤에 대형 건물, 앞마당은 포장(자전거 · 작은 놀이터 · 벤치)과 양옆 잔디 심은 띠, 둘레는 산울타리(문 앞이 트인다). 깊은 필지에만. */
function estate(c: SceneCtx, _L: SceneLayout, b: SceneBlock): boolean {
  const { x, w, top, foot, h } = rect(b), { tone, kind } = c;
  const kit = c.nextKit([], { x: x + 2, foot: top + 16 }, w - 4, h - 4, { role: c.rng() < 0.5 ? "danchi" : "mansion" }) ?? c.nextKit([], { x: x + 2, foot: top + 16 }, w - 4, h - 4, { role: "danchi" }) ?? c.nextKit([], { x: x + 2, foot: top + 16 }, w - 4, h - 4, { role: "mansion" });
  if (!kit) return false;
  const kx = x + Math.floor((w - kit.w) / 2), kfoot = top + kit.h, d0 = kit.doors[0] ?? 1, d1 = kit.doors[kit.doors.length - 1] ?? d0;
  c.fill(x, top, w, h, kind.noGreen ? tone.sidewalk : tone.green);
  c.fillFamily(x + 3, kfoot + 1, w - 6, foot - kfoot, "forecourt");
  c.fillFamily(kx, top + 1, kit.w, kit.h, "forecourt");
  c.placeKit(kit, kx, kfoot);
  const px = kx + d0, pw = d1 - d0 + 1;
  c.mark(px, kfoot + 1, pw, foot - kfoot, Occ.Walk); keepFront(c, px, pw, foot);
  ring(c, x, top, w, h, kind.noGreen ? "철망 울타리" : "생울타리", (qx, qy) => qy === foot && qx >= px && qx < px + pw);
  // 건물 앞: 자전거와 화분이 벽에 붙어 서고, 앞마당 한쪽은 작은 놀이터 · 다른 쪽은 벤치
  const front = [...streetTagged("bike"), ...streetTagged("housefront")];
  for (let xx = kx; xx < kx + kit.w; ) { const n = xx >= px - 1 && xx <= px + pw ? undefined : c.stPut(front, xx, kfoot + 1); xx += (n ? 2 : 1) + (n ? Math.floor(c.rng() * 2) : 0); }
  const play = streetTagged("park");
  if (foot - kfoot >= 4) {
    for (let xx = x + 4; xx + 2 < px - 1; xx += 3) c.stPut(play, xx, foot - 2);
    for (let xx = px + pw + 2; xx + 2 < x + w - 3; xx += 4) c.stPut(play, xx, foot - 2);
  }
  for (const tx of [x + 1, x + w - 3]) for (let ty = top + 5; ty < foot - 1; ty += 5) c.stPut(streetTagged("gardentree"), tx, ty);
  return true;
}

function vacant(c: SceneCtx, _L: SceneLayout, b: SceneBlock): boolean {
  if (c.fable && c.scenesUsed.has("akichi")) return false;                  // 새 거리: 맨땅 빈터는 지도에 하나까지
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
  parking: { minW: 8, minH: 6, prefW: 8, bottom: true, depth: (h) => Math.min(h, Math.min(2, Math.floor((h - 1) / 3)) * 3 + 2), run: parking },
  construction: { minW: 9, minH: 6, prefW: 9, run: construction },
  bikepark: { minW: 8, minH: 5, prefW: 8, bottom: true, depth: (h) => Math.min(h, 7), run: bikepark },
  vacant: { minW: 6, minH: 5, prefW: 6, bottom: true, depth: (h) => Math.min(h, 6), run: vacant },
  estate: { minW: 13, minH: 18, prefW: 16, run: estate },
  station: { minW: 17, minH: 9, prefW: 17, band: (i, n) => i < n - 1, run: station },
};
