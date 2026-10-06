// jp_city 예제 맵 공용 틀 — 키트 찍기·생활도로 오토타일·노면 표시·전봇대 줄·검사·장소 게시. town.mjs·school.mjs 가 쓴다.
// tsx 아래에서만 돈다(엔진 TS 를 직접 import). 각 맵 스크립트가 맨 위에서 underTsx() 로 자기 자신을 tsx 로 다시 띄운다.
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import fs from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, "..", "..", "..", "..");
export const OUT = join(HERE, "out");

/** tsx 밖에서 불렸으면 tsx(+css 빈 모듈)로 같은 스크립트를 다시 띄우고 종료한다. */
export function underTsx(scriptUrl) {
  if (process.env.KITMAP_UNDER_TSX) return;
  const r = spawnSync("npx", ["--no-install", "tsx", "--import", "./tiledata/jp-city/refs/css-stub.mjs", fileURLToPath(scriptUrl), ...process.argv.slice(2)],
    { stdio: "inherit", cwd: ROOT, env: { ...process.env, KITMAP_UNDER_TSX: "1" } });
  process.exit(r.status ?? 1);
}

const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);

export const T = { SW: 707, GRAVEL: 725, LAWN: 841, PAVE_A: 839, PAVE_B: 840, PARK_FLOOR: 721, PARK_LINE: 722 };

