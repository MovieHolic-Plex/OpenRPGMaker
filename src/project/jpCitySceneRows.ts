// project/jpCitySceneRows.ts
// 거리 장면의 건물 줄 — 가게 줄(벽을 맞대거나 1~3칸 골목 틈, 가게 앞에 물건을 내놓는다)과 집 줄(길에서 물려 세우고 담·대문·마당·카포트).
// 키가 큰 띠는 뒷골목을 사이에 두고 뒷줄을 한 줄 더 세운다. 건물은 SceneCtx.nextKit 이 골라 한 지도에 같은 그림이 두 번 서지 않는다.
import { randomBuildingArgs } from "@/project/jpCityStreetComposer";
import { Occ, type SceneBlock, type SceneCtx, type SceneLayout, type ScenePlaced } from "@/project/jpCitySceneCtx";
import { SCENE_ROOFS, SCENE_SIZES, sceneList, yardGround } from "@/project/jpCitySceneKinds";
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
function shopRow(c: SceneCtx, sx: number, ex: number, foot: number, top: number, wanted: string[], mix: Readonly<Record<string, number>>, big = false, mainRow = false): ScenePlaced[] {
  const maxH = foot - top + 1;
  const row: ScenePlaced[] = [];
  let cursor = sx, prev: ScenePlaced | undefined, share = false;
  // 새 거리의 중형 건물: 블록(줄)에 하나까지, 블록 끝(모퉁이)에만 선다. 편의점·슈퍼·은행·우체국은 가게 거리, 파출소는 큰길 줄의 모퉁이(교차로), 의원·학원은 집이 섞이는 동네.
  let endKit: ScenePlaced | undefined;
  if (c.fable && ex - sx >= 16 && c.rng() < 0.75) {
    const roles = [...MEDIUM_SHOP, ...(mainRow || big ? ["koban"] : []), ...(c.kind.houseShare >= 0.15 ? MEDIUM_HOME : [])].map((r) => ({ r, k: c.rng() })).sort((a, b) => a.k - b.k).map((q) => q.r);
    const left = c.rng() < 0.5;
    for (const role of roles) {
      const kit = c.nextKit([], { x: left ? sx : ex - 8, foot }, ex - sx - 9, maxH, { role });
      if (!kit) continue;
      const p = c.placeKit(kit, left ? sx : ex - kit.w, foot);
      if (left) { row.push(p); prev = p; cursor = sx + kit.w; } else { endKit = p; ex -= kit.w; }
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
  closeGap(c, cursor, ex, foot);
  if (endKit) row.push(endKit);
  return row;
}

/** 중형 건물의 종류(사전의 role): 가게 거리의 블록 끝에 서는 것 · 집이 섞이는 동네에 서는 것. */
const MEDIUM_SHOP = ["konbini", "market", "bank", "post"], MEDIUM_HOME = ["clinic", "juku"], MEDIUM_RESIDENTIAL = ["clinic", "juku", "sento"];

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
  { wall: "jp-bldg-f-kaki-block", roofed: false, side: "블록담" },
  { wall: "jp-bldg-f-kaki-plaster", roofed: true, side: "생울타리" },
  { wall: "jp-bldg-f-kaki-wood", roofed: true, side: "판자담" },
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
  // 새 거리의 주택가: 줄 머리(블록 끝)에 의원·학원·목욕탕 가운데 하나가 설 수 있다(줄에 하나까지, 가게처럼 앞이 포장).
  if (c.fable && !wanted.some((r) => MEDIUM_RESIDENTIAL.includes(r)) && ex - sx >= 16 && c.rng() < 0.4) {
    const role = MEDIUM_RESIDENTIAL.map((r) => ({ r, k: c.rng() })).sort((a, b) => a.k - b.k).map((q) => q.r).find((r) => c.buildingPool.some((b) => b.role === r && !c.placed.some((p) => p.kit?.id === b.id)));
    if (role) wanted.unshift(role);
  }
  let x = sx, prevH = 0, lot = Math.floor(c.rng() * 3);
  for (let guard = 0; guard < 30 && ex - x >= 5; guard++, lot++) {
    const role = wanted[0] === "house" || wanted[0] === "machiya" || wanted[0] === "apartment" || MEDIUM_RESIDENTIAL.includes(wanted[0] ?? "") ? wanted.shift() : undefined;
    // 물림 깊이는 집마다: 키 큰 집은 길 쪽으로 나오고 낮은 집은 마당이 깊다(담 선은 한 줄, 집 선은 들쭉날쭉).
    let kit: ReturnType<SceneCtx["nextKit"]>, depth = depths[0]!, carport = false, side = 0;
    const ds = kakiRow ? fDepths : depths;
    for (const d of ds) {
      const yards = kakiRow ? 5 : 0;                               // 양옆 마당 + 이웃과의 담 한 칸(짝수 맞춤까지 넉넉히)
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
    const kakiLot = kakiRow && kit.id.startsWith("jp-bldg-f-") && (kit.cat === "house" || kit.cat === "apartment") && x + kit.w + 5 <= ex;
    // 담 키트는 두 칸 폭이다 — 대문(세 칸, 문 앞) 왼쪽과 오른쪽 담 길이가 짝수가 되게 옆 마당 폭(1~2칸)을 고른다. 오른쪽 길이에는 이웃과의 사이 한 칸이 든다.
    const d0 = kit.doors[0] ?? Math.floor(kit.w / 2);
    const sideL = kakiLot ? ((d0 + 1) % 2 === 0 ? 2 : 1) : 0, sideR = kakiLot ? ((kit.w - d0 - 1) % 2 === 0 ? 2 : 1) : 0;
    const hx = x + (left ? side : 0) + sideL, lw = kit.w + side + sideL + sideR;
    const shopLike = kit.cat !== "house" && kit.cat !== "apartment";
    // 필지 바닥: 집은 포장 위에 서지 않는다 — 필지 통째로(집 뒤까지) 마당 흙·잔디·자갈, 길 선과 옆은 담·생울타리.
    const gx = x + lw;                                                     // 이웃 필지와의 사이 한 칸(옆 담)
    if (!shopLike) c.fill(x, top, Math.min(ex, gx + 1) - x, foot - top + 1, yardGround(kind, tone, lot));
    const p = c.placeKit(kit, hx, hf);
    row.push(p); prevH = kit.h; lastKaki = undefined;
    if (shopLike) { if (depth >= 1) { c.fill(x, hf + 1, lw, depth, tone.sidewalk); c.mark(x, hf + 1, lw, depth, Occ.Walk, [Occ.Lot]); } }   // 동네 가게 앞은 담 없이 포장
    else if (kakiLot) {
      const style = KAKI[lot % KAKI.length]!, doorX = hx + d0, lotNo = c.placed.length - 1;
      lastKaki = { wall: style.wall, lotNo };
      c.gates.push({ x: doorX, y: foot });
      for (const d of kit.doors) c.mark(hx + d, hf + 1, 1, d === d0 ? depth : 1, Occ.Walk, [Occ.Lot]);
      c.fill(doorX, hf + 1, 1, depth - 1, tone.plaza);                       // 현관에서 대문까지 디딤돌
      c.stampKaki(depth >= 3 && style.roofed ? KAKI_GATE_ROOFED : KAKI_GATE_MODERN, doorX - 1, foot, lotNo, { x: doorX, y: hf });
      for (let wx = doorX - 3; wx >= x; wx -= 2) c.stampKaki(style.wall, wx, foot, lotNo);
      for (let wx = doorX + 2; wx + 2 <= Math.min(ex, gx + 1); wx += 2) c.stampKaki(style.wall, wx, foot, lotNo);
      // 이웃 필지와의 옆 담: 앞 담의 뒤에서 시작해 집 옆으로 올라간다(세로 조각은 거리 쪽 줄 가족 — 같은 재료)
      const sideMat = style.side === "생울타리" && kind.noGreen ? "블록담" : style.side, y0 = Math.max(top + 1, hf - 2);
      if (gx < ex && foot - 1 - y0 > 0) c.edge(c.vline(gx, y0, foot - 1 - y0), sideMat);
      // 마당 살림: 담 안쪽 줄(담 갓 윗줄)에 화분·화단·빨래·자전거
      if (depth >= 3) for (let xx = x + 1; xx < gx; ) {
        const id = xx !== doorX && c.rng() < 0.7 ? c.putAny(yard.filter((q) => xx + c.size(q)![0] <= gx && !(xx <= doorX && xx + c.size(q)![0] > doorX)), xx, foot - 2, { gap: true }) : undefined;
        if (id) c.scenesUsed.add("jutaku");
        xx += (id ? c.size(id)![0] : 1) + 1 + Math.floor(c.rng() * 2);
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
  if (kakiRow) for (const [cx, inner] of [[sx - 1, sx], [ex, ex - 1]] as const) if (c.kaki.some((k) => k.y + k.h - 1 === foot && inner >= k.x && inner < k.x + k.w) && c.at(cx, foot) === Occ.Lot) c.cornerCell(cx, foot, kind.noGreen ? "블록담" : "생울타리");
  // 새 거리: 집 줄의 양 끝도 담으로 닫는다(필지는 닫힌 고리 — 앞줄·옆줄·띠 뒤 담).
  if (c.fable && row.length) for (const wx of [sx, ex - 1]) c.edge(c.vline(wx, top + 1, foot - top), kind.noGreen ? "블록담" : "생울타리");
  // 줄 끝 자투리: 담 두른 텃밭·빈 마당(포장이 드러나지 않게) — 안은 빈터 쓰임이 채운다.
  if (lastKaki && ex - x >= 1) {
    // 담 키트 줄의 자투리는 마지막 집의 옆 마당이다 — 같은 담이 줄 끝까지 이어진다(홀수로 남는 맨 끝 한 칸은 줄 끝 세로 담이 닫는다).
    c.fill(x, top, ex - x, foot - top + 1, yardGround(kind, tone, lot - 1));
    let te = x;                                                            // 줄 끝에 먼저 선 담이 있으면 거기까지
    while (te < ex && (c.at(te, foot) === Occ.Lot || c.at(te, foot) === Occ.Walk)) te++;
    // 두 칸 담이 못 서는 칸(홀수로 남은 끝 칸, 먼저 선 세로 담의 발치)은 모서리 담 한 칸으로 닫는다.
    for (let wx = x; wx < te; wx += 2) if (wx + 2 > te || !c.stampKaki(lastKaki.wall, wx, foot, lastKaki.lotNo)) for (const cx of [wx, wx + 1]) if (cx < te) c.cornerCell(cx, foot, kind.noGreen ? "블록담" : "생울타리");   // 모서리 한 칸: 줄 끝 세로 담이 여기서 앞줄과 만난다
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
  const row = house ? houseRow(c, b.sx, b.ex, band.foot, fTop, wanted) : shopRow(c, b.sx, b.ex, band.foot, fTop, wanted, band.index === 0 && kind.mainMix ? kind.mainMix : kind.mix, band.index === 0 && fTop === band.top, band.index === 0 && !!kind.mainMix);
  if (!house && s.type !== "river") dressShopFront(c, row, front, b.sx, b.ex);
  else if (!house) dressShopFront(c, row, { nA: s.nA, paved: false }, b.sx, b.ex);
  fillRear(c, b, fTop, house);
  for (const p of row) { treeBehind(c, p, fTop); roofScene(c, p); }
  if (!house) backYards(c, row, b.sx, b.ex, fTop > band.top ? fTop : band.top + 1, !b.edgeW, !b.edgeE);
}
