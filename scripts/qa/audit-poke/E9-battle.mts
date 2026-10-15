import { readFileSync } from "node:fs";
import { deserialize } from "@/project/io/serialize";
import { startSession } from "@/project/session";
import { giveMonster, monsterBattlePartyOf } from "@/project/monsterCollection";
import { createBattleRuntime, headlessBattleSnapshot, escapeChance } from "@/battle/runtime";
const project: any = deserialize(readFileSync("qa-runs/audit-poke/A1-base.json", "utf8"));
const wildTroop = project.maps.mx_map_meadow.encounterTable[0].troopId;
const trainerTroop = project.database.troops.find((t: any) => t.trainerBattle === true)?.id;
console.log("wild troop", wildTroop, JSON.stringify({unc: project.database.troops.find((t:any)=>t.id===wildTroop)?.uncapturable, tr: project.database.troops.find((t:any)=>t.id===wildTroop)?.trainerBattle}), "trainer troop", trainerTroop);
function mk(troopId: string, canEscape: boolean, seed: number) {
  const session: any = startSession(project, seed);
  giveMonster(project, session, { speciesId: project.database.monsterSpecies[0].id, level: 20 });
  session.inventory = { ...(session.inventory ?? {}) };
  const ball = project.database.items.find((i: any) => i.captureProfile)?.id; session.inventory[ball] = 99;
  const mb = monsterBattlePartyOf(project, session);
  const runtime = createBattleRuntime({ project, troopId, canEscape, canLose: true, party: { levels: session.actorLevels, experience: session.actorExperience, names: session.actorNames, vitals: session.actorVitals, paramBonuses: session.actorParamBonuses, equipment: session.actorEquipment, skillIds: session.actorSkillIds, classOverrides: session.classOverrides, stateIds: session.actorStateIds, partyActorIds: session.partyActorIds, monsterParty: mb.party }, partyMonsters: mb.party,
    sessionState: { switches: session.switches, variables: session.variables, inventory: session.inventory, selfSwitches: session.selfSwitches, battleResult: session.battleResult, gameTime: session.gameTime, friendship: session.friendship }, rng: Math.random } as any);
  return { runtime, ball };
}
function toCommand(rt: any) { for (let g=0; g<200; g++) { const s = headlessBattleSnapshot(rt); if (s.result) return s; if (s.phase === "actorCommand") return s; rt.tick(1000); } return headlessBattleSnapshot(rt); }
// 1) trainer: capture
{ const { runtime, ball } = mk(trainerTroop, false, 1); const s = toCommand(runtime); const enemy = s.enemies[0];
  runtime.performActorCommand({ kind: "capture", captureItemId: ball, targetEnemyId: enemy.id } as any);
  const after = headlessBattleSnapshot(runtime); console.log("TRAINER capture ->", JSON.stringify((after as any).lastCaptureResult ?? (after as any).captureResult ?? "n/a").slice(0,200)); }
// 2) trainer: escape with canEscape=false
{ const { runtime } = mk(trainerTroop, false, 1); const s = toCommand(runtime); runtime.performActorCommand({ kind: "escape" } as any); const a = headlessBattleSnapshot(runtime); console.log("TRAINER escape (canEscape=false) -> result:", a.result ?? "(battle continues)"); }
// 3) wild: escape success rate over 300 trials
{ let ok = 0, attemptsSum = 0; const N = 300; for (let i = 0; i < N; i++) { const { runtime } = mk(wildTroop, true, i + 1); let tries = 0; for (; tries < 60; tries++) { const s = toCommand(runtime); if (s.result) break; runtime.performActorCommand({ kind: "escape" } as any); const a = headlessBattleSnapshot(runtime); if (a.result === "escape") { ok++; break; } } attemptsSum += tries + 1; }
  console.log(`WILD escape: ${ok}/${N} eventually escaped; avg attempts ${(attemptsSum / N).toFixed(2)}`); }
// 4) wild capture sanity
{ const { runtime, ball } = mk(wildTroop, true, 5); const s = toCommand(runtime); runtime.performActorCommand({ kind: "capture", captureItemId: ball, targetEnemyId: s.enemies[0].id } as any); const a: any = headlessBattleSnapshot(runtime); console.log("WILD capture ->", JSON.stringify(a.lastCaptureResult ?? a.captureResult ?? Object.keys(a).filter(k=>/capt/i.test(k))).slice(0,220)); }
console.log("escapeChance table (actorAgi,enemyAgi,fails,bonus):", [[10,10,0,0],[20,10,0,0],[10,20,0,0],[10,40,0,0],[10,40,3,0],[10,40,3,10]].map(a => `${a.join("/")}=${escapeChance(...(a as [number,number,number,number])).toFixed(2)}`).join("  "));
