// 챔피언 팀 구성(종·타입·레벨)과 마지막 관장 팀. bun scripts/qa/poke-audit-fix/champion-probe.mts <project.json>
import { readFileSync } from 'node:fs';
import { deserialize } from '@/project/io';
const p = deserialize(readFileSync(process.argv[2]!, 'utf8'));
const sp = new Map((p.database.monsterSpecies ?? []).map((s) => [s.id, s]));
const en = new Map(p.database.enemies.map((e) => [e.id, e]));
for (const t of p.database.troops.filter((x) => /league|gym_leader|boss|observatory/u.test(x.id))) {
  const row = t.members.map((m) => { const e = en.get(m.enemyId) as any; const s = sp.get(e?.speciesId); return `${s?.name ?? e?.name}(${(s?.types ?? []).join('/')}) Lv${e?.level} hp${e?.stats?.maxHp ?? e?.maxHp}`; });
  console.log(t.id.replace('mx_troop_mx_map_', '') + ': ' + row.join(' | '));
}
