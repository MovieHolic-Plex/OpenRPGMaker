import { RETRO_ROSTER_SKILLS } from "@/assets/retroRosterSkills";
import { defaultSkillRecords } from "@/project/defaults/defaultDatabaseStarterRecords";
import { retroRosterClass } from "@/assets/retroRoster";
const recs = new Map(defaultSkillRecords().map((s) => [s.id, s]));
const re = /모아|모으|충전|기합|집중|차지|축적|응축|지연|늦추|늦춰|느리|발을 묶|시간|되감|가속|재촉|빨리|소환|정령을 불러|불러내/;
for (const c of RETRO_ROSTER_SKILLS) {
  if (!re.test(c.name) && !re.test(c.description)) continue;
  const r = recs.get(c.id)!;
  console.log(`${retroRosterClass(c.classId)?.batch}\t${c.id}\t${c.name}\t${r.scope}/${r.effect.kind}\t${(r.stateEffects??[]).map(e=>(e.operation==="remove"?"-":"+")+e.stateId.replace("state_","")).join(",")}\t${c.description}`);
}
