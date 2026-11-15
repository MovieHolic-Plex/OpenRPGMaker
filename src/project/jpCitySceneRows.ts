// project/jpCitySceneRows.ts
// 거리 장면의 건물 줄 — 가게 줄(벽을 맞대거나 1~3칸 골목 틈, 가게 앞에 물건을 내놓는다)과 집 줄(길에서 물려 세우고 담·대문·마당·카포트).
// 키가 큰 띠는 뒷골목을 사이에 두고 뒷줄을 한 줄 더 세운다. 건물은 SceneCtx.nextKit 이 골라 한 지도에 같은 그림이 두 번 서지 않는다.
import { randomBuildingArgs } from "@/project/jpCityStreetComposer";
import { Occ, type SceneBlock, type SceneCtx, type SceneLayout, type ScenePlaced } from "@/project/jpCitySceneCtx";
import { SCENE_ROOFS, SCENE_SIZES, sceneList, yardGround } from "@/project/jpCitySceneKinds";
import { PIECES } from "@/project/jpCityScenePieces";
import { streetTagged } from "@/project/jpCityStreetPieces";

const ASSEMBLED_KO: Readonly<Record<string, string>> = { konbini: "편의점", izakaya: "이자카야", ramen: "라멘집", cafe: "카페", shop: "상점", office: "사무소", garage: "차고", apartment: "아파트", machiya: "마치야", house: "주택", sento: "센토(목욕탕)", bento: "도시락집" };
const TREES = ["jp-prop-tree-zelkova", "jp-prop-tree-ginkgo", "jp-prop-tree-sakura"];
const CARS = ["jp-prop-car-white", "jp-prop-car-silver", "jp-prop-car-black", "jp-prop-car-blue", "jp-prop-car-red", "jp-prop-car-green", "jp-prop-car-navy"];

interface RowFront { /** 건물 발 바로 아래 줄 */ readonly nA: number; /** 연석 줄(없으면 생활도로·뒷골목) */ readonly nK?: number; readonly paved: boolean }

/** 종류의 건물 섞임에서 분류 순서를 뽑는다(무게대로 섞은 순서 — 앞이 먼저 고려된다). */
function drawCats(c: SceneCtx, mix: Readonly<Record<string, number>>): string[] {
  return Object.entries(mix).map(([cat, w]) => ({ cat, r: Math.pow(c.rng(), 1 / Math.max(0.01, w)) })).sort((a, b) => b.r - a.r).map((x) => x.cat);
}

/** 키트가 없는 가게 종류(도시락집·차고)는 조립 건물로 — 후보 여덟(점점 단순), 첫 성공을 쓴다. */
function assembled(c: SceneCtx, role: string, x: number, foot: number, w: number, rows: number): ScenePlaced {
  const h = Math.min(rows, 7);
  const p: ScenePlaced = { role, ko: ASSEMBLED_KO[role] ?? role, x, y: foot - h + 1, w, h, foot, doors: [] };
  c.placed.push(p);
  c.mark(x, foot - h + 1, w, h, Occ.Bldg);
  c.mark(x, foot + 1, w, 1, Occ.Walk, [Occ.Lot]);
  const side: "L" | "R" = c.rng() < 0.5 ? "L" : "R";
  for (let attempt = 0; attempt < 8; attempt++) {
    const args = randomBuildingArgs(c.rng, role, w, attempt, h, side, false);
    c.bldgs.push({ tool: "build_jp_city_building", args: { mapId: c.mapId, x, y: foot, ...args }, optional: true, note: `try:${c.placed.length - 1}` });
  }
  return p;
}