export async function kitMap(W, H, { fill = T.SW } = {}) {
  const { autotileNeighborMask, autotileVariantForMask, autotileVariantForCell } = await imp("src/project/defaults/autotileEngine.ts");
  const { createJpCityTileset } = await imp("src/project/defaults/jpCity.ts");
  const { createEmptyToolProject } = await imp("src/editor/tools/emptyProject.ts");
  const { canMove, isPassable } = await imp("src/project/collision.ts");
  const TS = createJpCityTileset();
  const KIT = Object.fromEntries(TS.structureKits.map((k) => [k.id, k]));
  const GRP = Object.fromEntries(TS.autotileGroups.map((g) => [g.id, g]));
  const N = W * H;
  const L1 = new Array(N).fill(fill), L2 = new Array(N).fill(-1), L3 = new Array(N).fill(-1), L4 = new Array(N).fill(-1);
  const own3 = new Array(N).fill(""), own4 = new Array(N).fill(""), ground = new Array(N).fill("");
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const idx = (x, y) => y * W + x;
  const issues = [];
  const fail = (msg) => issues.push(msg);
  const single = (id) => KIT[id].rows[0].upperTiles[0];
  const doors = [], anchors = [], solidCells = [], placed = [];
  const laneSet = new Set();
  const reserved = new Set();
  const deco = { placed: 0, skipped: 0 };

  function stamp(id, x0, y0, { layer = 3, tag = id } = {}) {
    const k = KIT[id];
    if (!k) throw new Error("키트 없음 " + id);
    const own = layer === 4 ? own4 : layer === 2 ? null : own3, L = layer === 4 ? L4 : layer === 2 ? L2 : L3;
    for (let r = 0; r < k.height; r++) for (let c = 0; c < k.width; c++) {
      const x = x0 + c, y = y0 + r;
      if (!inb(x, y)) continue;
      const t = k.rows[r].tiles[c], u = k.rows[r].upperTiles[c];
      if (t >= 0) L1[idx(x, y)] = t;
      if (u < 0) continue;
      if (own && own[idx(x, y)]) fail(`겹침 ${tag} 가 ${own[idx(x, y)]} 위에 (${x},${y}) ${layer}층`);
      if (own) own[idx(x, y)] = tag;
      L[idx(x, y)] = u;
      if (layer !== 2 && TS.passability[u] && !TS.passability[u].up && !TS.passability[u].down && TS.tileMeta[u]?.passage !== "star") solidCells.push([x, y, tag]);
    }
    placed.push({ id, x: x0, y: y0, w: k.width, h: k.height, layer });
    for (const p of k.parts ?? []) if (p.kind === "entrance") {
      const a = (k.ai?.access ?? []).find((q) => q.dx === p.dx) ?? { dx: p.dx, dy: p.dy + 1 };
      doors.push({ b: tag, x: x0 + p.dx, y: y0 + p.dy, ax: x0 + a.dx, ay: y0 + a.dy });
      reserved.add(idx(x0 + a.dx, y0 + a.dy)); reserved.add(idx(x0 + a.dx, y0 + a.dy + 1));
    }
    for (const p of k.parts ?? []) if (p.kind === "anchor") {                  // 걸어 들어가는 입구(수영장·역 출입구) — 칸 자체가 걸음, 바로 아래 칸도 비운다
      for (let i = 0; i < (p.w ?? 1); i++) {
        anchors.push({ b: tag, x: x0 + p.dx + i, y: y0 + p.dy });
        reserved.add(idx(x0 + p.dx + i, y0 + p.dy)); reserved.add(idx(x0 + p.dx + i, y0 + p.dy + 1));
      }
    }
  }
  const put = (id, x, yFoot, opt = {}) => stamp(id, x, yFoot - KIT[id].height + 1, opt);
  const fillL1 = (x0, y0, x1, y1, t, tag) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) { L1[idx(x, y)] = typeof t === "function" ? t(x, y) : t; if (tag) ground[idx(x, y)] = tag; } };
  const checker = (x, y) => ((x + y) % 2 === 0 ? T.PAVE_A : T.PAVE_B);

  /** 빈 자리에만 — 문·접근칸·길·다른 3층 칸이 있으면 건너뛴다(센다). */
  function tryPut(id, x, yFoot, tag, { layer = 3, onLane = false } = {}) {
    const k = KIT[id], y0 = yFoot - k.height + 1, own = layer === 4 ? own4 : own3;
    for (let r = 0; r < k.height; r++) for (let c = 0; c < k.width; c++) {
      if (k.rows[r].upperTiles[c] < 0) continue;
      const xx = x + c, yy = y0 + r;
      if (!inb(xx, yy) || own[idx(xx, yy)] || own3[idx(xx, yy)] || reserved.has(idx(xx, yy)) || (!onLane && laneSet.has(idx(xx, yy)))) {
        deco.skipped++; if (process.env.TOWN_DEBUG) console.error("skip", tag, xx, yy, own3[idx(xx, yy)] || "?"); return false;
      }
    }
    stamp(id, x, y0, { layer, tag }); deco.placed++; return true;
  }

  // ── 생활도로(오토타일 jp-lane-road) — 사각을 더하고 마지막에 한 번 모양을 맞춘다
  const laneG = GRP["jp-lane-road"], railG = GRP["jp-rail-track"], fenceG = GRP["jp-fence-mesh"];
  const kitLaneIds = new Set(TS.tileMeta.map((m, i) => ((m.label ?? "").startsWith("생활도로") ? i : -1)).filter((i) => i >= 0));
  const laneConnect = new Set([...laneG.memberTileIds, ...kitLaneIds]);
  const addLane = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) laneSet.add(idx(x, y)); };
  const shapeGroup = (group, view, cellsList, connectSet) => {
    const nb = group.neighborhood ?? 4;
    const res = cellsList.map(([x, y]) => [x, y, autotileVariantForMask(group, autotileNeighborMask(view, x, y, (t) => connectSet.has(t), nb, true))]);
    for (const [x, y, v] of res) view.lowerTiles[idx(x, y)] = v;
  };
  function shapeLanes(skip = () => false) {
    const cells = [...laneSet].map((i) => [i % W, Math.floor(i / W)]).filter(([x, y]) => !skip(x, y));
    for (const [x, y] of cells) { L1[idx(x, y)] = laneG.variantMap["255"]; ground[idx(x, y)] = "lane"; }
    shapeGroup(laneG, { width: W, height: H, lowerTiles: L1 }, cells, laneConnect);
  }
  function railLine(y, x0 = 0, x1 = W - 1) {
    const cells = []; for (let x = x0; x <= x1; x++) { cells.push([x, y]); L1[idx(x, y)] = railG.variantMap["15"]; }
    shapeGroup(railG, { width: W, height: H, lowerTiles: L1 }, cells, new Set(railG.memberTileIds));
  }
  const fenceCellsAll = [];
  function fenceLine(cells, tag = "fence") {
    const ok = [];
    for (const [x, y] of cells) { if (!inb(x, y)) continue; if (L3[idx(x, y)] >= 0) { fail(`철망이 3층 칸 위에 (${x},${y}) ${own3[idx(x, y)]}`); continue; } L3[idx(x, y)] = fenceG.variantMap["15"]; own3[idx(x, y)] = tag; ok.push([x, y]); }
    fenceCellsAll.push(...ok);
    shapeGroup(fenceG, { width: W, height: H, lowerTiles: L3 }, fenceCellsAll, new Set(fenceG.memberTileIds));
  }
  /** 3층 선 오토타일(생울타리 jp-hedge·블록담 jp-wall-block·가드레일 …) — 칸 목록을 깔고 이웃 모양을 다시 맞춘다. */
  const lineCells = {};
  function groupLine(gid, cells, tag = gid) {
    const G = GRP[gid]; if (!G) throw new Error(`오토타일 그룹 없음 ${gid}`);
    const ok = [];
    for (const [x, y] of cells) { if (!inb(x, y)) continue; if (L3[idx(x, y)] >= 0) { fail(`${gid} 가 3층 칸 위에 (${x},${y}) ${own3[idx(x, y)]}`); continue; } L3[idx(x, y)] = G.variantMap["15"]; own3[idx(x, y)] = tag; ok.push([x, y]); }
    (lineCells[gid] ??= []).push(...ok);
    shapeGroup(G, { width: W, height: H, lowerTiles: L3 }, lineCells[gid], new Set(G.memberTileIds));
  }
  /** 2층(투명 덧그림) 오토타일 선 — 점자 블록(jp-tactile) 등. 1층 바닥 위·3층 소품 아래. */
  function groupLineL2(gid, cells) {
    const G = GRP[gid]; if (!G) throw new Error(`오토타일 그룹 없음 ${gid}`);
    const ok = cells.filter(([x, y]) => inb(x, y));
    for (const [x, y] of ok) L2[idx(x, y)] = G.variantMap["15"];
    shapeGroup(G, { width: W, height: H, lowerTiles: L2 }, ok, new Set(G.memberTileIds));
  }
  /** 생활도로 가장자리 側溝+흰 선(2층). ew=[[y0,y1]] 동서 길, ns=[[x0,x1]] 남북 길. 교차 칸은 비운다. */
  function edgeMarks({ ew = [], ns = [], nsY = [0, H - 1], skip = () => false }) {
    const nsCol = (x) => ns.some(([a, b]) => x >= a && x <= b);
    const ewRow = (y) => ew.some(([a, b]) => y >= a && y <= b);
    let g = 0;
    for (const [a, b] of ew) for (let x = 0; x < W; x++) {
      if (nsCol(x) || !laneSet.has(idx(x, a))) continue;
      const gr = (++g % 7 === 0) ? "-grate" : "";
      if (!skip(x, a)) L2[idx(x, a)] = single("jp-mark-edge-n" + gr);
      if (!skip(x, b)) L2[idx(x, b)] = single("jp-mark-edge-s" + gr);
    }
    for (const [a, b] of ns) for (let y = nsY[0]; y <= nsY[1]; y++) {
      if (ewRow(y) || !laneSet.has(idx(a, y)) || skip(a, y)) continue;
      L2[idx(a, y)] = single("jp-mark-edge-w"); L2[idx(b, y)] = single("jp-mark-edge-e");
    }
  }
  /** 2층 투명 덧그림 키트를 그대로(노면 표시 등). */
  function stampL2(id, x, y0) { const k = KIT[id]; for (let r = 0; r < k.height; r++) for (let c = 0; c < k.width; c++) { const t = k.rows[r].upperTiles[c]; if (t >= 0) L2[idx(x + c, y0 + r)] = t; } }
  function mark30(x, y0) { const k = KIT["jp-mark-30"]; for (let r = 0; r < k.height; r++) for (let c = 0; c < k.width; c++) { const t = k.rows[r].upperTiles[c]; if (t >= 0) L2[idx(x + c, y0 + r)] = t; } }

  // ── 전봇대 줄(4층): 기둥 열이 덮는 건물·기물 칸 + 간격 벌점 최소(동적 계획). 간격 = 전선 키트가 있는 5~20칸.
  const POLE = KIT["jp-pole"], SPANS = [...Array(16)].map((_, i) => i + 5).filter((L) => KIT["jp-wire-" + L]);
  const coverOf = (x, y) => (!inb(x, y) || !own3[idx(x, y)] || own3[idx(x, y)].startsWith("fence") ? 0 : own3[idx(x, y)].startsWith("jp-bldg") ? 1 : 0.6);
  const poleReport = [];
  function poleRow(fy, { x0 = 0, x1 = W - 1, forbid = () => false, prefer = 12 } = {}) {
    const top = fy - POLE.height + 1;
    const ok = (px) => {
      if (px < x0 || px + 2 > x1 || forbid(px + 1, fy) || own3[idx(px + 1, fy)]) return false;
      for (let r = 0; r < POLE.height; r++) for (let c = 0; c < 3; c++) if (POLE.rows[r].upperTiles[c] >= 0 && inb(px + c, top + r) && own4[idx(px + c, top + r)]) return false;
      return true;
    };
    const cost = (px) => { let v = 0; for (let y = top; y < fy; y++) { v += coverOf(px + 1, y); if (y < top + 3) v += 0.3 * (coverOf(px, y) + coverOf(px + 2, y)); } return v; };
    const best = new Map();
    for (let px = x0; px <= x0 + 5; px++) if (ok(px)) best.set(px, [cost(px), -1]);
    for (let px = x0 + 1; px <= x1 - 2; px++) {
      if (!ok(px)) continue;
      for (const L of SPANS) {
        const pv = best.get(px - L); if (!pv) continue;
        const k = KIT["jp-wire-" + L]; let free = true;
        for (let r = 0; r < k.height && free; r++) for (let c = 0; c < k.width; c++) if (k.rows[r].upperTiles[c] >= 0 && own4[idx(px - L + 3 + c, top + r)]) { free = false; break; }
        if (!free) continue;
        const v = pv[0] + cost(px) + 0.02 * (L - prefer) ** 2;
        if (!best.has(px) || v < best.get(px)[0]) best.set(px, [v, px - L]);
      }
    }
    let end = -1;
    for (let px = x1 - 2; px >= x1 - 8; px--) if (best.has(px) && (end < 0 || best.get(px)[0] < best.get(end)[0])) end = px;
    if (end < 0) { fail(`전봇대 줄 ${fy}: 놓을 자리 없음`); return; }
    const xs = []; for (let px = end; px >= 0; px = best.get(px)[1]) xs.push(px); xs.reverse();
    for (const px of xs) put("jp-pole", px, fy, { layer: 4, tag: `pole-${px}-${fy}` });
    for (let i = 0; i + 1 < xs.length; i++) stamp("jp-wire-" + (xs[i + 1] - xs[i]), xs[i] + 3, top, { layer: 4, tag: `wire-${xs[i]}-${fy}` });
    poleReport.push({ row: fy, xs, cover: +xs.reduce((v, px) => v + cost(px), 0).toFixed(1) });
  }

  // ── 검사·쓰기
  async function finish({ id, name, start, bare = [T.SW, T.PAVE_A, T.PAVE_B, T.GRAVEL, T.LAWN], extraLayersCheck = null, file, emptyIgnore = [], emptinessMax = null, events = [], transit = null }) {
    const project = createEmptyToolProject("jp-kitmap");
    project.tilesets.jp_city = TS;
    const MAP = { id, name, width: W, height: H, tilesetId: "jp_city", tileSize: 16, lowerTiles: L1, lowerOverlayTiles: L2, upperTiles: L3, upperOverlayTiles: L4, events, climate: { mode: "inherit" }, ...(transit ? { transit } : {}) };
    project.maps[MAP.id] = MAP;
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(join(OUT, `${file}.map.json`), JSON.stringify(MAP));
    const pass = (x, y) => isPassable(project, MAP, x, y);
    const reach = new Set([idx(...start)]);
    const q = [start];
    while (q.length) {
      const [x, y] = q.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny) || reach.has(idx(nx, ny)) || !canMove(project, MAP, x, y, nx, ny)) continue;
        reach.add(idx(nx, ny)); q.push([nx, ny]);
      }
    }
    const report = { map: { id, size: [W, H] }, start, poles: poleReport, deco };
    const doorRes = doors.map((d) => ({ ...d, doorBlocked: !pass(d.x, d.y), accessPassable: pass(d.ax, d.ay), accessReached: reach.has(idx(d.ax, d.ay)) }));
    report.doors = { n: doors.length, allReached: doorRes.every((d) => d.doorBlocked && d.accessPassable && d.accessReached), failing: doorRes.filter((d) => !(d.doorBlocked && d.accessPassable && d.accessReached)) };
    const anchorRes = anchors.map((a) => ({ ...a, passable: pass(a.x, a.y), reached: reach.has(idx(a.x, a.y)) }));
    report.anchors = { n: anchors.length, allReached: anchorRes.every((a) => a.passable && a.reached), failing: anchorRes.filter((a) => !(a.passable && a.reached)) };
    const body = solidCells.map(([x, y, tag]) => ({ x, y, tag, passable: pass(x, y) }));
    report.solid = { cells: body.length, openByEngine: body.filter((b) => b.passable).length, open: body.filter((b) => b.passable).slice(0, 8) };
    const maskAudit = (group, viewTiles, extra) => {
      const members = new Set(group.memberTileIds), connect = new Set([...(group.connectTileIds ?? group.memberTileIds), ...extra]);
      const view = { width: W, height: H, lowerTiles: viewTiles };
      let cells = 0, bad = 0; const ex = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const t = viewTiles[idx(x, y)]; if (!members.has(t)) continue; cells++;
        const v = autotileVariantForCell(view, { ...group, connectTileIds: [...connect], edgeConnects: true }, x, y);
        if (v !== t) { bad++; if (ex.length < 5) ex.push([x, y, t, v]); }
      }
      return { cells, mismatch: bad, ex };
    };
    report.autotiles = { lane: maskAudit(laneG, L1, [...kitLaneIds]), rail: maskAudit(railG, L1, []), fence: maskAudit(fenceG, L3, []), ...Object.fromEntries(Object.keys(lineCells).map((g) => [g, maskAudit(GRP[g], L3, [])])) };
    report.layers = { overlaps: issues.length, issues: issues.slice(0, 12), l2: L2.filter((t) => t >= 0).length, l3: L3.filter((t) => t >= 0).length, l4: L4.filter((t) => t >= 0).length };
    const BARE = new Set(bare);
    let worst = 0, worstAt = null, skippedWin = 0;
    // emptyIgnore: 목적상 비어 있어야 하는 사각(운동장 트랙 안 등) — 빈칸으로 세지 않는다. 사각은 보고에 그대로 적는다.
    const ignored = (x, y) => emptyIgnore.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
    // 4층(전선·전봇대 윗부분)은 땅을 채우지 않는다 — 공중에 걸린 것이라 빈칸 판정에서 보지 않는다(2026-10-07 관문 지적).
    const isBare = (x, y) => !ignored(x, y) && BARE.has(L1[idx(x, y)]) && L2[idx(x, y)] < 0 && L3[idx(x, y)] < 0;
    // 비율의 분모는 무시 칸을 뺀 칸 수다(무시 칸을 분모에 남기면 비율이 낮게 나온다 — 2026-10-07 관문 지적). 남은 칸이 창의 절반 미만이면 그 창은 재지 않는다.
    for (let y0 = 0; y0 + 13 <= H; y0++) for (let x0 = 0; x0 + 17 <= W; x0++) {
      let c = 0, n = 0;
      for (let y = y0; y < y0 + 13; y++) for (let x = x0; x < x0 + 17; x++) { if (ignored(x, y)) continue; n++; if (isBare(x, y)) c++; }
      if (n < 111) { skippedWin++; continue; }
      if (c / n > worst) { worst = c / n; worstAt = [x0, y0]; }
    }
    report.emptiness = { worst17x13: +worst.toFixed(3), worstAt, ignore: emptyIgnore, max: emptinessMax, skippedWindows: skippedWin };
    report.reach = { reachable: reach.size };
    report.placed = placed.length;
    if (extraLayersCheck) report.extra = extraLayersCheck({ project, MAP, pass, reach, idx });
    report.ok = issues.length === 0 && report.doors.allReached && report.anchors.allReached && (emptinessMax == null || report.emptiness.worst17x13 <= emptinessMax) && report.solid.openByEngine === 0 && Object.values(report.autotiles).every((a) => a.mismatch === 0) && (!report.extra || report.extra.ok !== false);
    fs.writeFileSync(join(OUT, `${file}.report.json`), JSON.stringify({ ...report, placedList: placed, doorList: doorRes, anchorList: anchorRes }, null, 1));
    return { report, MAP };
  }

  /** 지역 참고본(.oprn.json·PNG·스냅샷)과 jpCityPlaceReferences.ts 항목을 쓴다. 그림은 render.py 결과(verify-shots/jp-city/<file>-1x.png)를 쓴다. */
  function publish({ MAP, report, placeId, name, file, rules, limitations, placeKind = "settlement", start }) {
    if (!report.ok) { console.error("검사 실패 — 지역 참고본을 쓰지 않았다"); process.exit(2); }
    const gate = spawnSync("python3", ["scripts/content/jp-city/gate/adversarial_gate.py", "check", "--stage", file], { cwd: ROOT, encoding: "utf8" });
    process.stdout.write(gate.stdout);
    if (gate.status !== 0 && !process.env.SKIP_GATE) { console.error(`적대적 검증 관문 ${file} 미통과 — 게시하지 않았다(--stage ${file} 로 run 먼저)`); process.exit(3); }
    const REGION_DIR = join(ROOT, "public/assets/region-references");
    const tpl = JSON.parse(fs.readFileSync(join(REGION_DIR, "interior-inn-tavern-1f.oprn.json"), "utf8"));
    const mapOut = { ...MAP, name };
    const proj = structuredClone(tpl);
    proj.meta.title = name;
    proj.tilesets = { jp_city: { ...structuredClone(TS), referenceDocuments: structuredClone(TS.referenceDocuments ?? []) } };
    proj.maps = { [MAP.id]: mapOut };
    proj.mapTree = { mapId: MAP.id, children: [] };
    proj.startMapId = MAP.id; proj.startPos = { x: start[0], y: start[1] };
    proj.mapConnections = [];
    fs.writeFileSync(join(REGION_DIR, `jp-city-${file}.oprn.json`), JSON.stringify(proj));
    fs.copyFileSync(join(ROOT, `verify-shots/jp-city/${file}-1x.png`), join(REGION_DIR, `jp-city-${file}.png`));
    const slim = { id: TS.id, image: TS.image, tileSize: TS.tileSize, tilesPerRow: TS.tilesPerRow, count: TS.count, passability: TS.passability, priority: TS.priority, terrain: TS.terrain };
    fs.writeFileSync(join(ROOT, `src/project/regionReferences/jp-city-${file}.json`), JSON.stringify({ map: mapOut, tileset: slim }));
    const entry = {
      id: placeId, name, kind: "completed-place", placeKind, revision: 1, x: 0, y: 0, width: W, height: H, tilesetId: "jp_city",
      preview: `/assets/region-references/jp-city-${file}.png`, tilesetPreview: "/assets/jp-city/jp-city-chipset.png",
      projectDownload: `/assets/region-references/jp-city-${file}.oprn.json`,
      sourceProjectId: `oprn-bundled-jp-city-${file}`, sourceMapId: MAP.id, snapshotProjectId: `oprn-place-jp-city-${file}-v1`, rules, limitations,
    };
    const tsPath = join(ROOT, "src/project/jpCityPlaceReferences.ts");
    const src = fs.readFileSync(tsPath, "utf8");
    const m = src.match(/export const JP_CITY_PLACE_REFERENCES = (\[[\s\S]*\]) as const;/);
    const arr = JSON.parse(m[1]).filter((e) => e.id !== placeId);
    arr.push(entry);
    fs.writeFileSync(tsPath, "// Generated by scripts/content/jp-city/maps/*.mjs --publish. 일본 도시(jp_city) 예제 under 장소; snapshots in regionReferences/jp-city-*.json.\nexport const JP_CITY_PLACE_REFERENCES = " + JSON.stringify(arr, null, 2) + " as const;\n");
    const snapPath = join(ROOT, "src/project/regionReferenceSnapshots.ts");
    const snap = fs.readFileSync(snapPath, "utf8");
    if (!snap.includes(`"${placeId}"`)) {
      const anchor = `  "jp-city-shopstreet-48x40": () => import("./regionReferences/jp-city-shopstreet.json"),\n`;
      if (!snap.includes(anchor)) { console.error("regionReferenceSnapshots.ts 에 로더를 붙일 자리를 못 찾았다"); process.exit(2); }
      fs.writeFileSync(snapPath, snap.replace(anchor, anchor + `  "${placeId}": () => import("./regionReferences/jp-city-${file}.json"),\n`));
    }
    console.log("publish", { placeId, download: fs.statSync(join(REGION_DIR, `jp-city-${file}.oprn.json`)).size });
  }

  return { TS, KIT, GRP, W, H, L1, L2, L3, L4, own3, own4, ground, laneSet, reserved, doors, placed, issues, deco, inb, idx, fail, single,
    stamp, put, tryPut, fillL1, checker, addLane, shapeLanes, railLine, fenceLine, groupLine, groupLineL2, edgeMarks, mark30, stampL2, poleRow, finish, publish };
}
