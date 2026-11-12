// 이야기 기물 탐침(모델 없음) — 칩셋 하나의 «오너 면제» 기물 묶음이 ① 새 프로젝트에 실리는가 ② 시트 칸 관문(번들 출구는 지나고 스토어 출구는 막는가)
// ③ 기존 저장본에 실리고 다시 열어도 그대로인가 ④ 게임들이 바란 낱말로 실제 도구가 찾아 주는가 ⑤ v2 place_object 로 놓이고 통행이 적은 대로인가
// ⑥ 주인공(Actor1 24×32)이 곁에 선 1배 장면.
//
//   bun scripts/content/story-objects/probe.mts <칩셋 id> <outDir> [--base-sheet <고치기 전 시트 png>] [--saved <저장된 프로젝트 폴더>]
//
// 칩셋 표는 chipsets.json, 낱말은 그 칩셋의 ask.json(수요 장부에서 옮긴 것) — 여기 코드에 낱말 목록은 없다. 저장본에는 쓰지 않는다(임시 사본).
// 맵은 그 칩셋의 구성기 도구로 새로 깐 실제 맵이다. 길: list_tileset_objects(query) · v2 draw_object(what) → «이미 있다 → place_object» · v2 place_object.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import { openLocalProjectStore } from "../../../electron/local-store/store";
import { createBlankProject } from "../../../src/project/defaults/blankProject";
import { ensureBundledTilesets } from "../../../src/project/defaults/defaultAssets";
import { isPassable } from "../../../src/project/collision";
import { getTool } from "../../../src/editor/tools/toolRegistry";
import { runTool } from "../../../src/editor/tools";
import { createV2Tools } from "../../../src/ai/v2/tools/verbs";
import { V2Session } from "../../../src/ai/v2/turn/session";
import { reachableCells } from "../../../src/ai/v2/judge/eventReach";
import { tilesetSurface } from "../../../src/project/tilesetSurface";
import type { PiAssistantV2Env } from "../../../src/ai/v2/shared/env";
import type { ToolContext } from "../../../src/editor/tools/types";
import type { GameMap, Project, StructureKitDef, TilesetDef } from "../../../src/project/types";
import { renderMapPng } from "../../qa-game/render.mts";
import { passingCellIndex, uncoveredSheetCells } from "../../../src/harnesses/object-gate/node/cells";

const argv = process.argv.slice(2);
const opt = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const [chipset, out] = argv;
if (!chipset || !out) { console.error("usage: probe.mts <chipset> <outDir> [--base-sheet png] [--saved dir]"); process.exit(2); }
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const conf = read("scripts/content/story-objects/chipsets.json")[chipset] as { spec: string; ask: string; kitPrefix: string; sheet: string; map: { width: number; height: number; tool: string; args: Record<string, unknown> } };
if (!conf) { console.error(`chipsets.json 에 ${chipset} 가 없다`); process.exit(2); }
type Item = { id: string; name: string; kind: string; w: number; h: number; place: string; block: [number, number][] };
const items = (read(conf.spec) as { items: Item[] }).items;
const ASK = (read(conf.ask) as { items: Record<string, string[]> }).items;
fs.mkdirSync(out, { recursive: true });
const kitId = (id: string) => conf.kitPrefix + id;
const ownIds = new Set(items.map((it) => kitId(it.id)));
const ownKits = (ts: TilesetDef) => (ts.structureKits ?? []).filter((k) => ownIds.has(k.id));
const kitCells = (kit: StructureKitDef) => kit.rows.map((r) => (r.upperTiles ?? []).map((t, i) => (t >= 0 ? t : (r.tiles ?? [])[i] ?? -1)));
const report: Record<string, unknown> = { chipset };

