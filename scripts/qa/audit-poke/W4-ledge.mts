import { readFileSync } from "node:fs";
import { canMove, ledgeDirectionAt, isPassable } from "../../../src/project/collision";
const project = JSON.parse(readFileSync("qa-runs/audit-poke/a4.json", "utf8"));
const map = project.maps["mx_map_meadow"];
const ts = project.tilesets[map.tilesetId];
const out: string[] = [];
for (let x = 4; x < 20; x++) for (const y of [4, 9, 12, 17, 26]) {
  if (ledgeDirectionAt(ts, map, x, y) !== "down") continue;
  const down = canMove(project, map, x, y - 1, x, y);        // step down onto ledge tile (allowed dir)
  const up = canMove(project, map, x, y + 1, x, y);          // step up onto ledge from below
  const landOk = isPassable(project, map, x, y + 1) && ledgeDirectionAt(ts, map, x, y + 1) === null;
  const fromOk = isPassable(project, map, x, y - 1);
  if (down && !up && landOk && fromOk) out.push(`${x},${y} canMove(down)=${down} canMove(up)=${up} landPassable=${landOk}`);
}
console.log(out.slice(0, 8).join("\n"), "\ntotal", out.length);
