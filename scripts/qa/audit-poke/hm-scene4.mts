import { readFileSync } from "node:fs";
import { deserialize } from "@/project/io/serialize";
import { runSceneTest } from "@/testing/sceneTestRunner";
const p: any = deserialize(readFileSync(process.argv[2] ?? "qa-runs/poke-fix-p/hm4.json", "utf8"));
const start: any[] = [{ kind: "set", mapId: "mx_map_lab", x: 7, y: 6, facing: "up" }, { kind: "interact", eventId: "mx_map_lab_professor" }, { kind: "choose", index: 0 }];
const r: any = runSceneTest(p, { mapId: "mx_map_lab", start: { x: 7, y: 6 }, steps: [...start,
  { kind: "set", inventory: { item_hm_ford: 1 } }, { kind: "useItem", itemId: "item_hm_ford" },
  { kind: "set", mapId: "mx_map_meadow", x: 8, y: 23, facing: "up" },
  { kind: "useFieldSkill", skillId: "skill_field_ford", target: "ev_hm_water_1" },
  { kind: "move", dir: "up" }, { kind: "move", dir: "up" }, { kind: "move", dir: "up" }, { kind: "expect", playerAt: { x: 8, y: 20 } }] });
console.log(r.ok, JSON.stringify(r.failedStep), r.failureReason ?? "");
