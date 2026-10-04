/**
 * 계약(번들) 스킬 전체의 타임라인 요약(층 시작·사운드 수)을 JSON 으로 덤프한다.
 * 같은 스크립트를 변경 전(기준 커밋)과 후에 돌려 diff 하면 "기존 계약 연출이 그대로"임을 전량 대조할 수 있다.
 * 사용: npx vite-node scripts/qa/runtime/retro-choreo-a1-dump.mts <out.json>
 */
import { writeFileSync } from "node:fs";
import { RETRO_ALL_CLASS_SKILLS } from "@/assets/retroSkillCatalog";
import { RETRO_MONSTER_SKILLS } from "@/assets/retroMonsterSkills";
import { retroClassSkillTimeline, retroMonsterSkillTimeline } from "@/battle/retroSkillTimeline";

const out = process.argv[2] ?? "timeline-dump.json";
const brief = (t: any) => ({
  duration: t.durationMs,
  events: t.events.map((e: any) => [e.kind, e.at, e.key ?? e.id ?? "", e.anchor ?? "", e.scale ?? 1, e.frameMs ?? 0]),
});
const rows: Record<string, unknown> = {};
for (const skill of RETRO_ALL_CLASS_SKILLS) for (const hits of [1, 3]) for (const side of ["enemies", "allies"] as const) rows[`class:${skill.id}:${hits}:${side}`] = brief(retroClassSkillTimeline(skill, { side, hits }));
for (const skill of RETRO_MONSTER_SKILLS) for (const hits of [1, 3]) rows[`monster:${skill.id}:${hits}`] = brief(retroMonsterSkillTimeline(skill, { hits }));
writeFileSync(out, JSON.stringify(rows));
console.log(`${Object.keys(rows).length} timelines -> ${out}`);
