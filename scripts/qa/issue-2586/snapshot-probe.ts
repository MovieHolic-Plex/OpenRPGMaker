// #2586-4: does a BattleSnapshot keep the values it had when snapshot() was called?
import { readFileSync } from "node:fs";
import { deserialize } from "@/project/io";
import { createBattleRuntime } from "@/battle/runtime";
const project = deserialize(readFileSync("test/fixtures/projects/battle-strict-v3.json", "utf8"));
project.system.battleModel = "rm2k3";
const runtime = createBattleRuntime({ project, troopId: "troop_strict_training", battleFlow: "strict", canEscape: true, canLose: true, rng: () => 0.5 });
const before = runtime.snapshot();
const b = { roundLogs: before.roundLogs.length, exp: before.rewards.exp, eventLogs: before.eventLogs.length, sw: JSON.stringify(before.eventState.switches) };
for (let n = 0; n < 100 && !runtime.snapshot().result; n++) {
  const state = runtime.snapshot();
  if (state.phase === "actorCommand") runtime.performActorCommand({ kind: "attack", targetEnemyId: state.enemies[0].id });
  else runtime.tick(100);
}
const after = runtime.snapshot();
console.log(`at call time:        roundLogs=${b.roundLogs} rewards.exp=${b.exp} eventLogs=${b.eventLogs}`);
console.log(`new snapshot (won):  result=${after.result} roundLogs=${after.roundLogs.length} rewards.exp=${after.rewards.exp} eventLogs=${after.eventLogs.length}`);
console.log(`same 'before' later: roundLogs=${before.roundLogs.length} rewards.exp=${before.rewards.exp} eventLogs=${before.eventLogs.length}`);
console.log(`shared references:   roundLogs=${before.roundLogs === after.roundLogs} rewards=${before.rewards === after.rewards} capturedMonsters=${before.capturedMonsters === after.capturedMonsters} eventLogs=${before.eventLogs === after.eventLogs} switches=${before.eventState.switches === after.eventState.switches} variables=${before.eventState.variables === after.eventState.variables} inventory=${before.eventState.inventory === after.eventState.inventory}`);
// mutate a returned snapshot: must not leak into the runtime
(after.eventState.inventory as Record<string, number>).__probe = 99;
(after.rewards as { exp: number }).exp = -1;
const again = runtime.snapshot();
console.log(`writes to a snapshot leak into runtime: inventory=${again.eventState.inventory.__probe === 99} rewards=${again.rewards.exp === -1}`);
