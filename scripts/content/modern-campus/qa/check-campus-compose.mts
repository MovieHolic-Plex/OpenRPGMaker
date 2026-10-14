// compose_campus_grounds / link_campus_interior 를 조수 도구 그대로 돌려 엔진 통행·이동 이음을 본다.
//   bun scripts/content/modern-campus/qa/check-campus-compose.mts [--out /tmp/campus-compose]
import fs from "node:fs";
import { renderMapPng } from "../../../qa-game/render.mts";
import { createEmptyToolProject } from "../../../../src/editor/tools/emptyProject.ts";
import { ensureBundledTilesets } from "../../../../src/project/defaults/defaultAssets.ts";
import { runTool } from "../../../../src/editor/tools/index.ts";
const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? d : d; };
const OUT = arg("out", "/tmp/campus-compose"); fs.mkdirSync(OUT, { recursive: true });
const ctx: any = { project: createEmptyToolProject("chk") }; ensureBundledTilesets(ctx.project);
let bad = 0;
const call = (tool: string, args: any) => { const r: any = runTool(ctx, tool, args); if (!r.ok) { bad++; console.log("FAIL", tool, JSON.stringify(args).slice(0, 120), "→", JSON.stringify(r).slice(0, 1500)); } return r; };
const cases: { key: string; w: number; h: number; args: any }[] = [
  { key: "school-default", w: 48, h: 36, args: { style: "school" } },
  { key: "school-swapped", w: 56, h: 42, args: { style: "school", buildings: ["school-8", "cafeteria", "gym-green"], seed: 3 } },
  { key: "university-default", w: 52, h: 40, args: { style: "university" } },
  { key: "university-swapped", w: 60, h: 46, args: { style: "university", buildings: ["library", "lab", "dorm-7", "admin", "union"], seed: 5 } },
];
for (const c of cases) {
  const cm: any = call("create_map", { name: c.key, width: c.w, height: c.h, tilesetId: "modern_campus" });
  if (!cm.ok) continue;
  const mapId = cm.data.mapId;
  const r = call("compose_campus_grounds", { mapId, ...c.args });
  if (!r.ok) continue;
  console.log("OK  ", c.key, r.summary.slice(0, 200));
  const m = ctx.project.maps[mapId]!;
  fs.writeFileSync(`${OUT}/${c.key}.png`, renderMapPng(ctx.project, m).png);
  if (c.key === "school-default") {
    const b = r.data.buildings[0];
    const ex = JSON.parse(fs.readFileSync("tiledata/modern-campus/interior/plans/school-class-wing.json", "utf8"));
    const room = call("build_hand_interior_room", { tileset: "modern_campus", mapId: "chk-inmain", name: ex.name, plan: ex.plan, floor: ex.floor, wall: ex.wall, zones: ex.zones ?? [], objects: ex.objects ?? [], tables: ex.tables ?? [], goods: ex.goods ?? [], exitWidth: 2, start: [{ x: ex.start[0], y: ex.start[1] }], links: [] });
    if (room.ok) {
      const lk = call("link_campus_interior", { mapId, door: b.doors[0], width: b.doors.length, interiorMapId: "chk-inmain" });
      if (lk.ok) console.log("LINK", lk.summary);
    }
  }
}
process.exit(bad);
