// Phase 2: 덩굴 장애물 증명 — 모름→막힘, 상자→기술서→몬스터에게 가르침→필드 기술→통과
import { readFileSync } from "node:fs";
import { deserialize } from "@/project/io/serialize";
import { runSceneTest } from "@/testing/sceneTestRunner";
const p: any = deserialize(readFileSync(process.argv[2] ?? "qa-runs/poke-fix-p/hm1.json", "utf8"));
const spec = process.argv[3] ?? "all";
const base: any[] = [
  { kind: "set", mapId: "mx_map_lab", x: 7, y: 6, facing: "up" },
  { kind: "interact", eventId: "mx_map_lab_professor" },
];
const tryRun = (label: string, steps: any[], expectOk = true) => {
  const r: any = runSceneTest(p, { mapId: "mx_map_lab", start: { x: 7, y: 6 }, steps });
  console.log(`${r.ok === expectOk ? "PASS" : "FAIL"} ${label}: ok=${r.ok} failed=${JSON.stringify(r.failedStep ?? r.failure ?? r.error ?? null)} ${r.failureReason ?? ""}`);
  if (process.env.V) console.log((r.log ?? []).slice(-14).join("\n"));
  return r;
};
const tree = "ev_hm_tree_1";
const start = [...base, { kind: "choose", index: 0 }];
// 1) 기술을 모를 때: 막힘 — 서 있는 칸에서 위로 막힌 채 장애물까지 걸어가 조사하면 막힘 대사만, 길은 안 열린다
tryRun("blocked-before", [...start,
  { kind: "set", mapId: "mx_map_meadow", x: 15, y: 17, facing: "up" },
  { kind: "interact", eventId: tree },
  { kind: "move", dir: "up" },
  { kind: "expect", playerAt: { x: 15, y: 17 } },
], false);
// 2) 기술을 모르면 useFieldSkill 은 거절
tryRun("useskill-unknown-rejected", [...start,
  { kind: "set", mapId: "mx_map_meadow", x: 15, y: 17, facing: "up" },
  { kind: "useFieldSkill", skillId: "skill_field_cut", target: tree },
], false);
// 3) 기술서를 상자에서 → 몬스터에게 가르침 → 필드 기술 → 통과
const r = tryRun("teach-use-pass", [...start,
  { kind: "set", mapId: "mx_map_meadow", x: 10, y: 27, facing: "up" },
  { kind: "interact", eventId: "ev_hm_chest" },
  { kind: "useItem", itemId: "item_hm_cut" },
  { kind: "set", mapId: "mx_map_meadow", x: 15, y: 17, facing: "up" },
  { kind: "interact", eventId: tree },
  { kind: "useFieldSkill", skillId: "skill_field_cut", target: tree },
  { kind: "move", dir: "up" },
  { kind: "move", dir: "up" },
  { kind: "expect", playerAt: { x: 15, y: 15 } },
]);
if (process.env.V) { console.log(Object.keys(r)); console.log(JSON.stringify({ e: r.error, f: r.failure, m: r.message, reason: r.reason }, null, 1).slice(0, 800)); }
