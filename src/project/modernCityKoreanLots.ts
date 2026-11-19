// project/modernCityKoreanLots.ts
// 한국 지구의 «건물이 아닌 자리» — 빈 필지의 쓰임(주차장·쌈지 공원·놀이터·시장 통로·공사장·분리수거장), 건물 뒤 마당, 기물 장면(같이 놓는 3~8킷), 자리별 기물 줄.
// 잔디밭으로 남기지 않는다: 건물이 없는 칸은 모두 쓰임이 있다. 없는 키트는 건너뛴다.
import { pick, type Board, type Use } from "./modernCityBoard";
import { KR_DISTRICT_DATA, type KRScene } from "./modernCityDistrictKinds";
import type { KRGround } from "./modernCityKoreanGround";

export interface KRRect { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }
const has = (b: Board, ids: readonly string[]) => ids.filter((id) => b.pal.kit(id));
/** 자리 이름(front·curb·alleyS·yard …)의 기물 목록 — 자료의 기본 줄 + 시트에 있는 한국 거리 기물(mc-prop-kr-*, 태그 slot:<자리>). */
export function slotKits(b: Board, slot: string): string[] {
  const hit = b.krCache.get(slot); if (hit) return hit;
  // 한국 거리 기물은 자리 태그(slot:<자리>)와 묶음 태그(set:<지구 묶음>)로 고른다 — 공용(set:common)과 이 지구가 쓰는 묶음만.
  const extra = (b.pal.kitIds?.() ?? []).filter((id) => {
    if (!id.startsWith("mc-prop-kr-")) return false;
    const tags = b.pal.kit(id)?.tags ?? []; if (!tags.includes(`slot:${slot}`)) return false;
    const set = tags.find((t) => t.startsWith("set:"))?.slice(4);
    return !set || set === "common" || !b.krSets || b.krSets.includes(set);
  });
  const out = [...has(b, KR_DISTRICT_DATA.slots[slot] ?? []), ...extra, ...extra];   // 한국 기물은 두 번 넣어 더 자주
  b.krCache.set(slot, out); return out;
}
/** 바닥 표시(밟고 지나가는 위층 그림 — 맨홀·얼룩·주차 칸·노면 글씨): 모든 칸이 맵 안 · 위층이 비었고 · allow 용도일 때만. 칸의 쓰임은 바꾸지 않는다. */
export function putDecal(b: Board, id: string, x: number, y: number, allow: readonly Use[]): boolean {
  const k = b.pal.kit(id); if (!k) return false;
  for (let r = 0; r < k.height; r++) for (let c = 0; c < k.width; c++) { if (!b.in(x + c, y + r)) return false; const i = b.k(x + c, y + r); if (b.upper[i]! >= 0 || !allow.includes(b.use[i]!)) return false; }
  k.rows.forEach((row, r) => { for (let c = 0; c < k.width; c++) { const t = row.upperTiles?.[c] ?? -1; if (t >= 0) b.upper[b.k(x + c, y + r)] = t; } });
  b.props.push({ kit: id, x, y }); return true;
}
/** 밑줄 맞춰 놓기: 키트 맨 아랫줄이 baseY 에 오게. 솟은 칸은 건물 위로 겹칠 수 있다. */
export function putOn(b: Board, id: string, x: number, baseY: number, allow: readonly Use[] = ["walk", "yard", "park"]): boolean {
  const k = b.pal.kit(id); if (!k) return false;
  // 한국 거리 기물은 한 맵에 같은 것이 셋까지(태그 max:<수> 가 있으면 그 수 — 고양이·조형물은 하나, 이어 붙는 난간·담은 제한 없음).
  const kr = id.startsWith("mc-prop-kr-"), n = b.krCount.get(id) ?? 0;
  if (kr && n >= Number(k.tags?.find((t) => t.startsWith("max:"))?.slice(4) ?? 3)) return false;
  if (!b.propOver(id, x, baseY - k.height + 1, allow)) return false;
  if (kr) b.krCount.set(id, n + 1);
  return true;
}
/** 줄 따라 기물: x0..x1 을 step 간격으로 훑어 slot 의 기물을 놓는다(같은 기물이 연달아 서지 않게). 놓은 수. */
export function lineProps(b: Board, r: () => number, slot: string, x0: number, x1: number, baseY: number, step: readonly [number, number], allow: readonly Use[] = ["walk", "yard", "park"]): number {
  const ids = slotKits(b, slot); if (!ids.length) return 0;
  let n = 0, prev = "";
  for (let x = x0 + Math.floor(r() * step[0]); x <= x1; x += step[0] + Math.floor(r() * (step[1] - step[0] + 1))) {
    const id = pick(r, ids.filter((i) => i !== prev)); const k = b.pal.kit(id)!;
    if (x + k.width - 1 > x1) continue;
    if (putOn(b, id, x, baseY, allow)) { n++; prev = id; x += k.width - 1; }
  }
  return n;
}
/** 장면 하나(같이 놓는 킷 묶음)를 baseY 줄의 x 에 — 꼭 있어야 하는 킷이 다 들어갈 때만. */
export function putScene(b: Board, sc: KRScene, x: number, baseY: number, allow: readonly Use[]): boolean {
  const need = sc.kits.filter((k) => !k.opt);
  if (need.some((k) => !b.pal.kit(k.k))) return false;
  const top = (id: string) => baseY - b.kit(id).height + 1;
  if (need.some((k) => !b.fitsOver(k.k, x + k.dx, top(k.k), allow))) return false;
  for (const k of sc.kits) if (b.pal.kit(k.k)) b.propOver(k.k, x + k.dx, top(k.k), allow);
  return true;
}
export function sceneAlong(b: Board, r: () => number, name: string, x0: number, x1: number, baseY: number, allow: readonly Use[] = ["walk", "yard", "park"]): boolean {
  const sc = KR_DISTRICT_DATA.scenes[name]; if (!sc) return false;
  for (let t = 0; t < 24; t++) { const x = x0 + 1 + Math.floor(r() * Math.max(1, x1 - x0 - 5)); if (putScene(b, sc, x, baseY, allow)) return true; }
  return false;
}