// ── 1. 새 프로젝트 ──
const fresh = createBlankProject();
const fts = fresh.tilesets[chipset]!;
const docs = (fts.referenceDocuments ?? []).flatMap((c) => c.documents.map((d) => `${c.id}/${d.id}`)).filter((id) => /objects/u.test(id));
report.fresh = {
  kits: ownKits(fts).length, of: items.length, count: fts.count, referenceDocs: docs,
  tablesMatchCount: ["passability", "priority", "terrain", "tileMeta"].every((k) => (fts as unknown as Record<string, unknown[]>)[k]!.length === fts.count),
};
report.sheet = items.map((it) => {
  const kit = ownKits(fts).find((k) => k.id === kitId(it.id))!;
  return { id: kit.id, name: kit.name, size: `${it.w}×${it.h}`, kind: it.kind, place: it.place, cells: kitCells(kit).flat(), blocked: it.block.map(([x, y]) => `(${x},${y})`).join(" ") || "없음(밟고 지나감)" };
});

// ── 2. 시트 칸 관문: 고치기 전 시트에 없던 칸이 출구 규칙을 지난 그림의 칸인가 ──
{
  const png = (file: string) => { const p = PNG.sync.read(fs.readFileSync(file)); return { width: p.width, height: p.height, data: new Uint8Array(p.data), tileSize: 16 }; };
  const sheet = png(path.join(ROOT, conf.sheet));
  const baseFile = opt("--base-sheet");
  const base = baseFile ? png(baseFile) : null;
  const baseline = new Set(base ? uncoveredSheetCells(base, new Set(), new Map()).map((c) => c.hash) : []);
  const fresh0 = uncoveredSheetCells(sheet, baseline, new Map());
  report.cellGate = {
    baseSheet: baseFile ? `${base!.width}×${base!.height}` : "없음(시트의 모든 칸을 새 칸으로 센다)", sheet: `${sheet.width}×${sheet.height}`,
    newCells: fresh0.length, newCellIndexes: fresh0.map((c) => c.index),
    bundleUncovered: uncoveredSheetCells(sheet, baseline, passingCellIndex("bundle")).length,
    storeUncovered: uncoveredSheetCells(sheet, baseline, passingCellIndex("store")).length,
  };
}

