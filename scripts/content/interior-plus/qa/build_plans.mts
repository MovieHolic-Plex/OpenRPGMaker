// interior-plus 예제 평면(tiledata/hand-interior/plus/plans/*.json — 박물관·배 안·투기장)을 **조수 도구 그대로**
// (build_hand_interior_room, tileset atlas_biome_interior) 지어 경고·통행을 보고 PNG 를 쓴다.
//   bun scripts/content/interior-plus/qa/build_plans.mts [--out /tmp/iplus-plans] [--only id,id] [--layout '<json LayoutRequest>' --name x]
// 출력: 평면마다 OK/WARN/FAIL. --layout 이면 그 방 구성으로 지은 한 장(조수의 layout 경로 시험).
import fs from "node:fs";
import { renderMapPng } from "../../../qa-game/render.mts";
import { BUILD_HAND_INTERIOR_ROOM_TOOL } from "../../../../src/editor/tools/handInteriorTools.ts";
import { createEmptyToolProject } from "../../../../src/editor/tools/emptyProject.ts";
import { ensureBundledTilesets } from "../../../../src/project/defaults/defaultAssets.ts";
const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const OUT = arg("out", "/tmp/iplus-plans"); fs.mkdirSync(OUT, { recursive: true });
const DIR = "tiledata/hand-interior/plus/plans";
const project: any = createEmptyToolProject("chk"); ensureBundledTilesets(project);
let bad = 0;
const only = arg("only", "").split(",").filter(Boolean);
const layout = arg("layout", "");
const jobs: [string, any][] = layout
  ? [[arg("name", "layout"), { name: arg("name", "layout"), layout: JSON.parse(layout), floor: "boards", wall: "plaster" }]]
  : fs.readdirSync(DIR).filter((x) => x.endsWith(".json")).sort().map((f) => [f.replace(/\.json$/, ""), JSON.parse(fs.readFileSync(`${DIR}/${f}`, "utf8"))] as [string, any])
    .filter(([id]) => !only.length || only.includes(id));
for (const [id, ex] of jobs) {
  try {
    const rooms = ex.rooms?.map((r: any) => ({ id: r.id, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, ...(r.floor ? { floor: r.floor } : {}), ...(r.wall ? { wall: r.wall } : {}) }));
    const args: any = { tileset: "atlas_biome_interior", mapId: `chk-${id}`, name: ex.name, floor: ex.floor, wall: ex.wall, ceiling: ex.ceiling,
      ...(ex.layout ? { layout: ex.layout } : { rooms, connect: ex.connect ?? [], exit: ex.exit }),
      zones: ex.zones ?? [], objects: ex.objects ?? [], tables: ex.tables ?? [], goods: ex.goods ?? [], lines: ex.lines ?? [], daises: ex.daises ?? [], links: [] };
    if (!args.ceiling) delete args.ceiling;
    const r: any = BUILD_HAND_INTERIOR_ROOM_TOOL.run(project, args);
    const w = [...(r.warnings ?? [])].filter((m: string) => !m.startsWith("평면이 참고 예제"));
    if (w.length) bad++;
    const m = project.maps[`chk-${id}`]!;
    fs.writeFileSync(`${OUT}/${id}.png`, renderMapPng(project, m).png);
    fs.writeFileSync(`${OUT}/${id}.map.json`, JSON.stringify({ width: m.width, height: m.height, lowerTiles: m.lowerTiles, lowerOverlayTiles: m.lowerOverlayTiles, upperTiles: m.upperTiles, upperOverlayTiles: m.upperOverlayTiles, data: r.data?.layout ?? null }));
    console.log(`${w.length ? "WARN" : "OK  "} ${id} ${m.width}x${m.height}${w.length ? "\n  - " + w.join("\n  - ") : ""}`);
    if (r.data?.layout?.picture) console.log("  " + r.data.layout.picture.join("\n  "));
  } catch (e: any) { bad++; console.log(`FAIL ${id}: ${String(e.message ?? e).slice(0, 600)}`); }
}
process.exit(bad);