/** 옥상 장면: 빈 지붕 면(한국 건물 키트의 ai.roofFace, empty)에 옥상 기물(mc-roof-kr-*)을 왼쪽부터 얹는다 — 건물 칸 위 넷째 층. 얹은 수. */
export function roofScene(b: Board, r: () => number, kitId: string, x: number, y: number): number {
  const face = b.pal.kit(kitId)?.roof; if (!face?.empty) return 0;
  const ids = (b.pal.kitIds?.() ?? []).filter((id) => id.startsWith("mc-roof-kr-") && b.kit(id).width <= face.w && b.kit(id).height <= face.h);
  let n = 0, prev = "";
  for (let cx = x + face.dx + (face.w >= 5 && r() < 0.5 ? 1 : 0); cx < x + face.dx + face.w && ids.length;) {
    const fit = ids.filter((id) => id !== prev && cx + b.kit(id).width <= x + face.dx + face.w);
    if (!fit.length) break;
    const id = pick(r, fit), k = b.kit(id), top = y + face.dy + face.h - k.height;
    let ok = true;
    for (let ry = 0; ry < k.height && ok; ry++) for (let rx = 0; rx < k.width; rx++) { const i = b.k(cx + rx, top + ry); if (!b.in(cx + rx, top + ry) || b.use[i] !== "bld" || b.upper2[i]! >= 0) { ok = false; break; } }
    if (ok) {
      k.rows.forEach((row, ry) => { for (let rx = 0; rx < k.width; rx++) { const t = row.upperTiles?.[rx] ?? -1; if (t >= 0) b.upper2[b.k(cx + rx, top + ry)] = t; } });
      b.props.push({ kit: id, x: cx, y: top }); n++; prev = id;
    }
    cx += k.width + (r() < 0.4 ? 1 : 0);
  }
  return n;
}