/** 가게 줄 하나. 돌려주는 값 = 세운 건물들(왼쪽부터). */
function shopRow(c: SceneCtx, sx: number, ex: number, foot: number, top: number, wanted: string[], mix: Readonly<Record<string, number>>, big = false, mainRow = false, carFront = false): ScenePlaced[] {
  const maxH = foot - top + 1;
  const row: ScenePlaced[] = [];
  let cursor = sx, prev: ScenePlaced | undefined, share = false;
  // 새 거리의 중형 건물: 블록(줄)에 하나까지, 블록 끝(모퉁이)에만 선다. 편의점·슈퍼·은행·우체국은 가게 거리, 파출소는 큰길 줄의 모퉁이(교차로), 의원·학원은 집이 섞이는 동네.
  let endKit: NonNullable<ReturnType<SceneCtx["nextKit"]>> | undefined;
  const exRow = ex;
  if (c.fable && ex - sx >= 16 && c.rng() < 0.75) {
    const shuffle = (list: readonly string[]) => list.map((r) => ({ r, k: c.rng() })).sort((a, b) => a.k - b.k).map((q) => q.r);
    // 대형 건물(블록 면에 하나): 고층 종류의 큰길 줄에 오피스·호텔·백화점, 큰길 줄에 병원 — 띠가 건물 키보다 얕으면 서지 않는다(nextKit 이 키를 본다).
    const largeRoles = mainRow || big ? shuffle([...(c.kind.tall ? LARGE_DOWNTOWN : []), ...(carFront && c.rng() < 0.6 ? ["hospital"] : [])]) : [];   // 병원은 차도가 있는 큰길에만(구급차 자리가 차도로 열린다)
    const roles = [...(c.rng() < 0.8 ? largeRoles : []), ...shuffle([...MEDIUM_SHOP, ...(mainRow || big ? ["koban"] : []), ...(c.kind.houseShare >= 0.15 ? MEDIUM_HOME : [])])];
    // 블록 끝이 길이 아니라 옆 구획의 건물에 닿아 있으면 그쪽 끝에는 세우지 않는다(큰 건물 둘이 벽을 맞대지 않는다).
    const freeL = c.at(sx - 1, foot) !== Occ.Bldg && c.at(sx - 1, foot) !== Occ.Lot, freeR = c.at(ex, foot) !== Occ.Bldg && c.at(ex, foot) !== Occ.Lot;
    const left = freeL && (!freeR || c.rng() < 0.5);
    // 초대형(역 앞 상가 빌딩·구청·타워 맨션): 고층 종류의 큰길 줄 블록 끝에, 지도에 하나까지 — 12칸 폭과 제 키만큼의 띠 깊이가 있을 때만.
    const xl = c.kind.tall && mainRow && carFront ? shuffle(XLARGE) : [];
    if (freeL || freeR) for (const role of [...xl, ...roles]) {
      const kit = c.nextKit([], { x: left ? sx : ex - 8, foot }, ex - sx - 9, maxH, { role, big: xl.includes(role) });
      if (!kit || (kit.bay && !carFront)) continue;                                    // 차가 드나드는 입이 있는 건물은 차도 앞에만
      if (left) { const p = c.placeKit(kit, sx, foot); row.push(p); prev = p; cursor = sx + kit.w; } else { endKit = kit; ex -= kit.w; }   // 오른쪽 끝: 자리만 잡아 두고, 줄을 다 세운 뒤 마지막 가게에 벽을 맞대 세운다
      break;
    }
  }
  for (let guard = 0; guard < 40 && ex - cursor >= 3; guard++) {
    const canShare = share && !!prev?.kit && prev.kit.mr === 1;
    const at = { x: cursor, foot };
    // 요청한 가게: 앞에서부터 이 자리에 설 수 있는 첫 종류. 키트가 아예 없는 종류(도시락집·차고)만 조립 건물로 세운다 — 못 세운 것은 다음 자리·다음 줄에서 다시 본다.
    let kit: ReturnType<SceneCtx["nextKit"]>, built: ScenePlaced | undefined;
    for (let i = 0; i < wanted.length && !kit && !built; i++) {
      const role = wanted[i]!;
      kit = c.nextKit([], at, ex - cursor + (canShare ? 1 : 0), maxH, { role });
      if (kit) wanted.splice(i, 1);
      else if (!c.buildingPool.some((q) => q.role === role) && ASSEMBLED_KO[role] && ex - cursor >= 5) { wanted.splice(i, 1); built = assembled(c, role, cursor, foot, Math.min(6, ex - cursor), maxH); }
    }
    if (built) { row.push(built); prev = built; cursor = built.x + built.w; share = false; continue; }
    // 좁은 가게(폭 8칸까지)를 먼저 — 한 줄에 여러 채가 연달아 서게. 섞임에 맞는 것이 없으면 다른 분류의 안 세운 건물로 줄을 잇는다.
    const room = ex - cursor + (canShare ? 1 : 0), cats = drawCats(c, mix);
    kit ??= c.nextKit(cats, at, Math.min(room, 8), maxH, { notH: prev?.h, fresh: true }) ?? c.nextKit(cats, at, room, maxH, { notH: prev?.h, big })
      ?? c.nextKit(FILL_CATS.filter((q) => !cats.includes(q) && (mainRow ? q !== "house" && q !== "apartment" : true)), at, room, maxH, { notH: prev?.h, fresh: true });
    if (!kit) break;
    let x = canShare && kit.ml === 1 ? cursor - 1 : cursor;
    if (x + kit.w > ex) { if (x === cursor - 1) break; kit = c.nextKit(drawCats(c, mix), at, ex - cursor, maxH, { notH: prev?.h }); if (!kit) break; x = cursor; }
    const p = c.placeKit(kit, x, foot);
    if (prev && x === cursor - 1) c.restoreCol(prev);
    if (kit.cat === "house" || kit.cat === "apartment") c.fill(x, p.y, kit.w, kit.h, yardGround(c.kind, c.tone, row.length));   // 집은 가게 줄에 서도 제 필지 바닥 위에
    row.push(p); prev = p; cursor = x + kit.w;
    // 다음 건물과의 사이: 처마 칸을 나눠 써 벽이 한 칸 틈으로 붙거나(6할) · 그대로 맞대거나 · 골목 한 칸을 더 둔다.
    const r = c.rng();
    share = r < 0.7;
    if (r >= 0.9 && !(c.fable && kit.ml === 0 && kit.mr === 0)) cursor += 1;   // 새 건물(키트 폭 = 벽 폭)은 벽을 맞대 세운다 — 틈은 세로 길뿐
  }
  // 줄 끝에 4칸 넘게 남으면 좁은 조립 건물 한 채(이 지도에 아직 없는 종류, 지도에 셋까지) — 그래도 남는 자투리는 쓰임으로 닫는다.
  for (let n = c.placed.filter((q) => !q.kit).length; ex - cursor >= 4 && n < 3 && !mainRow && !c.fable; n++) {   // 새 거리는 옛 조립 건물을 세우지 않는다
    const role = FILL_ROLES.find((r) => !c.placed.some((q) => q.role === r || (q.role === "restaurant" && r === "ramen")));
    if (!role) break;
    const p = assembled(c, role, cursor, foot, Math.min(ex - cursor >= 9 ? 5 : 6, ex - cursor), Math.min(maxH, 9));
    row.push(p); cursor = p.x + p.w;
  }
  if (endKit) { ex = exRow; if (cursor + endKit.w <= ex) { const p = c.placeKit(endKit, cursor, foot); row.push(p); cursor += endKit.w; } }
  closeGap(c, cursor, ex, foot);
  return row;
}

/** 중형 건물의 종류(사전의 role): 가게 거리의 블록 끝에 서는 것 · 집이 섞이는 동네에 서는 것. */
const XLARGE = ["station-mall", "ward-office", "tower-mansion"];
const LARGE_DOWNTOWN = ["office-tower", "hotel", "mall"];
const MEDIUM_SHOP = ["konbini", "market", "bank", "post"], MEDIUM_HOME = ["clinic", "juku"], MEDIUM_RESIDENTIAL = ["clinic", "juku", "sento", "big-bath"], BATHS = ["sento", "big-bath"];

const FILL_ROLES = ["izakaya", "cafe", "bento", "ramen", "shop", "office", "garage", "konbini"];
const FILL_CATS = ["shop", "food", "commercial", "public", "shut", "industry", "market", "house", "apartment"];

/** 줄 끝에 남은 빈 포장(2칸 넘게)을 쓰임으로 닫는다: 6칸 넘으면 코인 주차 한 칸, 4~5칸 자판기 줄, 2~3칸 화단·자전거·사당 — 뒤는 담. */
function closeGap(c: SceneCtx, x0: number, x1: number, foot: number): void {
  let x = x0;
  while (x1 - x >= 2) {
    const w = x1 - x;
    if (w >= 7 && c.size("jp-lot-bay") && c.all(x, foot - 3, 7, 4, [Occ.Lot])) {
      c.fill(x, foot - 2, 7, 3, "거리 · 주차장");
      c.put("jp-lot-bay", x, foot - 2, { floor: true, baseRows: 3 });
      const car = c.rng() < 0.6 ? c.least(CARS) : undefined;
      if (car) c.put(car, x, foot - 2, { baseRows: 3, stack: true });
      c.putAny(sceneList("chuusha", "sign"), x + 6, foot);
      c.edge(c.hline(x, foot - 3, 7), "철망 울타리");
      c.scenesUsed.add("chuusha"); x += 7;
    } else if (w >= 4) {
      const id = c.putAny(sceneList("kado", "pair").filter((q) => c.size(q)![0] <= w), x, foot) ?? c.putAny(["jp-kadan", "jp-asagao", "jp-bike-shelter"].filter((q) => c.size(q)![0] <= w), x, foot);
      if (id) c.scenesUsed.add("kado");
      const n = id ? c.size(id)![0] : 2;
      c.edge(c.hline(x, foot - 2, n), "블록담"); x += n;
    } else {
      const id = c.putAny(["jp-prop-vending-aka", "jp-prop-vending-sora", "jp-prop-vending-midori", "jp-hokora-jizo", "jp-prop-bike-aka", "jp-prop-bike-sora", "jp-pots", "jp-prop-planter", "jp-prop-bike-cluster", "jp-gomi-box"].filter((q) => c.size(q)![0] <= w), x, foot);
      const n = id ? c.size(id)![0] : w;
      c.edge(c.hline(x, foot - 2, n), "블록담"); x += n;
    }
  }
}

/** 평지붕 위 옥상 장면(물탱크·실외기·빨래·안테나 …) — 지붕 면을 아는 건물(jpCityStreetKinds.json roofs)에, 옥상 기물이 칩셋에 있을 때만. */
function roofScene(c: SceneCtx, p: ScenePlaced): void {
  const roof = p.kit ? SCENE_ROOFS[p.kit.id] : undefined, pool = sceneList("okujo", "roof");
  if (!roof || !pool.length) return;
  const [dx, dy, w, h] = roof as [number, number, number, number];
  let any = false;
  for (let x = p.x + dx + Math.floor(c.rng() * 2); x < p.x + dx + w; ) {
    const id = c.putAny(pool.filter((q) => c.size(q)![1] <= h && x + c.size(q)![0] <= p.x + dx + w), x, p.y + dy + h - 1, { layer4: true, baseRows: h, base: [Occ.Bldg], over: [Occ.Bldg] });
    if (id) any = true;
    x += (id ? c.size(id)![0] : 1) + 1 + Math.floor(c.rng() * 3);
  }
  if (any) c.scenesUsed.add("okujo");
}

