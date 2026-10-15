import { readFileSync } from "node:fs";
import { deserialize } from "@/project/io/serialize";
import { runSceneTest } from "@/testing/sceneTestRunner";
const p: any = deserialize(readFileSync(process.argv[2] ?? "qa-runs/poke-fix-p/hm2.json", "utf8"));
const start: any[] = [{ kind: "set", mapId: "mx_map_lab", x: 7, y: 6, facing: "up" }, { kind: "interact", eventId: "mx_map_lab_professor" }, { kind: "choose", index: 0 }];
const run = (label: string, steps: any[], expectOk = true) => {
  const r: any = runSceneTest(p, { mapId: "mx_map_lab", start: { x: 7, y: 6 }, steps: [...start, ...steps] });
  console.log(`${r.ok === expectOk ? "PASS" : "FAIL"} ${label}: ok=${r.ok} ${r.ok ? "" : JSON.stringify(r.failedStep) + " " + (r.failureReason ?? "")}`);
  if (process.env.V) console.log((r.log ?? []).filter((l: string) => /useFieldSkill|useItem|common/.test(l)).join("\n"));
  return r;
};
const give = (id: string) => ({ kind: "set", inventory: { [id]: 1 } });
// water: 두 칸 건너기
run("water-blocked", [{ kind: "set", mapId: "mx_map_meadow", x: 8, y: 20, facing: "down" }, { kind: "move", dir: "down" }], false);
run("water-cross", [give("item_hm_ford"), { kind: "useItem", itemId: "item_hm_ford" }, { kind: "set", mapId: "mx_map_meadow", x: 8, y: 20, facing: "down" },
  { kind: "useFieldSkill", skillId: "skill_field_ford", target: "ev_hm_water_1" }, { kind: "move", dir: "down" }, { kind: "move", dir: "down" }, { kind: "move", dir: "down" },
  { kind: "expect", playerAt: { x: 8, y: 23 } }]);
// rock
run("rock-blocked", [{ kind: "set", mapId: "mx_map_meadow", x: 6, y: 13, facing: "up" }, { kind: "move", dir: "up" }], false);
run("rock-open", [give("item_hm_shove"), { kind: "useItem", itemId: "item_hm_shove" }, { kind: "set", mapId: "mx_map_meadow", x: 6, y: 13, facing: "up" },
  { kind: "useFieldSkill", skillId: "skill_field_shove", target: "ev_hm_rock_1" }, { kind: "move", dir: "up" }, { kind: "move", dir: "up" }, { kind: "expect", playerAt: { x: 6, y: 11 } }]);
// 한 기술이 다른 이벤트(NPC)에 쓰이면 셀프 스위치를 건드리지 않고 거절 대사만
run("wrong-target-no-effect", [give("item_hm_shove"), { kind: "useItem", itemId: "item_hm_shove" }, { kind: "set", mapId: "mx_map_meadow", x: 10, y: 15, facing: "up" },
  { kind: "useFieldSkill", skillId: "skill_field_shove", target: "mx_map_meadow_trainer_1" }, { kind: "move", dir: "up" }, { kind: "expect", playerAt: { x: 10, y: 15 } }], false);
// dark: 기술 모르면 어두움, 알면 밝음
const dark = (known: boolean) => runSceneTest(p, { mapId: "mx_map_lab", start: { x: 7, y: 6 }, steps: [...start, ...(known ? [give("item_hm_glow"), { kind: "useItem", itemId: "item_hm_glow" }] : []), { kind: "set", mapId: "mx_map_meadow", x: 9, y: 11, facing: "up" }, { kind: "wait", ticks: 3 }] }) as any;
for (const known of [false, true]) { const r = dark(known); console.log(known ? "dark-known" : "dark-unknown", "ambient", r.session?.lighting?.ambient, r.ok); }