/** 세워 둔 차(옆모습 5×2) — 밑줄 baseY. */
export function parkCar(b: Board, r: () => number, x: number, baseY: number, allow: readonly Use[] = ["walk", "yard", "road"]): boolean {
  const ids = slotKits(b, "parked"); if (!ids.length) return false;
  const id = pick(r, ids); const k = b.kit(id);
  if (!b.fits(id, x, baseY - k.height + 1, allow)) return false;
  b.stamp(id, x, baseY - k.height + 1, "veh"); b.props.push({ kit: id, x, y: baseY - k.height + 1 }); return true;
}
/** 주차 줄: x0..x1 에 차를 세운다(빈자리엔 고깔). rate = 찬 자리 비율. */
export function parkingLane(b: Board, r: () => number, x0: number, x1: number, baseY: number, rate: number, allow: readonly Use[] = ["walk", "yard", "road"]): number {
  let n = 0;
  for (let x = x0 + Math.floor(r() * 3); x + 4 <= x1; x += 6) {
    if (r() < rate) { if (parkCar(b, r, x, baseY, allow)) n++; }
    else if (r() < 0.5) putOn(b, pick(r, ["mc-prop-cone-a", "mc-prop-cone-b"]), x + 2, baseY, allow);
    putDecal(b, "mc-prop-kr-bay-side", x + 5, baseY - 1, allow);      // 칸 사이 구분선(그림이 있을 때)
  }
  return n;
}
function noseCars(b: Board, r: () => number, x0: number, x1: number, topY: number, rate: number): number {
  const ids = slotKits(b, "parkedNose").filter((id) => b.kit(id).width <= 3 && b.kit(id).height <= 3); let n = 0, first = true;
  for (let x = x0; x + 2 <= x1 && ids.length; x += 3) {
    // 주차 칸 하나 = 3×3. 칸 표시(그림이 있을 때)를 먼저 깔고 차를 그 위에 세운다 — 빈 칸에도 표시는 남는다.
    let free = true;
    for (let dy = 0; dy < 3 && free; dy++) for (let dx = 0; dx < 3; dx++) { const i = b.k(x + dx, topY + dy); if (!b.in(x + dx, topY + dy) || b.upper[i]! >= 0 || b.keep[i] || (b.use[i] !== "walk" && b.use[i] !== "yard")) { free = false; break; } }
    if (!free) continue;
    const park = r() < rate;
    const marked = putDecal(b, first && !park && b.pal.kit("mc-prop-kr-bay-disabled") ? "mc-prop-kr-bay-disabled" : "mc-prop-kr-bay-nose", x, topY, ["walk", "yard"]);
    first = false;
    if (!park) continue;
    const id = pick(r, ids), k = b.kit(id), cx = x + Math.floor((3 - k.width) / 2), cy = topY + 3 - k.height;
    if (!marked && !b.fits(id, cx, cy, ["walk", "yard"])) continue;
    b.stamp(id, cx, cy, "veh"); b.props.push({ kit: id, x: cx, y: cy }); n++;
  }
  return n;
}

/** 건물 뒤 마당(윗 골목으로 열린 빈터): 골목 바닥 + 뒤 주차·나무·잡동사니. */
export function backYard(b: Board, r: () => number, g: KRGround, q: KRRect, parked: number) {
  const w = q.x1 - q.x0 + 1, h = q.y1 - q.y0 + 1;
  for (let y = q.y0; y <= q.y1; y++) for (let x = q.x0; x <= q.x1; x++) if (b.use[b.k(x, y)] === "ground") g.yard(x, y);
  if (h >= 4 && w >= 3 && r() < parked) noseCars(b, r, q.x0, q.x1, q.y1 - 2, 0.75);
  else if (h >= 3 && w >= 2 && r() < 0.6) { const id = pick(r, slotKits(b, "yardTree")); const k = b.pal.kit(id); if (k) putOn(b, id, q.x0 + Math.floor(r() * Math.max(1, w - k.width + 1)), q.y1, ["yard"]); }
  lineProps(b, r, "yard", q.x0, q.x1, q.y1, [1, 3], ["yard"]);
  if (h >= 6) lineProps(b, r, "yard", q.x0, q.x1, q.y1 - 3 - Math.floor(r() * (h - 5)), [2, 4], ["yard"]);
}

