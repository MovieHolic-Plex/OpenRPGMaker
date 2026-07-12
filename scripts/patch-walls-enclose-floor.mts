import fs from "node:fs";

const path = "src/editor/interiorRoomPipeline.ts";
let s = fs.readFileSync(path, "utf8");

const startMarker = "/**\n * Gold shell alignment";
const endMarker = "// ── Furniture with surface rules + bed hard pair";
const start = s.indexOf(startMarker);
const end = s.indexOf(endMarker);
if (start < 0 || end < 0) {
  console.error("markers not found", start, end);
  process.exit(1);
}

const replacement = `/**
 * Walls enclose floor: NEVER overwrite floor cells with wall chips.
 * Wall tiles go only on adjacent non-floor cells.
 *
 *   N: face×2 + cap above north floor edge (CORNER on post cols, EDGE_N on floor cols)
 *   W/E: posts at x-1 / x+1
 *   S: EDGE_S / alcove at y+1 (outside) — floor stays 72
 */
function paintWallsFromFloor(map: GameMap, floor: boolean[], door: DoorSpec): void {
  const w = map.width;
  const h = map.height;
  const F = (x: number, y: number) =>
    inBounds(x, y, w, h) && floor[y * w + x] === true;

  // Keep every floor mask cell as FLOOR
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (F(x, y)) setL(map, x, y, VR.FLOOR);
    }
  }

  type Pt = { x: number; y: number };
  const northFloor: Pt[] = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (F(x, y) && !F(x, y - 1)) northFloor.push({ x, y });
    }
  }

  // West / east posts outside floor
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!F(x, y)) continue;
      if (x - 1 >= 0 && !F(x - 1, y)) setL(map, x - 1, y, VR.EDGE_W);
      if (x + 1 < w && !F(x + 1, y)) setL(map, x + 1, y, VR.EDGE_E);
    }
  }

  // North face + cap
  for (const { x, y } of northFloor) {
    const westEnd = !F(x - 1, y);
    const eastEnd = !F(x + 1, y);
    const westPost = x - 1;
    const eastPost = x + 1;

    for (let row = 1; row <= INTERIOR_ROOM_FACE_ROWS; row += 1) {
      const fy = y - row;
      if (fy < 0 || F(x, fy)) continue;
      if (westEnd) setL(map, x, fy, VR.INNER_L);
      else if (eastEnd) setL(map, x, fy, VR.INNER_R);
      else setL(map, x, fy, VR.BODY);
      if (westEnd && westPost >= 0 && !F(westPost, fy)) setL(map, westPost, fy, VR.EDGE_W);
      if (eastEnd && eastPost < w && !F(eastPost, fy)) setL(map, eastPost, fy, VR.EDGE_E);
    }

    const capY = y - INTERIOR_ROOM_FACE_ROWS - 1;
    if (capY >= 0 && !F(x, capY)) {
      setL(map, x, capY, VR.EDGE_N);
      if (westEnd && westPost >= 0 && !F(westPost, capY)) setL(map, westPost, capY, VR.CORNER_NW);
      if (eastEnd && eastPost < w && !F(eastPost, capY)) setL(map, eastPost, capY, VR.CORNER_NE);
    }
  }

  // South walls OUTSIDE (y+1) — never eat floor (fixes dining (6,9)/(9,9))
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!F(x, y) || F(x, y + 1)) continue;
      const sy = y + 1;
      if (sy >= h) continue;
      if (x === door.x && y === door.y) {
        setL(map, x, sy, VR.EDGE_S);
        continue;
      }
      if (x === door.x - 1 && y === door.y) setL(map, x, sy, VR.ALCOVE_L);
      else if (x === door.x + 1 && y === door.y) setL(map, x, sy, VR.ALCOVE_R);
      else setL(map, x, sy, VR.EDGE_S);
    }
  }

  setL(map, door.x, door.y, VR.FLOOR);
  if (door.y + 1 < h && !F(door.x, door.y + 1)) setL(map, door.x, door.y + 1, VR.EDGE_S);

  // L re-entrant beam joins
  for (const { x, y } of northFloor) {
    const faceY = y - 1;
    if (faceY < 0 || F(x, faceY)) continue;
    if (!F(x - 1, y) && F(x + 1, y) && F(x - 1, y + 1)) setL(map, x, faceY, VR.BEAM_SW);
    if (!F(x + 1, y) && F(x - 1, y) && F(x + 1, y + 1)) setL(map, x, faceY, VR.BEAM_SE);
  }
}

`;

s = s.slice(0, start) + replacement + s.slice(end);
fs.writeFileSync(path, s);
console.log("ok patched walls", start, "->", end);
