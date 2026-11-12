// 버들항 이야기 기물 탐침(모델 없음): 새 프로젝트·기존 저장본 양쪽에서 킷이 실리는지, 게임들이 바란 낱말로 실제 도구가 찾아 주는지, 놓이는지.
//
//   bun scripts/content/beodeul-objects/probe.mts <저장된 프로젝트 폴더(project.sqlite)> <outDir> [맵 id]
//
// 원본 저장본에는 쓰지 않는다(임시 폴더 사본을 연다). 낱말 목록은 여기 코드가 아니라 words.json(수요 장부에서 옮긴 것)에서 읽는다.
// 길: ① list_tileset_objects(query=낱말) ② v2 draw_object(what=낱말) 가 «이미 있다 → place_object(objectId)» 로 이르는가 ③ v2 place_object 로 놓기.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openLocalProjectStore } from "../../../electron/local-store/store";
import { createBlankProject } from "../../../src/project/defaults/blankProject";
import { ensureBundledTilesets } from "../../../src/project/defaults/defaultAssets";
import { BEODEUL_OBJECTS_KIT_PREFIX } from "../../../src/project/defaults/beodeulCity";
import { isPassable } from "../../../src/project/collision";
import { reliefCellLiftPx } from "../../../src/project/relief/screen";
import { getTool } from "../../../src/editor/tools/toolRegistry";
import { runTool } from "../../../src/editor/tools";
import { createV2Tools } from "../../../src/ai/v2/tools/verbs";
import { V2Session } from "../../../src/ai/v2/turn/session";
import { buildingEntrances } from "../../../src/ai/v2/place/entrances";
import type { PiAssistantV2Env } from "../../../src/ai/v2/shared/env";
import type { ToolContext } from "../../../src/editor/tools/types";
import type { GameMap, Project, StructureKitDef, TilesetDef } from "../../../src/project/types";
import { renderMapPng } from "../../qa-game/render.mts";
import { PNG } from "pngjs";
import { passingCellIndex, uncoveredSheetCells } from "../../../src/harnesses/object-gate/node/cells";
import catalog from "../../../tiledata/beodeul-objects/catalog.json";