/** 빈 필지의 쓰임 하나 — q = 띠 높이 전체, 아래(남쪽) 길로 열려 있다. */
export function fillLot(b: Board, r: () => number, g: KRGround, use: string, q: KRRect): string {
  const w = q.x1 - q.x0 + 1, h = q.y1 - q.y0 + 1;
  const each = (f: (x: number, y: number) => void) => { for (let y = q.y0; y <= q.y1; y++) for (let x = q.x0; x <= q.x1; x++) if (b.use[b.k(x, y)] === "ground") f(x, y); };
  if (use.startsWith("monument:")) {
    // 기념물(문 없는 랜드마크 — 시계탑·주탑): 작은 광장 가운데 하나. 키트가 없거나 자리가 모자라면 쌈지 공원이 된다.
    const id = `mc-bld-${use.slice(9)}`, k = b.pal.kit(id);
    const x = k ? q.x0 + Math.floor((w - k.width) / 2) : 0;
    if (!k || k.width + 2 > w || k.height > h || !b.fits(id, x, q.y1 - k.height + 1, ["ground", "walk"])) return fillLot(b, r, g, "pocket", q);
    each((cx, cy) => g.plaza(cx, cy));
    b.stamp(id, x, q.y1 - k.height + 1, "bld"); b.props.push({ kit: id, x, y: q.y1 - k.height + 1 });
    for (const cx of [q.x0, q.x1 - 1]) putOn(b, pick(r, ["mc-prop-bench-a", "mc-prop-bench-b", "mc-prop-bench-c"]), cx, q.y1, ["walk"]);
    for (const cx of [x - 1, x + k.width]) putOn(b, pick(r, ["mc-prop-park-lamp-a", "mc-prop-park-lamp-b", "mc-prop-park-lamp-c"]), cx, q.y1, ["walk"]);
    putOn(b, pick(r, slotKits(b, "yardTree")), q.x0, q.y0 + Math.min(h - 1, 3), ["walk"]);
    return "monument square";
  }
  if (use === "parking") {
    // 주차장: 위아래 두 줄로 머리를 댄 차(가운데는 드나드는 통로), 들머리에 차단기·요금 기계.
    each((x, y) => g.lot(x, y));
    noseCars(b, r, q.x0, q.x1, q.y0, 0.85);
    if (h >= 8) noseCars(b, r, q.x0 + 3, q.x1, q.y1 - 3, 0.85);
    else if (h >= 6 && w >= 9) parkCar(b, r, q.x0 + 3, q.y1 - 1, ["yard"]);
    putOn(b, pick(r, ["mc-prop-barrier-a", "mc-prop-barrier-b"]), q.x0, q.y1, ["yard"]);
    putOn(b, pick(r, ["mc-prop-meter-a", "mc-prop-meter-b", "mc-prop-meter-c"]), q.x0 + 2, q.y1, ["yard"]);
    putOn(b, pick(r, ["mc-prop-cone-a", "mc-prop-cone-b"]), q.x1, q.y1, ["yard"]);
    lineProps(b, r, "kr-parking", q.x0, q.x1, q.y1, [3, 5], ["yard"]);
    return "parking lot";
  }
  if (use === "pocket") {
    each((x, y) => (x === q.x0 || x === q.x1 ? g.lawn(x, y) : g.plaza(x, y)));   // 풀은 양 끝 한 열 화단뿐 — 잔디밭이 아니다
    const big = has(b, ["mc-prop-keyaki-a", "mc-prop-keyaki-b", "mc-prop-ginkgo-big-a", "mc-prop-blossom-a"]);
    if (big.length && h >= 5) putOn(b, pick(r, big), q.x0, q.y0 + Math.min(h - 2, 4), ["park", "walk"]);
    putOn(b, pick(r, slotKits(b, "yardTree")), q.x1 - 1, q.y1 - 1, ["park", "walk"]);
    putOn(b, pick(r, ["mc-prop-shelter-a", "mc-prop-shelter-b", "mc-prop-shelter-c"]), q.x0 + Math.max(2, Math.floor((w - 3) / 2)), q.y0 + 2, ["walk", "park"]);
    for (const [x, y] of [[q.x0 + 2, q.y1 - 1], [q.x1 - 4, q.y0 + Math.min(h - 2, 5)]] as const) putOn(b, pick(r, ["mc-prop-bench-a", "mc-prop-bench-b", "mc-prop-bench-c"]), x, y, ["walk", "park"]);
    putOn(b, pick(r, ["mc-prop-park-lamp-a", "mc-prop-park-lamp-b", "mc-prop-park-lamp-c"]), q.x1 - 2, q.y1 - 2, ["walk", "park"]);
    for (const [x, y] of [[q.x0, q.y1], [q.x1 - 1, q.y0 + 1]] as const) putOn(b, pick(r, ["mc-prop-azalea-a", "mc-prop-azalea-b"]), x, y, ["park", "walk"]);
    return "pocket park";
  }
  if (use === "playground") {
    each((x, y) => (y === q.y1 || x === q.x0 || x === q.x1 ? g.plaza(x, y) : g.play(x, y)));
    for (let k = 0, x = q.x0 + 1; k < 3 && x + 1 < q.x1; k++, x += 3) putOn(b, pick(r, ["mc-prop-sand-a", "mc-prop-sand-b", "mc-prop-sand-c"]), x, q.y0 + 1 + (k % 2) * 2, ["park"]);
    putOn(b, pick(r, slotKits(b, "yardTree")), q.x1 - 2, q.y0 + 2, ["park", "walk"]);
    putOn(b, pick(r, ["mc-prop-bench-a", "mc-prop-bench-b"]), q.x0 + 1, q.y1 - 1, ["park", "walk"]);
    putOn(b, pick(r, ["mc-prop-bench2-a", "mc-prop-bench2-b"]), q.x1 - 2, q.y1 - 1, ["park", "walk"]);
    putOn(b, pick(r, ["mc-prop-park-lamp-a", "mc-prop-park-lamp-c"]), q.x0, q.y1, ["walk", "park"]);
    // 큰 놀이 기구(미끄럼틀·그네·정글짐)를 먼저 한 줄에, 그다음 작은 것.
    const play = slotKits(b, "kr-play"), bigPlay = [...new Set(play.filter((id) => b.kit(id).width >= 2))].sort(() => r() - 0.5);
    let px = q.x0 + 1;
    for (const id of bigPlay) { const k = b.kit(id); if (px + k.width - 1 > q.x1 - 1 || k.height > h - 2) continue; if (putOn(b, id, px, q.y1 - 2, ["park"])) px += k.width + 1; }
    lineProps(b, r, "kr-play", q.x0 + 1, q.x1 - 1, q.y0 + Math.min(h - 3, 4), [2, 3], ["park"]);
    return "playground";
  }
  if (use === "market") {
    each((x, y) => g.arcade(x, y));
    const stalls = slotKits(b, "stall");
    for (let y = q.y0 + 1; y + 1 <= q.y1 - 1 && stalls.length; y += 4) for (let x = q.x0 + ((y - q.y0) % 8 === 1 ? 0 : 1); x + 1 <= q.x1; x += 3) putOn(b, pick(r, stalls), x, y + 1, ["walk"]);
    lineProps(b, r, "alleyS", q.x0, q.x1, q.y1, [2, 4], ["walk"]);
    return "market lane";
  }
  if (use === "construction") {
    each((x, y) => g.sand(x, y));
    const open = q.x0 + 2 + Math.floor(r() * Math.max(1, w - 6));
    for (let x = q.x0; x + 1 <= q.x1; x += 2) if (x < open || x > open + 1) putOn(b, pick(r, ["mc-prop-hoarding-a", "mc-prop-hoarding-b", "mc-prop-hoarding-c"]), x, q.y1, ["park"]);
    putOn(b, r() < 0.5 ? "mc-anim-arrow-board-r" : "mc-anim-arrow-board-l", open - 2 >= q.x0 ? open - 2 : open + 2, q.y1 - 2, ["park"]);
    for (let k = 0; k < Math.max(3, Math.floor(w * h / 9)); k++) putOn(b, pick(r, ["mc-prop-boxes-a", "mc-prop-boxes-b", "mc-prop-boxes-c", "mc-prop-cone-a", "mc-prop-cone-b", "mc-prop-barrier-a", "mc-prop-barrier-b", "mc-prop-fence-a", "mc-prop-fence-b", ...slotKits(b, "kr-site")]), q.x0 + Math.floor(r() * (w - 1)), q.y0 + Math.floor(r() * Math.max(1, h - 3)), ["park"]);
    return "construction site";
  }
  each((x, y) => g.yard(x, y));
  for (let x = q.x0; x <= q.x1; x++) putOn(b, pick(r, ["mc-prop-recycle3-a", "mc-prop-recycle3-b", "mc-prop-recycle3-c", "mc-prop-trashbags-a", "mc-prop-trashbags-c", "mc-prop-boxes-a", ...slotKits(b, "kr-recycle")]), x, q.y0 + Math.min(h - 1, 1), ["yard"]);
  lineProps(b, r, "yard", q.x0, q.x1, q.y1 - 1, [2, 3], ["yard"]);
  return "recycling yard";
}
