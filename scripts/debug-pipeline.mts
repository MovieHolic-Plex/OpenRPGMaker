import { INTERIOR_ROOM_DEMO_PLANS, runInteriorRoomPipeline } from "../src/editor/interiorRoomPipeline.ts";

for (const plan of INTERIOR_ROOM_DEMO_PLANS) {
  const r = runInteriorRoomPipeline(plan);
  console.log(plan.theme, "ok", r.ok, "warnings", r.warnings, "log", r.log);
  if (plan.theme === "bedroom") {
    const m = r.map;
    for (let i = 0; i < m.upperTiles.length; i++) {
      const u = m.upperTiles[i]!;
      if (u === 355 || u === 356) {
        console.log("bed", i % m.width, Math.floor(i / m.width), u, "L", m.lowerTiles[i]);
      }
    }
  }
}