/** 건물 뒤(지붕 위쪽 빈 줄)에 나무 한 그루 — 건물보다 먼저 찍어 줄기는 지붕에 가리고 수관만 보인다. */
function treeBehind(c: SceneCtx, p: ScenePlaced, top: number): void {
  if (p.y - 4 < top + 1 || p.w < 6 || c.rng() < 0.35) return;
  const x = p.x + 1 + Math.floor(c.rng() * Math.max(1, p.w - 5)), y = p.y - 4;
  if (c.fable) { c.stPut(streetTagged("gardentree"), x, p.y - 1); return; }   // 새 거리: 지붕 뒤 빈 줄에 마당 나무가 통째로 선다(가리지 않는다)
  if (!c.all(x, y, 4, 4, [Occ.Lot])) return;
  for (let yy = y; yy < y + 4; yy++) for (let xx = x; xx < x + 4; xx++) { c.drawn[yy * c.W + xx] = 1; c.occ[yy * c.W + xx] = Occ.Prop; }
  const id = TREES[Math.floor(c.rng() * TREES.length)]!;
  c.early.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/${id}`, mapId: c.mapId, x, y }, optional: true, note: "prop" });
  c.usedProps.set(id, (c.usedProps.get(id) ?? 0) + 1);
}

/**
 * 가게 줄 뒤(지붕 위쪽 빈 대지)를 뒷마당으로: 건물마다 대지 포장과 다른 바닥을 깔고 살림(빨래 건조대·쓰레기 수거함·물탱크·창고·프로판·실외기·자전거·화분)을 둔다.
 * 세로 길에 닿는 끝 필지는 폭·깊이가 되면 주차 한 칸. 왜: 가게 뒤가 어두운 포장 한 면으로 남아 지도에서 가장 흔한 색이 되었다(2026-11-15 조율자).
 */
function backYards(c: SceneCtx, row: readonly ScenePlaced[], sx: number, ex: number, yT: number, openW: boolean, openE: boolean): void {
  const { tone, rng } = c;
  // 뒷마당 바닥: 흙·자갈·돌길 — 대지 포장과 같은 재료, 아스팔트(차도로 읽힌다)는 뺀다.
  const grounds = [...new Set([...tone.yard.filter((m) => m !== tone.green), "자갈 참배길", ...(tone.alley === "@lane" ? [] : [tone.alley])])].filter((m) => !tone.lot.includes(m) && m !== tone.road);
  const pool = sceneList("backalley", "yard");
  const sorted = [...row].sort((a, b) => a.x - b.x);
  let bay = false, any = false;
  sorted.forEach((p, i) => {
    const x0 = i === 0 ? sx : p.x, x1 = i === sorted.length - 1 ? ex : sorted[i + 1]!.x, yB = p.y - 1, h = yB - yT + 1, w = x1 - x0;
    if (h < 1 || w < 2 || !c.all(x0, yT, w, h, [Occ.Lot, Occ.Prop, Occ.Slit, Occ.Wall])) return;
    c.fill(x0, yT, w, h, grounds[(c.placed.indexOf(p) + c.seed) % grounds.length]!);
    const atW = i === 0 && openW, atE = i === sorted.length - 1 && openE;
    if (!bay && h >= 3 && w >= 7 && (atW || atE) && c.size("jp-lot-bay") && rng() < 0.7) {
      const bx = atW ? x0 : x1 - 7;
      if (c.all(bx, yB - 2, 7, 3, [Occ.Lot])) {
        c.fill(bx, yB - 2, 7, 3, "거리 · 주차장");
        c.put("jp-lot-bay", bx, yB - 2, { floor: true, baseRows: 3 });
        const car = rng() < 0.75 ? c.least(CARS) : undefined;
        if (car) c.put(car, bx, yB - 2, { baseRows: 3, stack: true });
        c.putAny(sceneList("chuusha", "sign"), atW ? bx + 6 : bx, yB);
        c.scenesUsed.add("chuusha"); bay = true;
      }
    }
    for (const [fy, rate] of [[yB, 0.85], ...(h >= 4 ? [[yB - 2, 0.5] as const] : [])] as const) for (let x = x0 + Math.floor(rng() * 2); x < x1; ) {
      const fit = pool.filter((q) => c.size(q)![1] <= fy - yT + 1 && x + c.size(q)![0] <= x1);
      const id = rng() < rate ? c.putAny(fit, x, fy, { gap: true, over: [Occ.Lot] }) : undefined;
      if (id) any = true;
      x += (id ? c.size(id)![0] : 1) + 1 + Math.floor(rng() * 3);
    }
  });
  if (any) c.scenesUsed.add("backalley");
}

/**
 * 새 거리의 가게 줄 뒤: 맨땅에 소품을 흩지 않고 쓰임을 준다(조율자 2026-11-15 «빈터로 읽힌다»).
 * 건물 바로 뒤는 뒷길(생활도로 포장 — 쓰레기통·상자·실외기·자전거가 담과 뒷벽에 붙어 선다). 띠가 깊으면 뒷길 두 줄 위를 필지로 나눠
 * 뒷길을 보는 집 줄 · 작은 공원 · 골목 사당 · 코인 주차장 · 자전거 주차장 · 빈터(지도에 하나)를 구획마다 계획이 고른다 — 필지마다 둘레가 있고 필지를 채운다.
 */
export function backStrip(c: SceneCtx, b: SceneBlock, row: readonly ScenePlaced[], yT: number, frontTop?: number): void {
  const { W } = c;
  // 키 큰 건물(대형)은 띠 뒤까지 닿는다 — 뒷길과 뒤 필지는 그 사이사이 구간마다 따로 선다.
  const low = row.filter((p) => p.h <= 9), tall = row.filter((p) => p.h > 9);
  const minY = frontTop ?? (low.length ? Math.min(...low.map((p) => p.y)) : row.length ? Math.min(...row.map((p) => p.y)) : b.band.foot + 1);
  const U = minY - yT;
  if (U < 1) return;
  const fam = c.kind.id === "roji" ? "alley" : "lane";
  const deep = U >= 5;
  const laneTop = deep ? minY - 2 : yT;
  const colTop = (x: number) => row.find((q) => x >= q.x && x < q.x + q.w)?.y ?? minY;
  const pool = [...streetTagged("backdoor"), ...streetTagged("bike")];
  c.scenesUsed.add("backalley");
  const cuts = [b.sx, ...tall.flatMap((p) => [p.x, p.x + p.w]), b.ex].sort((p, q) => p - q);
  for (let k = 0; k + 1 < cuts.length; k += 2) {
    const sx = Math.max(b.sx, cuts[k]!), ex = Math.min(b.ex, cuts[k + 1]!);
    if (ex - sx < 2) continue;
    for (let x = sx; x < ex; x++) for (let y = laneTop; y < colTop(x); y++) {
      const i = y * W + x;
      if (c.occ[i] !== Occ.Lot || c.drawn[i]) continue;
      c.fillFamily(x, y, 1, 1, fam);
      if (y < minY) c.occ[i] = Occ.Walk;
    }
    // 뒷길 북쪽은 담이나 필지 둘레로 닫힌다
    let wallY = yT - 1;
    if (deep) {
      wallY = laneTop - 1;
      const D = laneTop - yT, n = Math.max(1, Math.floor((ex - sx) / 10));
      const order = ["houses", "park", ...(c.rng() < 0.5 ? ["shrine-small"] : []), "parking", "bikepark", "vacant"].map((u) => ({ u, k: c.rng() })).sort((p, q) => p.k - q.k).map((q) => q.u);
      const used = new Set<string>();
      for (let m = 0; m < n; m++) {
        const a = sx + Math.floor(((ex - sx) * m) / n), e = sx + Math.floor(((ex - sx) * (m + 1)) / n), w = e - a;
        const sub: SceneBlock = { band: { ...b.band, top: yT, foot: laneTop - 1 }, sx: a, ex: e, use: "", noRear: true, edgeW: false, edgeE: false };
        let done = false;
        for (const u of [...order.filter((q) => !used.has(q)), ...order]) {
          if (u === "houses") { if (D >= 9 && w >= 10 && houseRow(c, a, e, laneTop - 1, yT, []).length) done = true; }
          else { const def = PIECES[u]!, cap = u === "parking" ? 8 : u === "bikepark" ? 7 : u === "vacant" ? 6 : 99; if (w >= def.minW && D >= def.minH && D <= cap && def.run(c, { bands: [], vstreets: [], blocks: [] }, sub)) { done = true; c.piecesUsed.push(u); } }
          if (done) { used.add(u); break; }
        }
        if (!done) pocketGreen(c, a, yT, w, D);
      }
    } else if (c.all(sx, yT - 1, ex - sx, 1, [Occ.Lot])) c.edge(c.hline(sx, yT - 1, ex - sx), "블록담");
    // 뒷길 살림: 북쪽 담에 붙여
    if (minY - laneTop >= 2) for (let x = sx + 1 + Math.floor(c.rng() * 3); x < ex - 1; x += 2 + Math.floor(c.rng() * 4)) c.stPut(pool, x, wallY + 1, { lax: true });
  }
  // 낮은 건물의 뒷벽에 붙여
  for (const p of low) if (p.y > minY) for (let x = p.x + Math.floor(c.rng() * 2); x < p.x + p.w; x += 2 + Math.floor(c.rng() * 3)) c.stPut(pool, x, p.y - 1);
}
/** 작은 심은 자리: 둘레(산울타리 — 초록을 안 쓰는 종류는 철망)와 안쪽 잔디·나무. 다른 쓰임이 안 들어가는 좁은 뒤 필지를 닫는다. */
function pocketGreen(c: SceneCtx, x: number, y: number, w: number, h: number): void {
  if (w < 3 || h < 3 || (h < 5 && c.kind.noGreen)) { c.fillFamily(x, y, w, h, c.kind.id === "roji" ? "alley" : "lane"); return; }
  // 얕은 자리(3~4줄): 뒤 담에 기댄 심은 띠 — 뒷길 쪽과 양 끝만 산울타리, 안에 정원수가 줄지어 선다(울타리 두 줄이 맞붙은 덩어리가 되지 않게).
  if (h < 5) {
    c.fill(x, y, w, h, c.tone.green);
    c.edge([...c.hline(x, y + h - 1, w), ...c.vline(x, y, h - 1), ...c.vline(x + w - 1, y, h - 1)], "생울타리");
    for (let tx = x + 1 + Math.floor(c.rng() * 2); tx + 2 < x + w - 1; tx += 3 + Math.floor(c.rng() * 2)) c.stPut(streetTagged("gardentree"), tx, y + h - 2);
    return;
  }
  c.fill(x, y, w, h, c.kind.noGreen ? c.tone.sidewalk : c.tone.green);
  c.edge([...c.hline(x, y, w), ...c.hline(x, y + h - 1, w), ...c.vline(x, y + 1, h - 2), ...c.vline(x + w - 1, y + 1, h - 2)], c.kind.noGreen ? "철망 울타리" : "생울타리");
  if (h >= 5) for (let tx = x + 1; tx + 2 < x + w - 1; tx += 4) c.stPut(streetTagged("gardentree"), tx, y + h - 2);
}

/** 가게 앞: 발 아래 줄에 내놓은 물건(낮은 것 · 정면에 겹쳐 서는 진열대), 연석 줄에 낮은 가로 시설, 건물 사이 틈에 깃발·실외기. */
function dressShopFront(c: SceneCtx, row: readonly ScenePlaced[], f: RowFront, sx: number, ex: number): void {
  const { kind } = c;
  const has = (s: string) => kind.scenes.includes(s);
  const base = f.paved ? [Occ.Lot] : [Occ.Road];
  const low = sceneList("spill", "low"), over = sceneList("spill", "over");
  const covers = has("shotengai") ? sceneList("shotengai", "cover") : [];
  // 길모퉁이(세로 길에 닿는 줄 끝): 자판기 한 쌍
  if (f.nK !== undefined && has("kado")) for (const x of c.rng() < 0.5 ? [ex - 4, sx] : [sx, ex - 4]) if (c.rng() < 0.75 && c.putAny(sceneList("kado", "pair"), x, f.nK)) { c.scenesUsed.add("kado"); break; }
  for (const p of row) {
    if (!p.kit || p.kit.cat === "flavor") continue;
    const x0 = p.x + p.kit.ml, x1 = p.x + p.w - p.kit.mr;
    const doorAt = (x: number, w: number) => p.doors.some((d) => p.x + d >= x - 0 && p.x + d < x + w);
    if (f.paved && covers.length && p.w >= 8 && p.kit.cat === "shop" && c.rng() < 0.5) {            // 상점가 가설 진열대(6×2)
      for (let x = x0; x + 6 <= x1; x++) if (!doorAt(x, 6) && c.putAny(covers, x, f.nA, { layer4: true, base, over: [Occ.Bldg] })) { c.scenesUsed.add("shotengai"); break; }
    }
    if (p.kit.cat === "house" || p.kit.cat === "apartment") {                                       // 집 앞: 화분·자전거만
      for (let x = x0; x < x1; x += 2) if (!doorAt(x, 4) && c.rng() < 0.35) c.putAny(["jp-pots", "jp-kadan", "jp-asagao", "jp-prop-planter"].filter((q) => x + c.size(q)![0] <= x1), x, f.nA, { base });
      continue;
    }
    for (let x = x0; x < x1; x++) {
      if (c.rng() >= kind.density.spill * 0.55) continue;
      const tall = c.rng() < 0.5;
      const id = tall ? c.putAny(over.filter((q) => !doorAt(x, c.size(q)![0]) && x + c.size(q)![0] <= x1), x, f.nA, { layer4: true, base, over: [Occ.Bldg] }) : c.putAny(low.filter((q) => !doorAt(x, c.size(q)![0]) && x + c.size(q)![0] <= x1), x, f.nA, { base });
      if (id) { c.scenesUsed.add("spill"); x += c.size(id)![0]; }
    }
  }
  // 건물 사이 틈(처마 칸): 깃발·실외기·가스통·고양이 — 4층 덧그림
  const slit = [...(has("signs") ? sceneList("signs", "slit") : []), ...sceneList("backalley", "slit")];
  for (const p of row) for (const x of [p.x, p.x + p.w - 1]) {
    if (c.at(x, p.foot) !== Occ.Slit || c.rng() < 0.3) continue;
    const id = c.putAny(slit, x, p.foot, { layer4: true, base: [Occ.Slit], over: [Occ.Slit] });
    if (id) c.scenesUsed.add(sceneList("signs", "slit").includes(id) ? "signs" : "backalley");
  }
  // 골목 틈(빈 대지 한두 칸)과 줄 끝 자투리: 돌출 간판 · 사당 · 자판기 · 자전거
  const gapPool = [...(has("signs") ? ["jp-prop-blade-sign-0", "jp-prop-blade-sign-1", "jp-prop-blade-sign-2", "jp-prop-blade-sign-3"] : []), ...(has("hokora") ? sceneList("hokora", "nook") : []), ...(has("neon") ? sceneList("neon", "tall") : []), "jp-prop-vending-aka", "jp-prop-vending-sora", "jp-prop-vending-midori", "jp-prop-bike-cluster", "jp-gomi-box", "jp-prop-pot"];
  const foot = row[0]?.foot;
  if (foot !== undefined) for (let x = sx; x < ex; x++) {
    if (c.at(x, foot) !== Occ.Lot) continue;
    let w = 1; while (x + w < ex && c.at(x + w, foot) === Occ.Lot) w++;
    const id = c.putAny(gapPool.filter((q) => c.size(q)![0] <= w), x, foot, { over: [Occ.Lot, Occ.Slit] });
    if (id) { if (sceneList("hokora", "nook").includes(id)) c.scenesUsed.add("hokora"); if (sceneList("neon", "tall").includes(id)) c.scenesUsed.add("neon"); }
    x += w;
  }
  // 연석 줄: 낮은 가로 시설
  if (f.nK !== undefined) {
    const kerb = ["jp-prop-bench", "jp-prop-bike-rack", "jp-prop-garbage-net", "jp-prop-bollard", "jp-prop-planter", "jp-prop-post-box", "jp-postbox-red", "jp-prop-vending-aka", "jp-prop-vending-sora", "jp-prop-vending-midori", "jp-prop-bike-sora", "jp-prop-bike-aka", "jp-prop-bike-midori", "jp-prop-cone", "jp-pots", "jp-prop-a-frame"];
    for (let x = sx + 1 + Math.floor(c.rng() * 3); x < ex - 1; ) {
      const id = c.rng() < kind.density.kerb + 0.35 ? c.putAny(kerb, x, f.nK, { gap: true }) : undefined;
      x += (id ? c.size(id)![0] : 1) + 2 + Math.floor(c.rng() * 4);
    }
  }
}

/** 집 필지 앞줄의 담 키트(건물 일꾼 그림): 담 종류마다 어울리는 대문과 옆 담(세로 줄 가족). */
const KAKI = [
  { wall: "jp-bldg-f-kaki-block", roofed: false },
  { wall: "jp-bldg-f-kaki-plaster", roofed: true },
  { wall: "jp-bldg-f-kaki-wood", roofed: true },
] as const;
const KAKI_GATE_ROOFED = "jp-bldg-f-kaki-gate-roofed", KAKI_GATE_MODERN = "jp-bldg-f-kaki-gate-modern";

/** 집 줄: 길에서 depth 줄 물려 세우고, 길 선에 담(블록담·생울타리)과 대문 기둥, 마당에 살림, 옆에 카포트와 차. */
function houseRow(c: SceneCtx, sx: number, ex: number, foot: number, top: number, wanted: string[]): ScenePlaced[] {
  const { tone, kind } = c;
  const maxH = foot - top + 1;
  const depths = maxH >= 11 ? [3, 2] : maxH >= 8 ? [2, 1] : [1, 0];
  const row: ScenePlaced[] = [];
  const yard = sceneList("jutaku", "yard"), wallSide = sceneList("jutaku", "wall");
  // 집이 다 떨어지면 동네 가게·공공 건물이 섞인다(같은 집을 되풀이하기 전에)
  const others = Object.keys(kind.mix).filter((k) => k !== "flavor" && k !== "shut");
  // 새 집(jp-bldg-f-*)의 필지: 집 양옆에 마당을 두고, 길 선에는 건물 일꾼의 담 키트(2×2 되풀이)와 대문 키트(가운데 열이 지나가는 칸)를 세운다 — 담 종류는 필지마다 바뀐다.
  const kakiOk0 = c.fable && KAKI.every((k) => SCENE_SIZES[k.wall]) && !!SCENE_SIZES[KAKI_GATE_ROOFED] && !!SCENE_SIZES[KAKI_GATE_MODERN];
  // 줄마다 한 방식: 7칸 키 집이 두 줄 물려 설 수 있는 띠에서만 담 키트를 쓴다(아니면 줄 전체가 한 줄 담).
  const kakiRow = kakiOk0 && maxH - 2 >= 7;
  const fDepths = [3, 2].filter((d) => maxH - d >= 7);
  let lastKaki: { wall: string; lotNo: number } | undefined;
  const sideMat = kind.noGreen ? "판자담" : "생울타리";
  // 새 거리의 주택가: 줄 머리(블록 끝)에 의원·학원·목욕탕 가운데 하나가 설 수 있다(줄에 하나까지, 가게처럼 앞이 포장).
  if (c.fable && !wanted.some((r) => MEDIUM_RESIDENTIAL.includes(r)) && ex - sx >= 16 && c.rng() < 0.4) {
    const role = MEDIUM_RESIDENTIAL.map((r) => ({ r, k: c.rng() })).sort((a, b) => a.k - b.k).map((q) => q.r).find((r) => c.buildingPool.some((b) => b.role === r && !c.placed.some((p) => p.kit?.id === b.id)) && !(BATHS.includes(r) && c.placed.some((p) => BATHS.includes(p.kit?.role ?? ""))));   // 목욕탕은 지도에 하나
    if (role) wanted.unshift(role);
  }
  let x = sx, prevH = 0, lot = Math.floor(c.rng() * 3);
  for (let guard = 0; guard < 30 && ex - x >= 5; guard++, lot++) {
    const role = wanted[0] === "house" || wanted[0] === "machiya" || wanted[0] === "apartment" || MEDIUM_RESIDENTIAL.includes(wanted[0] ?? "") ? wanted.shift() : undefined;
    // 물림 깊이는 집마다: 키 큰 집은 길 쪽으로 나오고 낮은 집은 마당이 깊다(담 선은 한 줄, 집 선은 들쭉날쭉).
    let kit: ReturnType<SceneCtx["nextKit"]>, depth = depths[0]!, carport = false, side = 0;
    const ds = kakiRow ? fDepths : depths;
    // 동네 중형 건물(의원·학원·목욕탕)은 가게처럼 길 가까이 선다 — 키 큰 것(큰 목욕탕 10줄)도 띠 깊이가 되면 선다.
    let pre: { kit: NonNullable<ReturnType<SceneCtx["nextKit"]>>; d: number } | undefined;
    if (c.fable && role && MEDIUM_RESIDENTIAL.includes(role)) for (const d of [2, 1, 0]) { const k = c.nextKit([], { x, foot: foot - d }, ex - x, maxH - d, { role }); if (k) { pre = { kit: k, d }; break; } }
    for (const d of ds) {
      if (pre) { kit = pre.kit; depth = pre.d; carport = false; side = 0; break; }
      const yards = kakiRow ? 5 : 0;                               // 양옆 마당 + 이웃과의 옆 울타리 한 칸(짝수 맞춤까지 넉넉히)
      carport = !yards && d >= 3 && ex - x >= 13 && !!c.size("jp-carport") && c.rng() < 0.35; side = carport ? 5 : 0; depth = d;
      const at = { x, foot: foot - d };
      kit = (role ? c.nextKit([], at, ex - x - side - yards, maxH - d, { role }) : undefined)
        ?? c.nextKit(c.rng() < 0.22 ? ["apartment", "house"] : ["house", "apartment"], at, ex - x - side - yards, maxH - d, { notH: prevH, fresh: true })
        ?? (d === ds[ds.length - 1] ? c.nextKit(kakiRow ? others.filter((k) => k !== "house" && k !== "apartment") : ["house", "apartment", ...others], at, ex - x - side, maxH - d, { notH: prevH }) : undefined);   // 담 키트 줄의 집은 옆 마당 자리가 있을 때만 선다
      if (kit) break;
    }
    if (!kit) break;
    const hf = foot - depth;
    const left = carport && c.rng() < 0.5;
    const kakiLot0 = kakiRow && kit.id.startsWith("jp-bldg-f-") && (kit.cat === "house" || kit.cat === "apartment") && x + kit.w + 5 <= ex;
    // 차고가 현관 바로 옆인 집: 대문 키트(세 칸)가 차고 입을 가린다 — 길 선을 담 없이 열고 앞마당을 통째로 포장한다(옆 울타리는 그대로).
    const openFront = kakiLot0 && !!kit.bay && (kit.doors[0] ?? 0) - 1 < kit.bay[0] + kit.bay[1] && (kit.doors[0] ?? 0) + 1 >= kit.bay[0];
    const kakiLot = kakiLot0 && !openFront;
    // 담 키트는 두 칸 폭이다 — 대문(세 칸, 문 앞) 왼쪽과 오른쪽 담 길이가 짝수가 되게 옆 마당 폭(1~2칸)을 고른다. 필지 오른쪽 끝 한 칸은 이웃과의 옆 울타리(길 선에서 뒤 담까지 한 가지).
    const d0 = kit.doors[0] ?? Math.floor(kit.w / 2);
    const sideL = kakiLot ? ((d0 + 1) % 2 === 0 ? 2 : 1) : openFront ? 1 : 0, sideR = kakiLot ? ((kit.w - d0) % 2 === 0 ? 2 : 1) : openFront ? 1 : 0;
    // 카포트 필지: 집 오른쪽에 세 칸 폭 진입로(길까지 포장, 담이 트인다)와 카포트 — 차고 달린 집에는 두지 않는다.
    const drive = kakiLot && !kit.bay && depth >= 3 && x + kit.w + sideL + sideR + 4 <= ex && c.rng() < 0.3 ? 3 : 0;
    const hx = x + (left ? side : 0) + sideL, lw = kit.w + side + sideL + sideR + drive;
    const shopLike = kit.cat !== "house" && kit.cat !== "apartment";
    // 필지 바닥: 집은 포장 위에 서지 않는다 — 필지 통째로(집 뒤까지) 마당 흙·잔디·자갈, 길 선과 옆은 담·생울타리.
    const gx = x + lw;                                                     // 이웃 필지와의 사이 한 칸(옆 담)
    // 마당 한 가지: 잔디 + 디딤돌 길 / 다진 흙 + 소나무·석등 한 무리 / 포장 앞마당 + 화분 — 필지 통째로 한 바닥이다.
    const idea = kind.noGreen ? (["earth", "paved"] as const)[lot % 2]! : (["lawn", "earth", "paved"] as const)[lot % 3]!;
    if (!shopLike) c.fill(x, top, Math.min(ex, gx + 1) - x, foot - top + 1, kakiLot ? (idea === "lawn" ? tone.green : "산길 흙") : yardGround(kind, tone, lot));
    if (!shopLike && kakiLot && idea === "paved") c.fillFamily(x, top, gx - x, foot - top + 1, "forecourt");
    const p = c.placeKit(kit, hx, hf);
    row.push(p); prevH = kit.h; lastKaki = undefined;
    if (shopLike) { if (depth >= 1) { c.fill(x, hf + 1, lw, depth, tone.sidewalk); c.mark(x, hf + 1, lw, depth, Occ.Walk, [Occ.Lot]); } }   // 동네 가게 앞은 담 없이 포장
    else if (openFront) {
      c.fillFamily(x, top, gx - x, foot - top + 1, "earth");
      c.fillFamily(x, hf + 1, gx - x, depth, "forecourt");
      c.mark(x, hf + 1, gx - x, depth, Occ.Walk, [Occ.Lot]);
      c.gates.push({ x: hx + d0, y: foot });
      if (gx < ex) { c.edge(c.vline(gx, top + 1, foot - 2 - top), sideMat); c.cornerCell(gx, foot - 1, sideMat); c.cornerCell(gx, foot, sideMat); }
      if (depth >= 2) for (const xx of [hx + kit.w, hx - 1]) if (c.stPut(streetTagged("housefront").filter((n) => n.startsWith("pot") || n.startsWith("planter")), xx, hf + 1, { lax: true })) break;
    }
    else if (kakiLot) {
      const style = KAKI[lot % KAKI.length]!, doorX = hx + d0, lotNo = c.placed.length - 1;
      lastKaki = { wall: style.wall, lotNo };
      c.gates.push({ x: doorX, y: foot });
      for (const d of kit.doors) c.mark(hx + d, hf + 1, 1, d === d0 ? depth : 1, Occ.Walk, [Occ.Lot]);
      // 현관에서 대문까지: 잔디·흙 마당은 디딤돌, 포장 앞마당은 그대로 길이다
      if (idea !== "paved") for (let y = hf + 1; y < foot - 1; y++) c.stPut(["stepstone-a", "stepstone-b"], doorX, y, { lax: true });
      c.stampKaki(depth >= 3 && style.roofed ? KAKI_GATE_ROOFED : KAKI_GATE_MODERN, doorX - 1, foot, lotNo, { x: doorX, y: hf });
      // 차가 드나드는 입(차고): 그 앞은 담을 세우지 않고 길까지 포장한다
      const bay = kit.bay ? [hx + kit.bay[0], hx + kit.bay[0] + kit.bay[1]] as const : undefined;
      const open = (wx: number) => !!bay && wx + 2 > bay[0] && wx < bay[1];
      if (bay) { c.fillFamily(bay[0], hf + 1, bay[1] - bay[0], depth, "forecourt"); c.mark(bay[0], hf + 1, bay[1] - bay[0], depth, Occ.Walk, [Occ.Lot]); }
      for (let wx = doorX - 3; wx >= x; wx -= 2) if (!open(wx)) c.stampKaki(style.wall, wx, foot, lotNo);
      const wallEnd = gx - drive;
      for (let wx = doorX + 2; wx + 2 <= wallEnd; wx += 2) if (!open(wx)) c.stampKaki(style.wall, wx, foot, lotNo);
      if (drive) {
        c.fillFamily(wallEnd, hf - 2, drive, foot - hf + 3, "forecourt");
        c.mark(wallEnd, foot - 1, drive, 2, Occ.Walk, [Occ.Lot]);
        c.stPut(["carport"], wallEnd, foot - 2);
      }
      // 이웃 필지와의 옆 울타리: 길 선에서 뒤 담까지 한 가지(산울타리 — 초록을 안 쓰는 종류는 판자 담). 길 선의 두 칸은 길가 소품의 윗칸이 겹쳐도 선다.
      if (gx < ex) { c.edge(c.vline(gx, top + 1, foot - 2 - top), sideMat); c.cornerCell(gx, foot - 1, sideMat); c.cornerCell(gx, foot, sideMat); }
      // 마당 한 무리: 집 앞 줄에 붙여 놓는다(현관 길 곁) — 흙 마당은 소나무·정원 돌·석등, 잔디는 철쭉·수국, 포장은 화분
      const fy = hf + 1, clear = (xx: number) => xx !== doorX && !(bay && xx >= bay[0] && xx < bay[1]) && xx >= hx && xx < hx + kit.w;
      if (depth >= 3) {
        if (idea === "earth") {
          for (const xx of [doorX + 1, doorX - 1]) if (clear(xx) && c.stPut(["lantern-stone", "basin"], xx, fy)) break;
          for (const xx of [doorX - 3, doorX + 2, hx]) if (clear(xx) && clear(xx + 1) && c.stPut(["pine"], xx, fy)) { for (const rx of [xx + 2, xx - 2]) if (clear(rx) && clear(rx + 1) && c.stPut(["rocks"], rx, fy)) break; break; }
        } else if (idea === "lawn") {
          for (const xx of [doorX - 1, doorX + 1, doorX - 2, doorX + 2]) if (clear(xx)) c.stPut(["azalea", "hydrangea"], xx, fy);
        } else for (let xx = hx; xx < hx + kit.w; xx += 2) if (clear(xx)) c.stPut(streetTagged("housefront").filter((n) => n.startsWith("pot") || n.startsWith("planter")), xx, fy, { lax: true });
      }
    }
    else if (depth >= 1) {
      const open = new Set<number>();
      for (const d of kit.doors.slice(0, 1)) c.gates.push({ x: hx + d, y: foot });   // 새 거리: 대문은 길이 들어가는 자리 하나
      for (const d of kit.doors) { open.add(hx + d); c.mark(hx + d, hf + 1, 1, depth + 1, Occ.Walk, [Occ.Lot]); if (depth >= 2) c.fill(hx + d, hf + 1, 1, depth - 1, tone.plaza); }   // 대문에서 현관까지 디딤돌
      const carX = left ? x : hx + kit.w;
      if (carport) {
        for (let k = 0; k < 5; k++) open.add(carX + k);
        c.fill(carX, hf + 1, 5, depth, "거리 · 주차장");
        const car = c.least(CARS);
        if (car && c.put(car, carX, foot - 3, { baseRows: 3 })) c.put("jp-carport", carX + (left ? 1 : 0), foot - 3, { layer4: true, stack: true, baseRows: 3, base: [Occ.Prop, Occ.Lot], over: [Occ.Prop, Occ.Lot] });
        c.scenesUsed.add("jutaku");
      }
      // 대문 기둥(문 양옆) → 길 선 담 + 옆 필지와의 담. 기둥이 먼저 서고 담은 남은 칸에 한 덩이로 이어진다.
      for (const d of kit.doors.slice(0, 2)) for (const px of [hx + d - 1, hx + d + 1]) if (!open.has(px) && px >= x && px < x + lw) c.put("jp-gatepost", px, foot);
      const material = c.fable ? (kind.noGreen ? ["블록담", "판자담"][lot % 2]! : ["블록담", "생울타리", "판자담"][lot % 3]!) : kind.noGreen ? "블록담" : ["블록담", "생울타리", "블록담"][lot % 3]!;
      const sideWall = gx < ex ? [...c.vline(gx, Math.max(top + 1, hf - 2), foot - Math.max(top + 1, hf - 2)), { x: gx, y: foot }] : [];
      c.edge([...c.hline(x, foot, lw).filter((q) => !open.has(q.x)), ...sideWall], material);
      if (depth >= 2 && kit.doors.length === 1 && c.rng() < 0.5) c.put("jp-prop-gate-iron-open", hx + kit.doors[0]!, foot - 1, { baseRows: 2, base: [Occ.Walk], over: [Occ.Walk] });
      // 마당 살림: 담 안쪽 줄에 화분·화단·빨래·자전거
      if (depth >= 2) for (let xx = x + (left ? side : 0); xx < hx + kit.w; ) {
        const id = c.rng() < 0.85 ? c.putAny(yard.filter((q) => xx + c.size(q)![0] <= hx + kit.w), xx, foot - 1, { gap: true }) : undefined;
        if (id) c.scenesUsed.add("jutaku");
        xx += (id ? c.size(id)![0] : 1) + 1 + Math.floor(c.rng() * 2);
      }
    }
    // 집 옆 처마 틈: 실외기·가스통
    for (const sx2 of [hx, hx + kit.w - 1]) if (c.at(sx2, hf) === Occ.Slit && c.rng() < 0.6 && c.putAny(wallSide, sx2, hf, { layer4: true, base: [Occ.Slit], over: [Occ.Slit] })) c.scenesUsed.add("jutaku");
    x = gx + (shopLike ? 0 : 1);
  }
  // 담 키트 줄이 줄 폭보다 한 칸 안쪽에서 끝나고 그 너머가 마당이면(지도 끝 열 따위) 그 한 칸을 모서리 담으로 닫는다.
  if (kakiRow) for (const [cx, inner] of [[sx - 1, sx], [ex, ex - 1]] as const) if (c.kaki.some((k) => k.y + k.h - 1 === foot && inner >= k.x && inner < k.x + k.w) && c.at(cx, foot) === Occ.Lot) c.cornerCell(cx, foot, sideMat);
  // 새 거리: 집 줄의 양 끝도 담으로 닫는다(필지는 닫힌 고리 — 앞줄·옆줄·띠 뒤 담).
  if (c.fable && row.length) for (const wx of [sx, ex - 1]) c.edge(c.vline(wx, top + 1, foot - top), kakiRow ? sideMat : kind.noGreen ? "블록담" : "생울타리");
  // 담 키트 줄의 뒤: 띠 맨 윗줄에 블록 담 한 줄 — 옆 울타리가 길 선에서 여기까지 닿는다.
  if (kakiRow && row.length) {
    // 세로 울타리의 윗칸 예약(갓돌 칸)을 푼다 — 뒤 담이 그 칸까지 이어져야 울타리 끝이 담에 닿는다.
    for (let wx = sx; wx < ex; wx++) if (c.at(wx, top) === Occ.Lot && c.at(wx, top + 1) === Occ.Wall) c.drawn[top * c.W + wx] = 0;
    if (top > 0) c.edge(c.hline(sx, top, ex - sx), "블록담");
  }
  // 줄 끝 자투리: 담 두른 텃밭·빈 마당(포장이 드러나지 않게) — 안은 빈터 쓰임이 채운다.
  if (lastKaki && ex - x >= 1) {
    // 담 키트 줄의 자투리는 마지막 집의 옆 마당이다 — 같은 담이 줄 끝까지 이어진다(홀수로 남는 맨 끝 한 칸은 줄 끝 세로 담이 닫는다).
    c.fill(x, top, ex - x, foot - top + 1, yardGround(kind, tone, lot - 1));
    let te = x;                                                            // 줄 끝에 먼저 선 담이 있으면 거기까지
    while (te < ex && (c.at(te, foot) === Occ.Lot || c.at(te, foot) === Occ.Walk)) te++;
    // 두 칸 담이 못 서는 칸(홀수로 남은 끝 칸, 먼저 선 세로 담의 발치)은 모서리 담 한 칸으로 닫는다.
    for (let wx = x; wx < te; wx += 2) if (wx + 2 > te || !c.stampKaki(lastKaki.wall, wx, foot, lastKaki.lotNo)) for (const cx of [wx, wx + 1]) if (cx < te) c.cornerCell(cx, foot, sideMat);   // 모서리 한 칸: 줄 끝 세로 담이 여기서 앞줄과 만난다
  } else if (ex - x >= 2 && row.length) { c.fill(x, top, ex - x, foot - top + 1, yardGround(kind, tone, lot)); c.edge(c.hline(x, foot, ex - x), kind.noGreen ? "블록담" : "생울타리"); }
  return row;
}

/** 뒷골목에 가로 시설: 골목 남쪽 줄(앞줄 지붕 바로 위)에 자판기·자전거·쓰레기망·실외기, 가끔 가로등. */
function dressAlley(c: SceneCtx, sx: number, ex: number, y: number): void {
  const low = [...sceneList("doro", "back"), ...sceneList("backalley", "slit").filter((q) => c.size(q)![1] === 1)];
  for (let x = sx + 1 + Math.floor(c.rng() * 3); x < ex - 1; ) {
    const id = c.rng() < 0.75 ? (c.rng() < 0.2 ? (c.putFoot("jp-prop-lamp-post", x, y, { layer4: true, over: [Occ.Lot, Occ.Walk, Occ.Slit, Occ.Bldg] }) ? "jp-prop-lamp-post" : undefined) : c.putAny(low, x, y, { gap: true })) : undefined;
    x += (id ? c.size(id)![0] : 1) + 2 + Math.floor(c.rng() * 4);
  }
}

/** 띠가 키 크면(앞줄 위로 6줄 넘게 남으면) 뒷골목 2줄을 두고 뒷줄을 세운다. 돌려주는 값 = 앞줄이 쓸 맨 윗줄. */
export function rearTop(c: SceneCtx, b: SceneBlock, frontH: number): number {
  if (c.fable) return b.band.top;                                           // 새 거리: 뒷줄을 따로 세우지 않는다 — 띠 뒤는 backStrip 이 쓰임을 준다
  const maxH = b.band.foot - b.band.top + 1;
  const rear = !b.noRear && c.kind.cross !== "arcade" && maxH - frontH - 2 >= 4 && !(b.edgeW && b.edgeE);
  return rear ? b.band.foot - frontH + 1 : b.band.top;
}
export function fillRear(c: SceneCtx, b: SceneBlock, fTop: number, house: boolean): ScenePlaced[] {
  if (fTop <= b.band.top) return [];
  const { kind, tone } = c;
  const ay = fTop - 2, rFoot = ay - 1;
  c.fill(b.sx, ay, b.ex - b.sx, 2, tone.alley);
  c.mark(b.sx, ay, b.ex - b.sx, 1, Occ.Walk, [Occ.Lot]);
  const backHouse = house || c.rng() < 0.35;
  const back = backHouse ? houseRow(c, b.sx, b.ex, rFoot, b.band.top, []) : shopRow(c, b.sx, b.ex, rFoot, b.band.top, [], { ...kind.mix, food: (kind.mix.food ?? 1) + 3 }, b.band.index === 0);
  if (!backHouse) dressShopFront(c, back, { nA: ay, paved: true }, b.sx, b.ex);
  dressAlley(c, b.sx, b.ex, ay + 1);
  for (const p of back) { treeBehind(c, p, b.band.top); roofScene(c, p); }
  if (!backHouse) backYards(c, back, b.sx, b.ex, b.band.top + 1, !b.edgeW, !b.edgeE);
  return back;
}

/** 구획 하나를 건물 줄로 채운다 — 키 큰 띠는 뒷골목 2줄을 두고 뒷줄을 더 세운다. */
export function fillRows(c: SceneCtx, _L: SceneLayout, b: SceneBlock, wanted: string[]): void {
  const { kind } = c;
  const band = b.band, s = band.front;
  const house = b.use === "house";
  const fTop = rearTop(c, b, house ? 12 : 10);
  const paved = s.type !== "lane" && s.type !== "path";
  const front: RowFront = { nA: s.nA, ...(s.type === "kerb" ? { nK: s.nK! } : {}), paved };
  const shops = (sx: number, ex: number) => shopRow(c, sx, ex, band.foot, fTop, wanted, band.index === 0 && kind.mainMix ? kind.mainMix : kind.mix, band.index === 0 && fTop === band.top, band.index === 0 && !!kind.mainMix, band.front.type === "kerb");
  // 역사 정면: 역 앞 종류에서 세로 길이 이 띠의 앞길에 닿아 끝나는 자리(T 자)의 맞은편에, 문이 그 길의 축에 오게 — 지도에 하나까지. 앞에 빈 마당을 만들지 않는다(가게 줄이 양옆에 벽을 맞댄다).
  let eki: ScenePlaced | undefined, ekiX = 0;
  if (!house && c.fable && kind.id === "ekimae" && band.front.type === "kerb" && !c.placed.some((p) => p.kit?.role === "station-front")) {
    const kit = c.nextKit([], { x: b.sx, foot: band.foot }, b.ex - b.sx, band.foot - fTop + 1, { role: "station-front" });
    const v = kit && _L.vstreets.find((q) => q.from === band.index + 1 && q.x + Math.floor(q.w / 2) - (kit.doors[0] ?? 4) - 1 >= b.sx && q.x + Math.floor(q.w / 2) - (kit.doors[0] ?? 4) - 1 + kit.w <= b.ex);
    if (kit && v) {
      ekiX = v.x + Math.floor(v.w / 2) - (kit.doors[0] ?? 4) - 1;
      if (ekiX - b.sx < 4) ekiX = b.sx; else if (b.ex - ekiX - kit.w < 4) ekiX = b.ex - kit.w;
      eki = c.placeKit(kit, ekiX, band.foot);
    }
  }
  const row = house ? houseRow(c, b.sx, b.ex, band.foot, fTop, wanted) : eki ? [...shops(b.sx, ekiX), eki, ...shops(ekiX + eki.w, b.ex)] : shops(b.sx, b.ex);
  if (!house && s.type !== "river") dressShopFront(c, row, front, b.sx, b.ex);
  else if (!house) dressShopFront(c, row, { nA: s.nA, paved: false }, b.sx, b.ex);
  fillRear(c, b, fTop, house);
  for (const p of row) { if (!c.fable || house) treeBehind(c, p, fTop); roofScene(c, p); }
  if (!house && c.fable) backStrip(c, b, row, band.top + 1);
  else if (!house) backYards(c, row, b.sx, b.ex, fTop > band.top ? fTop : band.top + 1, !b.edgeW, !b.edgeE);
}