const [source, out, wantMap] = process.argv.slice(2);
if (!source || !out) { console.error("usage: probe.mts <project dir> <outDir> [mapId]"); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const WORDS = JSON.parse(fs.readFileSync(new URL("./words.json", import.meta.url), "utf8")) as { items: Record<string, string[]> };
const kitId = (id: string) => BEODEUL_OBJECTS_KIT_PREFIX + id;
const ownKits = (ts: TilesetDef) => (ts.structureKits ?? []).filter((k) => k.id.startsWith(BEODEUL_OBJECTS_KIT_PREFIX));
const cellsOf = (kit: StructureKitDef) => kit.rows.flatMap((r) => r.upperTiles ?? []).filter((n) => n >= 0);
const LAYERS = ["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles"] as const;
function prints(project: Project): Map<string, string> {
  const outp = new Map<string, string>();
  for (const [id, map] of Object.entries(project.maps)) {
    const ts = project.tilesets[map.tilesetId];
    const grafts = new Map((ts?.tileGrafts ?? []).map((g) => [g.targetTile, `g:${g.sourceChipset}:${g.sourceTile}`]));
    const m = map as unknown as Record<string, number[] | undefined>;
    outp.set(id, LAYERS.map((k) => (m[k] ?? []).map((t) => (t < 0 ? "-" : grafts.get(t) ?? `s:${t}`)).join(",")).join("|"));
  }
  return outp;
}
const report: Record<string, unknown> = {};

// ── 1. 새 프로젝트 ──
const fresh = createBlankProject();
const fc = fresh.tilesets.beodeul_city!;
const freshGrafts = (fc.tileGrafts ?? []).map((g) => g.targetTile);
report.fresh = {
  cityKits: ownKits(fc).length, cityCount: fc.count, sheetTail: `${catalog.base}..${catalog.count - 1}`, firstBundleGraft: Math.min(...freshGrafts),
  kitCellsMatchCatalog: catalog.items.every((it) => JSON.stringify(ownKits(fc).find((k) => k.id === it.kit)?.rows.map((r) => r.upperTiles)) === JSON.stringify(it.rows)),
  tablesMatchCount: ["passability", "priority", "terrain", "tileMeta"].every((k) => (fc as unknown as Record<string, unknown[]>)[k]!.length === fc.count),
};
const sheetTable = catalog.items.map((it) => {
  const kit = ownKits(fc).find((k) => k.id === kitId(it.id))!;
  return { id: kit.id, name: kit.name, size: `${it.width}×${it.height}`, kind: it.kind, place: it.place, cells: cellsOf(kit),
    blocked: it.block.map(([x, y]) => `(${x},${y})`).join(" ") || "없음(밟고 지나감)", entrance: (kit.parts ?? []).filter((p) => p.kind === "entrance").map((p) => `(${p.dx},${p.dy})`).join(" ") };
});
report.sheet = sheetTable;

// ── 1b. 시트 칸 관문: 꼬리 줄의 칸이 출구 규칙을 지난 그림의 칸인가(기준선 없이 — 이 줄은 모두 새 칸이다) ──
{
  const sheet = PNG.sync.read(fs.readFileSync(new URL("../../../public/assets/beodeul-city/beodeul-city-chipset.png", import.meta.url)));
  const rowsPx = ((catalog.count - catalog.base) / catalog.tilesPerRow) * 16, y0 = (catalog.base / catalog.tilesPerRow) * 16;
  const tail = { width: sheet.width, height: rowsPx, data: new Uint8Array(sheet.data.subarray(y0 * sheet.width * 4, (y0 + rowsPx) * sheet.width * 4)), tileSize: 16 };
  const drawn = catalog.items.flatMap((it) => it.rows.flat()).filter((n) => n >= 0).length;
  report.cellGate = {
    tailCellsDrawn: drawn, sheetEndsAtTail: sheet.height === y0 + rowsPx,
    bundleUncovered: uncoveredSheetCells(tail, new Set(), passingCellIndex("bundle")).length,
    storeUncovered: uncoveredSheetCells(tail, new Set(), passingCellIndex("store")).length,
  };
}

// ── 2. 기존 저장본(사본) ──
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bd-obj-probe-"));
for (const name of ["project.sqlite", "project.sqlite-wal", "project.sqlite-shm"]) if (fs.existsSync(path.join(source, name))) fs.copyFileSync(path.join(source, name), path.join(dir, name));
fs.mkdirSync(path.join(dir, "assets"));
let store = await openLocalProjectStore({ projectDir: dir });
const snap = store.loadSnapshot();
if (!snap) throw new Error("저장된 프로젝트가 없다");
const project = structuredClone(snap.project) as Project;
const hadBefore = ownKits(project.tilesets.beodeul_city!).length;
const countBefore = project.tilesets.beodeul_city!.count;
const graftsBefore = (project.tilesets.beodeul_city!.tileGrafts ?? []).length;
const before = prints(project);
ensureBundledTilesets(project);
const after = prints(project);
const changedMaps = [...before].filter(([id, p]) => after.get(id) !== p).map(([id]) => id);
const saved = await store.saveProject(project);
store.close();
store = await openLocalProjectStore({ projectDir: dir });
const again = structuredClone(store.loadSnapshot()!.project) as Project;
store.close();
const countSaved = again.tilesets.beodeul_city!.count;
const kitsSaved = JSON.stringify(ownKits(again.tilesets.beodeul_city!));
ensureBundledTilesets(again);
report.existing = {
  source, kitsAsLoaded: hadBefore, kitsAfterEnsure: ownKits(project.tilesets.beodeul_city!).length,
  cityCountAsLoaded: countBefore, cityCountAfterEnsure: project.tilesets.beodeul_city!.count, graftsKept: (project.tilesets.beodeul_city!.tileGrafts ?? []).length === graftsBefore,
  firstLocalGraftAfterEnsure: Math.min(...(project.tilesets.beodeul_city!.tileGrafts ?? []).map((g) => g.targetTile)),
  mapsWhosePicturesChanged: changedMaps, save: saved.kind,
  reopenedKits: (JSON.parse(kitsSaved) as unknown[]).length, reopenedKitsStableAfterEnsure: JSON.stringify(ownKits(again.tilesets.beodeul_city!)) === kitsSaved,
  reopenedCountStable: again.tilesets.beodeul_city!.count === countSaved, reopenedPicturesSame: [...before].every(([id, p]) => prints(again).get(id) === p),
};
fs.rmSync(dir, { recursive: true, force: true });

// ── 3. 낱말로 찾기 · 놓기 (기존 저장본의 실제 버들항 맵) ──
const ts = project.tilesets.beodeul_city!;
const outdoor = Object.values(project.maps).filter((m) => m.tilesetId === "beodeul_city" && (m as unknown as { climate?: { mode?: string } }).climate?.mode !== "indoor");
const meta = (ts.tileMeta ?? []) as ({ label?: string; tags?: string[] } | undefined)[];
const waterAt = (m: GameMap, x: number, y: number) => {
  if (x < 0 || y < 0 || x >= m.width || y >= m.height || isPassable(project, m, x, y)) return false;
  const i = y * m.width + x;
  if (((m as unknown as { upperTiles: number[] }).upperTiles[i] ?? -1) >= 0) return false;
  const t = m.lowerTiles[i] ?? -1, o = (m.lowerOverlayTiles ?? [])[i] ?? -1;
  return [t, o].some((n) => n >= 0 && ((meta[n]?.tags ?? []).includes("water") || /물|강|늪|바다|water/iu.test(meta[n]?.label ?? "")));
};
function waterBlock(m: GameMap): { x: number; y: number } | null {
  for (let y = 1; y < m.height - 4; y++) for (let x = 1; x < m.width - 5; x++) {
    let ok = isPassable(project, m, x - 1, y);
    for (let dy = 0; dy < 3 && ok; dy++) for (let dx = 0; dx < 4 && ok; dx++) ok = waterAt(m, x + dx, y + dy);
    if (ok) return { x, y };
  }
  return null;
}
const map = (wantMap ? project.maps[wantMap] : undefined) ?? outdoor.find((m) => waterBlock(m)) ?? outdoor.sort((a, b) => b.width * b.height - a.width * a.height)[0];
if (!map) throw new Error("이 저장본에 버들항 바깥 맵이 없다");
const ctx: ToolContext = { project, currentMapId: map.id, assistantRun: true };
const session = new V2Session();
const log: string[] = [];
const env: PiAssistantV2Env = {
  ctx, request: { task: "probe", provider: "local-cli:claude", mapIds: [map.id], project } as never,
  emit: (e) => log.push(`event ${e.type}`), record: (r) => log.push(`record ${r.name} ok=${r.result.ok}`),
  sideChat: async () => JSON.stringify({ imagesSeen: 0, axes: { composition: 7, view: 8, doors: 8 }, score: 7, majors: [] }),
  render: async () => "data:image/png;base64,", checkpoint: async () => {},
};
const tools = createV2Tools(env, session);
// 이 실행에서 던전을 이미 지은 뒤(동굴·던전 낱말을 «장소» 로 돌려보내는 규칙이 풀린 뒤)의 같은 도구
const sessionAfterDungeon = new V2Session();
sessionAfterDungeon.places.set("probe-dungeon", { builder: "dungeon" } as never);
const toolsAfterDungeon = createV2Tools(env, sessionAfterDungeon);
const call = async (name: string, args: unknown, set = tools) => {
  const res = await set.find((t) => t.name === name)!.execute(`p${log.length}`, args);
  const text = (res.content.find((c) => c.type === "text") as { text: string }).text;
  try { return JSON.parse(text) as { ok?: boolean; summary?: string }; } catch { return { ok: false, summary: text }; }
};
const wordRows: Record<string, unknown>[] = [];
for (const it of catalog.items) {
  for (const word of WORDS.items[it.id] ?? []) {
    let listed: { id: string }[] = [];
    try { listed = ((getTool("list_tileset_objects")!.run(ctx.project, { mapId: map.id, query: word }) as { data: { objects: { id: string }[] } }).data.objects); } catch { /* 없음 */ }
    const rank = listed.findIndex((o) => o.id === kitId(it.id));
    const read = async (set: typeof tools) => {
      const drawn = await call("draw_object", { object: { what: word, mapId: map.id } }, set);
      const sum = String(drawn.summary ?? "");
      const next = /place_object\(\{"mapId":"[^"]*","objectId":"([^"]+)"/u.exec(sum)?.[1];
      const all = [...sum.matchAll(/(bd-[a-z0-9_-]+|workshop:[^ ()·]+) \(/gu)].map((m) => m[1]);
      return next === kitId(it.id) ? "이 기물을 이른다(첫째)" : next && all.includes(kitId(it.id)) ? `후보 ${all.indexOf(kitId(it.id)) + 1}번째(첫째는 ${next})` : next ? `다른 기물을 이른다(${next})`
        : /들어가는 장소|make_place/u.test(sum) ? "그리지 않음 — «장소» 로 돌려보냄(make_place)" : /지형·바닥·벽 칸/u.test(sum) ? "거부 — «지형 칸» 으로 봄(ask_missing_tiles)" : drawn.ok ? "못 찾음 — 새 그림 카드를 띄움" : `기타: ${sum.slice(0, 90)}`;
    };
    let how = await read(tools);
    if (/make_place/u.test(how)) how += ` · 던전을 지은 뒤: ${await read(toolsAfterDungeon)}`;
    wordRows.push({ object: it.id, word, list_tileset_objects: rank < 0 ? `없음(${listed.length}건)` : `${rank + 1}/${listed.length}`, draw_object: how });
  }
}
report.words = wordRows;

// 놓기: 물 4×3 덩이가 있으면 널빤지 길 한 벌을 그 위에, 나머지는 맵 가운데에서 가까운 **풀밭**(이 맵에서 가장 흔한 걸을 수 있는 바닥 칸)에 둘레 한 칸을 비우고.
const reserved = new Set<number>();   // 탐침이 자리로 잡아 둔 칸(둘레 포함)
const occupied = new Set<number>();   // 실제로 놓인 기물 칸
const events = new Set(map.events.map((e) => e.y * map.width + e.x));
const cur = () => ctx.project.maps[map.id]!;
const ground = (() => {   // 가장 흔한 걸을 수 있는 맨바닥 칸 그림(위에 아무것도 없는 칸만 센다)
  const n = new Map<number, number>(); const m = cur(); const up = (m as unknown as { upperTiles: number[] }).upperTiles;
  for (let i = 0; i < m.lowerTiles.length; i++) if ((up[i] ?? -1) < 0 && ((m.lowerOverlayTiles ?? [])[i] ?? -1) < 0 && isPassable(ctx.project, m, i % m.width, Math.floor(i / m.width))) n.set(m.lowerTiles[i]!, (n.get(m.lowerTiles[i]!) ?? 0) + 1);
  const top = [...n].sort((a, b) => b[1] - a[1]); const most = top[0]?.[1] ?? 0;
  return new Set(top.filter(([, c]) => c >= most * 0.25).map(([t]) => t));
})();
const freeLand = (x: number, y: number) => x >= 1 && y >= 1 && x < map.width - 1 && y < map.height - 1 && isPassable(ctx.project, cur(), x, y)
  && ground.has(cur().lowerTiles[y * map.width + x]!)
  && ((cur() as unknown as { upperTiles: number[] }).upperTiles[y * map.width + x] ?? -1) < 0 && ((cur().upperOverlayTiles ?? [])[y * map.width + x] ?? -1) < 0
  && ((cur().lowerOverlayTiles ?? [])[y * map.width + x] ?? -1) < 0 && !events.has(y * map.width + x) && !reserved.has(y * map.width + x);
function spot(w: number, h: number): { x: number; y: number } | null {
  const cx = map.width / 2, cy = map.height / 2; let best: { x: number; y: number; d: number } | null = null;
  for (let y = 2; y + h < map.height - 1; y++) for (let x = 2; x + w < map.width - 1; x++) {
    // 기물 칸은 모두 빈 풀밭, 앞줄(아래 한 줄)은 걸을 수 있고 비어 있어야 한다(다가설 수 있게). 옆·뒤는 나무·길이어도 된다 — 다른 탐침 기물과는 한 칸 띄운다(reserved).
    let ok = true;
    for (let dy = 0; dy < h && ok; dy++) for (let dx = 0; dx < w && ok; dx++) ok = freeLand(x + dx, y + dy);
    for (let dx = 0; dx < w && ok; dx++) ok = isPassable(ctx.project, cur(), x + dx, y + h) && !reserved.has((y + h) * map.width + x + dx) && !events.has((y + h) * map.width + x + dx)
      && ((cur() as unknown as { upperTiles: number[] }).upperTiles[(y + h) * map.width + x + dx] ?? -1) < 0;
    // 높이 지형(절벽·단)의 가장자리는 피한다 — 둘레 두 칸(아래는 세 칸)까지 같은 높이여야 절벽 그림이 기물을 가리지 않는다.
    const lift = reliefCellLiftPx(cur().relief, x, y, 16);
    for (let dy = -2; dy <= h + 2 && ok; dy++) for (let dx = -2; dx <= w + 1 && ok; dx++) ok = reliefCellLiftPx(cur().relief, x + dx, y + dy, 16) === lift;
    const d = (x + w / 2 - cx) ** 2 + (y + h / 2 - cy) ** 2;
    if (ok && (!best || d < best.d)) best = { x, y, d };
  }
  return best;
}
const placed: Record<string, unknown>[] = [];
async function place(id: string, at: { x: number; y: number }, note = "") {
  const it = catalog.items.find((i) => i.id === id)!; const kit = ownKits(ts).find((k) => k.id === kitId(id))!;
  const base = { x: at.x, y: at.y + it.height - 1 };
  // 도구가 자리를 옮기면 왜 처음 자리가 안 됐는지: 같은 호출을 프로젝트 사본 위에서 먼저 해 그 결과 글을 읽는다
  const dry = runTool({ project: structuredClone(ctx.project), currentMapId: map.id, assistantRun: true }, "stamp_tileset_object", { mapId: map.id, objectId: kit.id, base });
  const firstRefusal = dry.ok ? "" : `${dry.summary ?? ""} ${(dry.issues ?? []).map((i) => i.message).join(" / ")}`.trim();
  const res = await call("place_object", { mapId: map.id, objectId: kit.id, at: base });
  const m = cur(); const up = (m as unknown as { upperTiles: number[] }).upperTiles;
  // 실제로 놓인 자리(도구가 옮겼을 수 있다): 아직 세지 않은 칸에서 킷 그림 전체가 맞는 곳
  const first = cellsOf(kit)[0]!; let ox = -1, oy = -1;
  const fx = kit.rows.flatMap((r, dy) => (r.upperTiles ?? []).map((t, dx) => ({ t, dx, dy }))).find((c) => c.t === first)!;
  for (let i = 0; i < up.length && ox < 0; i++) if (up[i] === first && !occupied.has(i)) {
    const x = i % m.width - fx.dx, y = Math.floor(i / m.width) - fx.dy;
    if (kit.rows.every((r, dy) => (r.upperTiles ?? []).every((t, dx) => t < 0 || up[(y + dy) * m.width + x + dx] === t))) { ox = x; oy = y; }
  }
  const drawnOk = ox >= 0;
  const blockedNow: string[] = [];
  if (drawnOk) for (let dy = 0; dy < it.height; dy++) for (let dx = 0; dx < it.width; dx++) { occupied.add((oy + dy) * m.width + ox + dx); reserved.add((oy + dy) * m.width + ox + dx); if (!isPassable(ctx.project, m, ox + dx, oy + dy)) blockedNow.push(`(${dx},${dy})`); }
  const want = it.block.map(([x, y]) => `(${x},${y})`);
  const ent = (kit.parts ?? []).find((p) => p.kind === "entrance");
  const seen = ent && drawnOk ? buildingEntrances(ctx.project, m).some((e) => (e as unknown as { x: number; y: number }).x === ox + ent.dx && (e as unknown as { x: number; y: number }).y === oy + ent.dy) : undefined;
  const moved = drawnOk && (ox !== at.x || oy !== at.y);
  placed.push({ object: id, kit: kit.id, asked: `(${at.x},${at.y})`, at: drawnOk ? `(${ox},${oy})` : "안 놓임", ok: !!res.ok && drawnOk, moved, ...(moved || !drawnOk ? { firstSpotRefusal: firstRefusal.slice(0, 200) } : {}), tool: String(res.summary ?? "").slice(0, 110),
    blockedAsDeclared: drawnOk ? JSON.stringify([...blockedNow].sort()) === JSON.stringify([...want].sort()) : false, blocked: blockedNow.join(" ") || "없음", ...(ent ? { entranceSeenByV2: seen } : {}), ...(note ? { note } : {}) });
  return drawnOk ? { x: ox, y: oy } : null;
}
const wb = waterBlock(map);
const PLANKS = ["plank-ew", "plank-ns", "plank-corner", "plank-end"];
if (wb) {
  for (let i = 0; i < 3; i++) await place("plank-ew", { x: wb.x + i, y: wb.y }, "물 위");
  await place("plank-corner", { x: wb.x + 3, y: wb.y }, "물 위");
  for (let j = 1; j < 3; j++) await place("plank-ns", { x: wb.x + 3, y: wb.y + j }, "물 위");
  await place("plank-ew", { x: wb.x, y: wb.y + 2 }, "물 위"); await place("plank-end", { x: wb.x + 1, y: wb.y + 2 }, "물 위");
}
for (const it of [...catalog.items].sort((a, b) => b.width * b.height - a.width * a.height)) {   // 큰 것부터 자리를 잡는다
  if (wb && PLANKS.includes(it.id)) continue;
  const s = spot(it.width, it.height);
  if (!s) { placed.push({ object: it.id, kit: kitId(it.id), ok: false, at: "자리 없음" }); continue; }
  for (let dy = -1; dy <= it.height; dy++) for (let dx = -1; dx <= it.width; dx++) reserved.add((s.y + dy) * map.width + s.x + dx);
  await place(it.id, s, PLANKS.includes(it.id) ? "이 맵에 물 덩이가 없어 땅 위" : "");
}
report.map = { id: map.id, name: map.name, size: `${map.width}×${map.height}`, waterBlock: wb };
report.placed = placed;
fs.writeFileSync(path.join(out, "composite-1x.png"), renderMapPng(ctx.project, cur()).png);
fs.writeFileSync(path.join(out, "probe.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ fresh: report.fresh, cellGate: report.cellGate, existing: report.existing, map: report.map }, null, 1));
console.log("words:"); for (const r of wordRows) console.log(`  ${r.object} «${r.word}» list=${r.list_tileset_objects} draw=${r.draw_object}`);
console.log("placed:"); for (const r of placed) console.log(`  ${r.object} asked=${r.asked} at=${r.at} ok=${r.ok}${r.moved ? ` MOVED(${r.firstSpotRefusal})` : ""} blockedAsDeclared=${r.blockedAsDeclared} ${"entranceSeenByV2" in r ? `entrance=${r.entranceSeenByV2} ` : ""}${r.note ?? ""} — ${r.tool ?? ""}`);