// ── 3. 기존 저장본(사본) ──
const savedDir = opt("--saved");
if (savedDir) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "story-obj-probe-"));
  for (const name of ["project.sqlite", "project.sqlite-wal", "project.sqlite-shm"]) if (fs.existsSync(path.join(savedDir, name))) fs.copyFileSync(path.join(savedDir, name), path.join(dir, name));
  fs.mkdirSync(path.join(dir, "assets"));
  let store = await openLocalProjectStore({ projectDir: dir });
  const project = structuredClone(store.loadSnapshot()!.project) as Project;
  const had = project.tilesets[chipset] ? ownKits(project.tilesets[chipset]!).length : -1, countBefore = project.tilesets[chipset]?.count ?? -1;
  const own = Object.values(project.maps).filter((m) => m.tilesetId === chipset).map((m) => m.id);   // 이 칩셋으로 깐 맵만 본다(다른 칩셋의 꼬리 이사는 이 탐침의 일이 아니다)
  // 맵 그림 지문: 이식 칸은 «어느 칩셋의 몇 번 그림» 으로, 시트 칸은 번호로 — 이식 꼬리가 번들 끝 뒤로 밀려도(번호만 바뀜) 그림이 같으면 같다.
  const print = (p: Project) => { const grafts = new Map((p.tilesets[chipset]?.tileGrafts ?? []).map((g) => [g.targetTile, `g:${g.sourceChipset}:${g.sourceTile}`]));
    return JSON.stringify(own.map((id) => { const m = p.maps[id] as unknown as Record<string, number[] | undefined>; return [id, ...["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles"].map((k) => (m[k] ?? []).map((n) => grafts.get(n) ?? n))]; })); };
  const graftsBefore = (project.tilesets[chipset]?.tileGrafts ?? []).map((g) => g.targetTile);
  const before = print(project);
  ensureBundledTilesets(project);
  const saved = await store.saveProject(project);
  store.close();
  store = await openLocalProjectStore({ projectDir: dir });
  const again = structuredClone(store.loadSnapshot()!.project) as Project;
  store.close();
  const kitsSaved = JSON.stringify(ownKits(again.tilesets[chipset]!)), countSaved = again.tilesets[chipset]!.count;
  ensureBundledTilesets(again);
  report.existing = {
    source: savedDir, kitsAsLoaded: had, countAsLoaded: countBefore, kitsAfterEnsure: ownKits(project.tilesets[chipset]!).length, countAfterEnsure: project.tilesets[chipset]!.count,
    mapsOnThisChipset: own.length, localGraftsAsLoaded: graftsBefore, localGraftsAfterEnsure: (project.tilesets[chipset]?.tileGrafts ?? []).map((g) => g.targetTile), mapPicturesUnchanged: print(project) === before, reopenedPicturesSame: print(again) === before, save: saved.kind, reopenedKits: (JSON.parse(kitsSaved) as unknown[]).length,
    reopenedStable: JSON.stringify(ownKits(again.tilesets[chipset]!)) === kitsSaved && again.tilesets[chipset]!.count === countSaved,
    referenceDocsAfterEnsure: (project.tilesets[chipset]!.referenceDocuments ?? []).flatMap((c) => c.documents.map((d) => `${c.id}/${d.id}`)).filter((id) => /objects/u.test(id)),
  };
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── 4. 실제 맵: 그 칩셋의 구성기로 깐다 ──
const ctx: ToolContext = { project: fresh, currentMapId: "probe", assistantRun: true };
const must = (name: string, args: Record<string, unknown>) => { const r = runTool(ctx, name, args); if (!r.ok) throw new Error(`${name}: ${r.summary}`); return r; };
must("create_map", { id: "probe", name: "탐침 맵", width: conf.map.width, height: conf.map.height, tilesetId: chipset });
must(conf.map.tool, { mapId: "probe", ...conf.map.args });
{
  const m = ctx.project.maps.probe!; let start = { x: 0, y: 0 };
  for (let x = 0; x < m.width; x++) if (isPassable(ctx.project, m, x, m.height - 1)) { start = { x, y: m.height - 1 }; break; }
  ctx.project = { ...ctx.project, startMapId: "probe", startPos: start } as Project;
}
const cur = () => ctx.project.maps.probe!;
const map = cur();
const ts = ctx.project.tilesets[chipset]!;
const log: string[] = [];
const env: PiAssistantV2Env = {
  ctx, request: { task: "probe", provider: "local-cli:claude", mapIds: ["probe"], project: ctx.project } as never,
  emit: (e) => log.push(`event ${e.type}`), record: (r) => log.push(`record ${r.name} ok=${r.result.ok}`),
  sideChat: async () => JSON.stringify({ imagesSeen: 0, axes: { composition: 7, view: 8, doors: 8 }, score: 7, majors: [] }),
  render: async () => "data:image/png;base64,", checkpoint: async () => {},
};
const tools = createV2Tools(env, new V2Session());
const call = async (name: string, args: unknown) => {
  const res = await tools.find((t) => t.name === name)!.execute(`p${log.length}`, args);
  const text = (res.content.find((c) => c.type === "text") as { text: string }).text;
  try { return JSON.parse(text) as { ok?: boolean; summary?: string }; } catch { return { ok: false, summary: text }; }
};

