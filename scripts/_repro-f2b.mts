import { createEmptyToolProject } from "../src/editor/tools/emptyProject.ts";
import { createHouseInteriorMap } from "../src/editor/houseInteriors.ts";

const project = createEmptyToolProject("repro");
const interior = createHouseInteriorMap({
  project,
  id: "map_test_int" as any,
  name: "테스트 집 내부",
  returnMapId: "map_village" as any,
  returnX: 6, returnY: 12,
  exitEventId: "ev_exit",
  seed: 1234,
  exterior: { stories: 2, kitId: "blue-stone", footprintArea: 63, ownerName: "촌장" },
});
console.log("stories:", interior.stories, "scale:", interior.scale, "program:", interior.program);
for (const floor of interior.floors) {
  const map = floor.map;
  console.log(`=== floor ${floor.floor} ${map.id} ${map.width}x${map.height} tileset=${map.tilesetId}`);
  for (const ev of map.events ?? []) {
    for (const page of ev.pages ?? []) {
      for (const cmd of page.commands ?? []) {
        if (cmd.kind === "transfer") {
          const target = interior.floors.find((f) => f.mapId === cmd.mapId)?.map;
          let destInfo = "";
          if (target) {
            const di = cmd.y * target.width + cmd.x;
            destInfo = ` destTile lower=${target.lowerTiles[di]} upper=${target.upperTiles[di]}`;
          }
          console.log(`  ev ${ev.id} @(${ev.x},${ev.y}) -> ${cmd.mapId} (${cmd.x},${cmd.y})${destInfo}`);
        }
      }
    }
  }
  for (let y = 0; y < map.height; y++) {
    let line = "";
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      const lo = map.lowerTiles[i], up = map.upperTiles[i];
      const ev = (map.events ?? []).some((e) => e.x === x && e.y === y);
      line += ev ? "E" : up !== -1 && up !== undefined ? "U" : lo === -1 ? " " : lo === 72 ? "." : "#";
    }
    console.log("  " + String(y).padStart(2) + " " + line);
  }
}
