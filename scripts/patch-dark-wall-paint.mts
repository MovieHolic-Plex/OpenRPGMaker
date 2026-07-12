import fs from "node:fs";

const path = "src/editor/interiorRoomPipeline.ts";
let s = fs.readFileSync(path, "utf8");

const start = s.indexOf("/**\n * Walls enclose floor: NEVER overwrite");
const end = s.indexOf("// ── Furniture with surface rules + bed hard pair");
if (start < 0 || end < 0) {
  // try alternate start
  const start2 = s.indexOf("function paintWallsFromFloor(map: GameMap, floor: boolean[], door: DoorSpec): void {");
  console.error("start", start, "end", end, "start2", start2);
  process.exit(1);
}

const replacement = `/**
 * Walls enclose floor via **366 dark-wall autotile** (RM brush model):
 * 1) Keep floor cells as 72
 * 2) Collect shell cells (4-adjacent outside floor)
 * 3) Paint brush **366** then shapeAutotile → edges/outer corners
 */
function paintWallsFromFloor(map: GameMap, floor: boolean[], door: DoorSpec): void {
  const w = map.width;
  const h = map.height;
  const F = (x: number, y: number) =>
    inBounds(x, y, w, h) && floor[y * w + x] === true;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (F(x, y)) setL(map, x, y, VR.FLOOR);
    }
  }

  const shell: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  const add = (x: number, y: number) => {
    if (!inBounds(x, y, w, h) || F(x, y)) return;
    const k = \`\${x},\${y}\`;
    if (seen.has(k)) return;
    seen.add(k);
    shell.push({ x, y });
  };
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!F(x, y)) continue;
      add(x, y - 1);
      add(x, y + 1);
      add(x - 1, y);
      add(x + 1, y);
    }
  }

  paintDarkWallAndShape(map, shell, createDarkWallAutotileGroup());

  setL(map, door.x, door.y, VR.FLOOR);
  if (door.y + 1 < h && !F(door.x, door.y + 1)) {
    paintDarkWallAndShape(map, [{ x: door.x, y: door.y + 1 }], createDarkWallAutotileGroup());
  }
}

`;

// fix template - the patch file itself shouldn't escape
const replacementFixed = replacement.replace(/\\`/g, "`").replace(/\\\$/g, "$");

s = s.slice(0, start) + replacementFixed + s.slice(end);
// remove dead reshape functions if still present after furniture marker
// already sliced to furniture section
fs.writeFileSync(path, s);
console.log("patched paintWallsFromFloor");
