// 감사 프로브(읽기 전용): 출하 캠페인 s1 위에서 레벨업 진화 + 센터 회복(recoverAll) + 경험치 곡선을 실제 함수로 돌린다.
import { readFileSync } from "node:fs";
import * as S from "@/project/session";
import { giveMonster, applyMonsterExperienceAndEvolution, monsterMaxHp } from "@/project/monsterCollection";
import { recoverAll } from "@/project/sessionActorCommands";
const raw = JSON.parse(readFileSync("qa-runs/audit-poke/s1/project.json", "utf8"));
const project = raw.project ?? raw;
const session = (S as any).startSession(project, 7);
const evolvers = (project.database.monsterSpecies as any[]).filter((s) => (s.evolutions ?? []).length > 0);
console.log("진화 가능한 종:", evolvers.length, "/", project.database.monsterSpecies.length, "요구 종류:", [...new Set(evolvers.flatMap((s) => s.evolutions.flatMap((e: any) => Object.keys(e.requires))))].join(","));
const sp = evolvers.find((s) => s.evolutions[0].requires.level) ?? evolvers[0];
const evo = sp.evolutions[0];
console.log("시험 종:", sp.id, "→", evo.toSpeciesId, JSON.stringify(evo.requires));
const g: any = giveMonster(project, session, { speciesId: sp.id, level: Math.max(1, (evo.requires.level ?? 5) - 2) });
const id = g.instance.instanceId;
console.log("시작 Lv", session.monsterInstances[id].level, session.monsterInstances[id].speciesId);
let totalExp = 0; const log: string[] = [];
for (let i = 0; i < 400; i++) {
  const r = applyMonsterExperienceAndEvolution(project, session, 25, [id]);
  totalExp += 25;
  const inst = session.monsterInstances[id];
  if (r[0] && (r[0].toLevel !== r[0].fromLevel || r[0].evolution)) log.push(`exp+25 x${i + 1}: Lv${r[0].fromLevel}->${r[0].toLevel}${r[0].evolution?.ok ? " 진화 " + (r[0].evolution as any).fromSpeciesId + "->" + (r[0].evolution as any).toSpeciesId : ""}`);
  if (inst.speciesId !== sp.id) break;
}
console.log(log.slice(0, 12).join("\n")); const fin = session.monsterInstances[id];
console.log("최종:", fin.speciesId, "Lv", fin.level, "총 경험치 입력", totalExp);
// 센터: 피 깎고 상태 걸고 recoverAll
const before = { ...session.monsterInstances[id], currentHp: 1, stateIds: ["state_poison"], skillPp: Object.fromEntries((session.monsterInstances[id].skillIds ?? []).map((k: string) => [k, 0])) };
session.monsterInstances[id] = before as any;
recoverAll(session as any, undefined, project);
const after = session.monsterInstances[id];
console.log("센터 recoverAll: HP", before.currentHp, "->", after.currentHp, "/", monsterMaxHp(project, after as any), "상태", JSON.stringify(after.stateIds), "PP", JSON.stringify(after.skillPp));
