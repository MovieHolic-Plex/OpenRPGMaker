// bbox-village: render every catalog kit on a grass sheet → <out>/sheet-raw.png + sheet.json (positions). Labels are added by sheet.py.
import { readFileSync, writeFileSync } from "node:fs";
import { ensureBundledTilesets } from "../../../src/project/defaults/defaultAssets.ts";
import { createBlankProject } from "../../../src/project/defaults.ts";
import { CONSTRUCTION_TOOLS_V3 } from "../../../src/editor/tools/v3/constructionTools.ts";
import { SHARED_OBJECT_TOOLS } from "../../../src/editor/tools/sharedObjectTools.ts";
const out = process.argv[2]!;
const kits: Record<string, any> = JSON.parse(readFileSync(`${out}/catalog.json`, "utf8")).kits;
const COLS = 72, GAP = 2;
const pos: any[] = []; let x = 1, y = 1, rowH = 0, lastKind = "";
for (const [id, k] of Object.entries(kits)) {
  const slotW = Math.max(k.w, 9);
  if (x + slotW > COLS - 1 || (lastKind && lastKind !== k.kind && k.kind !== "boat" && lastKind !== "boat")) { x = 1; y += rowH + GAP; rowH = 0; }
  pos.push({ id, x, y, w: k.w, h: k.h, kind: k.kind }); x += slotW + 1; rowH = Math.max(rowH, k.h); lastKind = k.kind;
}
const W = COLS, H = y + rowH + 2;
const p = createBlankProject() as any; ensureBundledTilesets(p);
const ts = p.tilesets.beodeul_city;
p.maps.sheet = { ...structuredClone(Object.values(p.maps)[0] as any), id: "sheet", width: W, height: H, tilesetId: "beodeul_city", tileSize: 16, lowerTiles: new Array(W * H).fill(-1), upperTiles: new Array(W * H).fill(-1), events: [] };
for (const k of ["lowerOverlayTiles", "upperOverlayTiles", "lowerTileStacks", "upperTileStacks", "shadowBits", "relief"]) delete p.maps.sheet[k];
CONSTRUCTION_TOOLS_V3.find((t: any) => t.name === "fill_region")!.run(p, { mapId: "sheet", rect: { x: 0, y: 0, w: W, h: H }, material: "버들항 풀밭", clearUpper: true, _exactCells: true });
const st = SHARED_OBJECT_TOOLS.find((t: any) => t.name === "stamp_object")!;
for (const q of pos) {
  if (q.kind === "boat") CONSTRUCTION_TOOLS_V3.find((t: any) => t.name === "fill_region")!.run(p, { mapId: "sheet", rect: { x: q.x, y: q.y, w: q.w, h: q.h }, material: "버들항 강·운하 물", _exactCells: true });
  try { st.run(p, { objectId: `kit:beodeul_city/${q.id}`, mapId: "sheet", x: q.x, y: q.y }); } catch (e) { console.log("fail", q.id, String(e).slice(0, 100)); }
}
const { renderMapPng } = await import("../../qa-game/render.mts");
writeFileSync(`${out}/sheet-raw.png`, renderMapPng(p, p.maps.sheet).png);
writeFileSync(`${out}/sheet.json`, JSON.stringify({ W, H, pos }));
console.log(W, H, pos.length);
