import { RETRO_ROSTER_SKILLS } from "@/assets/retroRosterSkills";
import { defaultSkillRecords } from "@/project/defaults/defaultDatabaseStarterRecords";
import { retroRosterClass } from "@/assets/retroRoster";
const recs = new Map(defaultSkillRecords().map((s) => [s.id, s]));
const re = /반격|카운터|도발|감싸|지키|수호|막아|회피|잔상|분신|반사|거울|리플렉|불사|불멸|되살아|선고|사형|즉사|죽음의|저주|철벽|방패|위협|어그로|파수/;
for (const c of RETRO_ROSTER_SKILLS) {
  if (!re.test(c.name) && !re.test(c.description)) continue;
  const r = recs.get(c.id)!;
  console.log(`${retroRosterClass(c.classId)?.batch}\t${c.id}\t${c.name}\t${r.scope}/${r.effect.kind}\t${(r.stateEffects??[]).map(e=>(e.operation==="remove"?"-":"+")+e.stateId.replace("state_","")).join(",")}\t${c.description}`);
}
