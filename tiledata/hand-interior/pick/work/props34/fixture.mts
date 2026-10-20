// Runtime QA fixture: a blank project + the v5 example rooms that show the props34 redraws.
import fs from "node:fs";
import { createBlankProject } from "../../../../../src/project/defaults.ts";
const c = JSON.parse(fs.readFileSync("tiledata/hand-interior/v5-maps/maps.json", "utf8"));
const ids = ["hand-pharmacy", "hand-tower", "hand-casino", "hand-magitek", "hand-chapel"];
const p: any = createBlankProject();
p.maps = Object.fromEntries(ids.map((id) => [id, structuredClone(c.maps[id])]));
p.mapTree = { mapId: ids[0], children: ids.slice(1).map((mapId) => ({ mapId, children: [] })) };
p.startMapId = ids[0];
delete p.system.opening;
const plan = Object.fromEntries(c.plans.map((x: any) => [x.id, x.entry]));
p.startPos = { x: plan[ids[0]][0], y: plan[ids[0]][1] };
fs.writeFileSync("output/props34-qa/project.json", JSON.stringify(p));
fs.writeFileSync("output/props34-qa/steps.json", JSON.stringify(ids.map((id) => ({ id, x: plan[id][0], y: plan[id][1] - 3 }))));
console.log("ok", ids.length);
