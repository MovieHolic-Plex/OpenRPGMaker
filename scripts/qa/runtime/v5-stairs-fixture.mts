// Runtime QA fixture (2026-10-22, hand interior v5 stair redraw): a blank project + the v5 example rooms that use the
// redrawn stairs, wired by the stair entrance contract (src/assets/stairContracts.json).
//   manor 1F up wood stair (11..13,1..3, move row 3, front row 4)  <->  manor 2F stairwell down (11..13,3..4, move row 4, front row 5)
//   dungeon up stone stair (1..3,1..3, move row 3, front row 4)     <->  "qa-cellar-top": the dungeon room with a 2x2 stairs down
//                                                                       stamped in the corridor at (8,6) (move row 7, front row 8)
// Prints the project JSON on stdout.
import fs from "node:fs";
import { createBlankProject } from "../../../src/project/defaults.ts";

const c = JSON.parse(fs.readFileSync("tiledata/hand-interior/v5-maps/maps.json", "utf8"));
const spec = JSON.parse(fs.readFileSync("src/assets/handInteriorSpec.json", "utf8"));
const transfer = (id: string, name: string, x: number, y: number, mapId: string, tx: number, ty: number) => ({
  id, name, x, y, trigger: { kind: "playerTouch" }, commands: [],
  pages: [{ id: `${id}-p1`, name: "1", conditions: [], graphic: {}, trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false,
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "transfer", mapId, x: tx, y: ty, direction: "down", fade: "black" }] }],
});
const maps: Record<string, any> = {};
for (const id of ["hand-manor-1f", "hand-manor-2f", "hand-dungeon"]) maps[id] = structuredClone(c.maps[id]);
const top = structuredClone(c.maps["hand-dungeon"]);
top.id = "qa-cellar-top"; top.name = "QA · 지하 위층(내려가는 계단)";
const W = top.width;
for (const [dx, dy, t] of spec.objects["stairs down"].cells) top.upperTiles[(6 + dy) * W + 8 + dx] = t;
top.events = [0, 1].map((dx) => transfer(`qa-top-down-${dx}`, "아래층으로", 8 + dx, 7, "hand-dungeon", 2, 4));
maps["hand-dungeon"].events = [0, 1, 2].map((dx) => transfer(`qa-dun-up-${dx}`, "위층으로", 1 + dx, 3, "qa-cellar-top", 8, 8));
maps["qa-cellar-top"] = top;
const p: any = createBlankProject();
p.maps = maps;
const ids = Object.keys(maps);
p.mapTree = { mapId: ids[0], children: ids.slice(1).map((mapId) => ({ mapId, children: [] })) };
p.startMapId = "hand-manor-1f";
p.startPos = { x: 12, y: 7 };
delete p.system.opening;
process.stdout.write(JSON.stringify(p));
