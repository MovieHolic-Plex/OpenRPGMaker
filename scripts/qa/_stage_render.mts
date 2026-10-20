
import { mkdirSync, writeFileSync } from "node:fs";
import { createJrpg200FixtureProject } from "./jrpg-200-harness.mts";
import { SCENE_SETTING_TOOLS } from "../../src/editor/tools/sceneSettingTools.ts";
import { renderMapPng } from "../qa-game/render.mts";

const OUT = process.argv[2] ?? "/tmp/stage-before";
mkdirSync(OUT, { recursive: true });
const cases = [
  { id: "jrpg_016", mapId: "map_ember_village", theme: "volcano", x: 16, y: 11, houses: 2 },
  { id: "jrpg_002", mapId: "map_magitek_ruins", theme: "lava_bridge", x: 12, y: 7 },
  { id: "jrpg_003", mapId: "map_magitek_ruins", theme: "poison_swamp", x: 6, y: 11 },
  { id: "jrpg_046", mapId: "map_chrono_past", theme: "ruins_shrine", x: 11, y: 7 },
];
const tool = SCENE_SETTING_TOOLS[0]!;
for (const c of cases) {
  const project = createJrpg200FixtureProject();
  project.maps[c.mapId]!.events = [];
  await tool.prepare?.({ theme: c.theme, x: c.x, y: c.y } as never);
  const res = tool.run(project, { mapId: c.mapId, theme: c.theme, x: c.x, y: c.y, ...(c.houses ? { houses: c.houses } : {}) }) as { summary: string; warnings?: string[] };
  const map = project.maps[c.mapId]!;
  const png = renderMapPng({ ...project, startMapId: "__none__" }, { ...map, events: [] }, 2).png;
  writeFileSync(OUT + "/" + c.id + ".png", png);
  console.log(c.id, c.theme, map.width + "x" + map.height, res.warnings?.length ? "WARN " + res.warnings.join("|").slice(0, 120) : "ok");
}
