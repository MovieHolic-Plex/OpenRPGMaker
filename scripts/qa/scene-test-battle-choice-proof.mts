// run_scene_test battleChoice 증거 — 적 무리 전투 페이지의 선택지에 미리 넣은 답을 내고, 맞는 답이면 이기고 틀리면 지는가.
// 실행: node node_modules/vite-node/dist/cli.mjs --script scripts/qa/scene-test-battle-choice-proof.mts [출력.json]
// 예전: 전투 안 선택지에서 BATTLE_EVENT_INPUT_REQUIRED 예외로 장면 시험이 통째로 죽었다.
import { writeFileSync } from "node:fs";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { createBlankProject } from "@/project/defaults";
import type { Command, GameEvent } from "@/project/types";

const project = createBlankProject();
const ctx = { project, assistantRun: false };
const exec = (name: string, args: Record<string, unknown>) => {
  const r = runTool(ctx, name, args, { dryRun: false });
  if (!r.ok) throw new Error(`${name}: ${r.summary} ${JSON.stringify(r.issues ?? []).slice(0, 300)}`);
  return r;
};
exec("upsert_state", { state: { id: "state_proof_heard", name: "들음", restriction: "없음", removalCondition: "전투 종료 시 해제", runtimeEffects: { damageTypeRates: { physical: 100, magic: 100 } } } });
exec("upsert_enemy", { enemy: {
  id: "enemy_proof_ghost", name: "원귀", monsterResourceId: "generated-enemy-banshee-wail", stats: { maxHp: 40, maxMp: 0, attack: 400, defense: 1, mind: 1, agility: 1 },
  rewards: { exp: 0, gold: 0, dropRatePercent: 0 }, damageTypeRates: { physical: 0, magic: 0 }, skillIds: ["skill_attack"],
} });
exec("upsert_troop", { troop: { id: "troop_proof_ghost", name: "원귀", enemyIds: ["enemy_proof_ghost"] } });
const tell: Command[] = [{
  kind: "choices", prompt: "누가 그랬나?", cancelBehavior: "disallow",
  options: [
    { text: "칠복", branch: [{ kind: "text", body: "바람이 거세진다." } as Command] },
    { text: "정 서방", branch: [
      { kind: "text", body: "우는 소리가 낮아진다." } as Command,
      { kind: "m2Command", commandId: "m2-100-change-enemy-state", fields: { target: "enemy_proof_ghost", operation: "add", value: "state_proof_heard" } } as unknown as Command,
    ] },
  ],
} as unknown as Command];
exec("upsert_troop_battle_page", { troopId: "troop_proof_ghost", page: {
  id: "bp_proof_tell", name: "고하기", span: "turn",
  conditions: [{ kind: "everyRound", start: 1, interval: 1 }, { kind: "enemyState", enemyId: "enemy_proof_ghost", stateId: "state_proof_heard", present: false }],
  commands: tell,
} });
const map = ctx.project.maps[ctx.project.startMapId]!;
const ev: GameEvent = { id: "ev_proof_well", name: "우물", x: 5, y: 4, trigger: { kind: "action" }, commands: [
  { kind: "battleProcessing", troopId: "troop_proof_ghost", canEscape: false, canLose: true, branchOnResult: true,
    victoryBranch: [{ kind: "setSwitch", switchId: "sw_proof_won", value: true }],
    defeatBranch: [{ kind: "setSwitch", switchId: "sw_proof_lost", value: true }] } as unknown as Command,
] } as GameEvent;
map.events.push(ev);
ctx.project.switches.push({ id: "sw_proof_won", name: "이김" }, { id: "sw_proof_lost", name: "짐" });

const call = (steps: unknown[]) => exec("run_scene_test", { mapId: map.id, start: { x: 5, y: 5 }, steps }).data as {
  ok: boolean; failureReason?: string; finalState: { switchesOn: string[]; messages?: string[] }; log: string[];
};
const base = [{ kind: "face", dir: "up" }];
const right = call([...base, { kind: "battleChoice", indices: [1] }, { kind: "interact", eventId: "ev_proof_well" }, { kind: "expect", switchOn: "sw_proof_won" }]);
const wrong = call([...base, { kind: "battleChoice", indices: [0, 0, 0, 0, 0, 0] }, { kind: "interact", eventId: "ev_proof_well" }, { kind: "expect", switchOn: "sw_proof_lost" }]);
const missing = call([...base, { kind: "interact", eventId: "ev_proof_well" }]);
const malformed = runTool(ctx, "run_scene_test", { mapId: map.id, start: { x: 5, y: 5 }, steps: [{ kind: "battleChoice" }] }, { dryRun: false });

const out = {
  right: { ok: right.ok, reason: right.failureReason, choiceLog: right.log.filter((l) => /choice/.test(l)) },
  wrong: { ok: wrong.ok, reason: wrong.failureReason, choiceLog: wrong.log.filter((l) => /choice/.test(l)).slice(0, 3) },
  missing: { ok: missing.ok, reason: missing.failureReason },
  malformed: { ok: malformed.ok, summary: malformed.summary },
};
const allOk = right.ok && wrong.ok && !missing.ok && /battleChoice/.test(missing.failureReason ?? "") && /정 서방/.test(missing.failureReason ?? "") && !malformed.ok;
const file = process.argv[2];
if (file) writeFileSync(file, JSON.stringify({ allOk, ...out }, null, 1));
console.log(JSON.stringify({ allOk, ...out }, null, 1));
process.exit(allOk ? 0 : 1);