// ── 5. 낱말로 찾기 ──
const wordRows: Record<string, unknown>[] = [];
for (const it of items) for (const word of ASK[it.id] ?? []) {
  let listed: { id: string }[] = [];
  try { listed = (getTool("list_tileset_objects")!.run(ctx.project, { mapId: "probe", query: word }) as { data: { objects: { id: string }[] } }).data.objects; } catch { /* 없음 */ }
  const rank = listed.findIndex((o) => o.id === kitId(it.id));
  const drawn = await call("draw_object", { object: { what: word, mapId: "probe" } });
  const sum = String(drawn.summary ?? "");
  const next = /place_object\(\{"mapId":"[^"]*","objectId":"([^"]+)"/u.exec(sum)?.[1];
  const how = next === kitId(it.id) ? "이 기물을 이른다(첫째)" : next && sum.includes(`${kitId(it.id)} (`) ? `후보에 있음(첫째는 ${next})` : next ? `다른 기물을 이른다(${next})`
    : /들어가는 장소|make_place/u.test(sum) ? "그리지 않음 — «장소» 로 돌려보냄(make_place)" : /지형·바닥·벽 칸/u.test(sum) ? "거부 — «지형 칸» 으로 봄" : drawn.ok ? "못 찾음 — 새 그림 카드를 띄움" : `기타: ${sum.slice(0, 90)}`;
  wordRows.push({ object: it.id, word, list_tileset_objects: rank < 0 ? `없음(${listed.length}건)` : `${rank + 1}/${listed.length}`, draw_object: how });
}
report.words = wordRows;

// ── 6. 놓기: 가장 흔한 걸을 수 있는 맨바닥 위, 맵 가운데에서 가까운 자리부터(큰 것 먼저), 서로 한 칸 띄우고 앞줄(아래 한 줄)은 걸을 수 있게 ──
const up = (m: GameMap) => (m as unknown as { upperTiles: number[] }).upperTiles;
const bare = (m: GameMap, i: number) => (up(m)[i] ?? -1) < 0 && ((m.lowerOverlayTiles ?? [])[i] ?? -1) < 0 && ((m.upperOverlayTiles ?? [])[i] ?? -1) < 0;
const ground = (() => {
  const n = new Map<number, number>();
  const roadTiles = tilesetSurface(ctx.project.tilesets[chipset]!).road;
  for (let i = 0; i < map.lowerTiles.length; i++) if (!roadTiles.has(map.lowerTiles[i] ?? -1) && bare(map, i) && isPassable(ctx.project, map, i % map.width, Math.floor(i / map.width))) n.set(map.lowerTiles[i]!, (n.get(map.lowerTiles[i]!) ?? 0) + 1);
  const top = [...n].sort((a, b) => b[1] - a[1]); const most = top[0]?.[1] ?? 0;
  return new Set(top.filter(([, c]) => c >= most * 0.25).map(([t]) => t));
})();
const road = tilesetSurface(ts).road;   // 칩셋이 길이라 적은 칸 — 길 위에는 세우지 않는다
const onRoad = (m: GameMap, i: number) => road.has(m.lowerTiles[i] ?? -1) || road.has((m.lowerOverlayTiles ?? [])[i] ?? -1);
const reserved = new Set<number>(), occupied = new Set<number>();
const events = new Set(map.events.map((e) => e.y * map.width + e.x));
const reach0 = reachableCells(ctx.project, map);
const freeLand = (x: number, y: number) => { const i = y * map.width + x; const m = cur();
  return x >= 1 && y >= 1 && x < m.width - 1 && y < m.height - 1 && isPassable(ctx.project, m, x, y) && ground.has(m.lowerTiles[i]!) && !onRoad(m, i) && bare(m, i) && !events.has(i) && !reserved.has(i) && (!reach0 || reach0[i] === 1); };
function spot(w: number, h: number): { x: number; y: number } | null {
  const cx = map.width / 2, cy = map.height / 2; let best: { x: number; y: number; d: number } | null = null;
  for (let y = 2; y + h < map.height - 2; y++) for (let x = 2; x + w < map.width - 2; x++) {
    let ok = true;
    for (let dy = 0; dy <= h && ok; dy++) for (let dx = 0; dx < w && ok; dx++) ok = freeLand(x + dx, y + dy);   // 기물 칸 + 앞줄
    const d = (x + w / 2 - cx) ** 2 + (y + h / 2 - cy) ** 2;
    if (ok && (!best || d < best.d)) best = { x, y, d };
  }
  return best;
}
const placed: Record<string, unknown>[] = [];
const where = new Map<string, { x: number; y: number }>();
for (const it of [...items].sort((a, b) => b.w * b.h - a.w * a.h)) {
  const kit = ownKits(ts).find((k) => k.id === kitId(it.id))!;
  const s = spot(it.w, it.h);
  if (!s) { placed.push({ object: it.id, kit: kit.id, ok: false, at: "자리 없음" }); continue; }
  for (let dy = -1; dy <= it.h + 1; dy++) for (let dx = -1; dx <= it.w; dx++) reserved.add((s.y + dy) * map.width + s.x + dx);
  const base = { x: s.x, y: s.y + it.h - 1 };
  // 도구가 자리를 옮기면 왜 처음 자리가 안 됐는지: 같은 호출을 프로젝트 사본 위에서 먼저 해 그 결과 글을 읽는다
  const dry = runTool({ project: structuredClone(ctx.project), currentMapId: "probe", assistantRun: true }, "stamp_tileset_object", { mapId: "probe", objectId: kit.id, base });
  const firstRefusal = dry.ok ? "" : `${dry.summary ?? ""} ${(dry.issues ?? []).map((i) => i.message).join(" / ")}`.trim();
  const res = await call("place_object", { mapId: "probe", objectId: kit.id, at: base });
  const m = cur(); const cells = kitCells(kit);
  // 실제로 놓인 자리(도구가 옮겼을 수 있다): 아직 세지 않은 칸에서 킷 그림 전체가 맞는 곳
  let ox = -1, oy = -1;
  for (let y = 0; y + it.h <= m.height && ox < 0; y++) for (let x = 0; x + it.w <= m.width && ox < 0; x++)
    if (cells.every((row, dy) => row.every((t, dx) => t < 0 || (up(m)[(y + dy) * m.width + x + dx] === t && !occupied.has((y + dy) * m.width + x + dx))))) { ox = x; oy = y; }
  const drawnOk = ox >= 0; const blockedNow: string[] = [];
  if (drawnOk) for (let dy = 0; dy < it.h; dy++) for (let dx = 0; dx < it.w; dx++) { occupied.add((oy + dy) * m.width + ox + dx); if (!isPassable(ctx.project, m, ox + dx, oy + dy)) blockedNow.push(`(${dx},${dy})`); }
  if (drawnOk) { where.set(it.id, { x: ox, y: oy }); for (let dy = -1; dy <= it.h + 1; dy++) for (let dx = -1; dx <= it.w; dx++) reserved.add((oy + dy) * m.width + ox + dx); }
  const want = it.block.map(([x, y]) => `(${x},${y})`);
  placed.push({ object: it.id, kit: kit.id, asked: `(${s.x},${s.y})`, at: drawnOk ? `(${ox},${oy})` : "안 놓임", ok: !!res.ok && drawnOk, moved: drawnOk && (ox !== s.x || oy !== s.y), ...(firstRefusal ? { firstSpotRefusal: firstRefusal.slice(0, 220) } : {}),
    blockedAsDeclared: drawnOk && JSON.stringify([...blockedNow].sort()) === JSON.stringify([...want].sort()), blocked: blockedNow.join(" ") || "없음", tool: String(res.summary ?? "").slice(0, 110) });
}
report.map = { tool: conf.map.tool, args: conf.map.args, size: `${map.width}×${map.height}`, start: ctx.project.startPos };
report.placed = placed;

// ── 7. 1배 장면: 놓인 기물 둘레를 자르고 주인공(Actor1 정면 24×32, 발은 한 칸)을 세운다 — 걸어서 닿는 칸에만 ──
{
  const m = cur(); const reach = reachableCells(ctx.project, m);
  const can = (x: number, y: number) => x >= 0 && y >= 0 && x < m.width && y < m.height && isPassable(ctx.project, m, x, y) && (!reach || reach[y * m.width + x] === 1);
  const heroes: { x: number; y: number; why: string }[] = [];
  for (const it of items) {
    const at = where.get(it.id); if (!at) continue;
    if (!it.block.length) { if (can(at.x + 1, at.y)) heroes.push({ x: at.x + 1, y: at.y, why: `${it.id} 옆(밟고 지나가는 바닥 그림)` }); continue; }
    const front = { x: at.x + Math.floor((it.w - 1) / 2), y: at.y + it.h };
    if (it.w * it.h >= 4 && can(front.x, front.y)) heroes.push({ ...front, why: `${it.id} 앞` });
  }
  const tall = items.find((it) => it.h === 2 && it.w === 1 && where.has(it.id));
  if (tall) { const at = where.get(tall.id)!; if (can(at.x + 1, at.y + 1)) heroes.push({ x: at.x + 1, y: at.y + 1, why: `${tall.id} 옆` }); }
  const full = PNG.sync.read(renderMapPng({ ...ctx.project, startMapId: "" } as Project, m).png);
  const chip = PNG.sync.read(fs.readFileSync(path.join(ROOT, "public/assets/easyrpg/charset/Actor1.png")));
  const key = [chip.data[0], chip.data[1], chip.data[2]];
  for (const h of heroes) for (let y = 0; y < 32; y++) for (let x = 0; x < 24; x++) {   // 첫 캐릭터, 아래 보기(셋째 줄), 가운데 걸음
    const s = ((64 + y) * chip.width + 24 + x) * 4; if (chip.data[s] === key[0] && chip.data[s + 1] === key[1] && chip.data[s + 2] === key[2]) continue;
    const tx = h.x * 16 - 4 + x, ty = h.y * 16 - 16 + y; if (tx < 0 || ty < 0 || tx >= full.width || ty >= full.height) continue;
    const d = (ty * full.width + tx) * 4; full.data[d] = chip.data[s]!; full.data[d + 1] = chip.data[s + 1]!; full.data[d + 2] = chip.data[s + 2]!; full.data[d + 3] = 255;
  }
  const xs = [...where.values()].map((p) => p.x), ys = [...where.values()].map((p) => p.y);
  const x0 = Math.max(0, Math.min(...xs) - 4), y0 = Math.max(0, Math.min(...ys) - 4), x1 = Math.min(m.width, Math.max(...xs) + 7), y1 = Math.min(m.height, Math.max(...ys) + 7);
  const crop = new PNG({ width: (x1 - x0) * 16, height: (y1 - y0) * 16 });
  PNG.bitblt(full, crop, x0 * 16, y0 * 16, crop.width, crop.height, 0, 0);
  fs.writeFileSync(path.join(out, "scene-1x.png"), PNG.sync.write(crop));
  const big = new PNG({ width: crop.width * 3, height: crop.height * 3 });
  for (let y = 0; y < big.height; y++) for (let x = 0; x < big.width; x++) { const s = (Math.floor(y / 3) * crop.width + Math.floor(x / 3)) * 4, d = (y * big.width + x) * 4; big.data.set(crop.data.subarray(s, s + 4), d); }
  fs.writeFileSync(path.join(out, "scene-3x.png"), PNG.sync.write(big));
  fs.writeFileSync(path.join(out, "map-1x.png"), PNG.sync.write(full));
  report.scene = { crop: `칸 (${x0},${y0})–(${x1 - 1},${y1 - 1})`, size: `${crop.width}×${crop.height}`, heroes };
}
fs.writeFileSync(path.join(out, "probe.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ fresh: report.fresh, cellGate: report.cellGate, existing: report.existing, map: report.map, scene: report.scene }, null, 1));
console.log("words:"); for (const r of wordRows) console.log(`  ${r.object} «${r.word}» list=${r.list_tileset_objects} draw=${r.draw_object}`);
console.log("placed:"); for (const r of placed) console.log(`  ${r.object} asked=${r.asked} at=${r.at} ok=${r.ok}${r.moved ? ` MOVED(${r.firstSpotRefusal ?? ""})` : ""} blockedAsDeclared=${r.blockedAsDeclared} blocked=${r.blocked} — ${r.tool ?? ""}`);
