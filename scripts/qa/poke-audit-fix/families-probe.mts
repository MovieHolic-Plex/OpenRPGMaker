// define_monster_families: ability·machineSkillIds 전달과 생성 id 응답. bun scripts/qa/poke-audit-fix/families-probe.mts <fixture.json>
import { readFileSync } from 'node:fs';
import { deserialize } from '@/project/io';
import { getTool } from '@/editor/tools';

const project = deserialize(readFileSync(process.argv[2]!, 'utf8'));
const tool = getTool('define_monster_families')!;
const types = project.system.typeChart?.types ?? [];
const skills = project.database.skills.map((s) => s.id);
const hmSkill = project.database.skills.find((s) => s.id === 'skill_field_cut')?.id ?? skills[0]!;
const call = (label: string, families: unknown[], extra: Record<string, unknown> = {}) => {
  const draft = structuredClone(project);
  try {
    const out = tool.run(draft, { families, autoGraphics: true, ...extra } as never) as { summary: string; data: any; warnings?: string[] };
    const ids: string[] = out.data.speciesIds;
    const rows = ids.map((id) => { const sp = draft.database.monsterSpecies!.find((s) => s.id === id)!; return `${id}: ability=${sp.ability ? `${sp.ability.kind}(${sp.ability.name})` : '-'} machine=${JSON.stringify(sp.machineSkillIds ?? null)}`; });
    console.log(`\n[${label}] OK\n  summary: ${out.summary.slice(-260)}\n  ${rows.join('\n  ')}\n  failed=${JSON.stringify(out.data.failed)}`);
  } catch (e) { console.log(`\n[${label}] ERROR ${(e as Error).message.slice(0, 400)}`); }
};
const water = types.includes('water') ? 'water' : types[0]!;
call('family ability + machine', [{ family: 'otter_line', types: [water], ability: { name: '물갈이', kind: 'immuneType', type: water, healPercent: 25 }, machineSkillIds: [hmSkill], stages: [{ name: '수달이' }, { name: '수달왕' }] }]);
call('stage override', [{ family: 'owl_line', types: ['normal'], ability: { name: '버팀', kind: 'endure' }, stages: [{ name: '올빼미' }, { name: '부엉왕', ability: { name: '강인함', kind: 'statMultiplier', stat: 'defense', percent: 150 } }] }]);
call('bad ability kind', [{ family: 'bad_line', types: ['normal'], ability: { name: 'x', kind: 'flyHigh' }, stages: [{ name: '나쁜이' }] }, { family: 'ok_line', types: ['normal'], stages: [{ name: '좋은이' }] }]);
call('missing type param', [{ family: 'bad2_line', types: ['normal'], ability: { name: 'x', kind: 'immuneType' }, stages: [{ name: '나쁜이2' }] }]);
call('unknown machine skill', [{ family: 'bad3_line', types: ['normal'], machineSkillIds: ['skill_nope'], stages: [{ name: '나쁜이3' }] }]);
