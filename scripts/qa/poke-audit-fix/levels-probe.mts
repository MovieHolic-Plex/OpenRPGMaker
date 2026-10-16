// 캠페인 레벨 곡선 덤프: 체육관 관장·리그 챔피언 팀 레벨과 길 야생 레벨. bun scripts/qa/poke-audit-fix/levels-probe.mts <project.json> [--json]
import { readFileSync } from 'node:fs';
import { deserialize } from '@/project/io';

const project = deserialize(readFileSync(process.argv[2]!, 'utf8'));
const enemies = new Map(project.database.enemies.map((e) => [e.id, e]));
const rows: { map: string; troop: string; kind: string; levels: number[] }[] = [];
for (const troop of project.database.troops) {
  const lv = troop.members.map((m) => (enemies.get(m.enemyId) as { level?: number } | undefined)?.level ?? 0).filter(Boolean);
  if (!lv.length) continue;
  const kind = /league|champion/u.test(troop.id) ? 'league' : /gym|leader/u.test(troop.id) ? 'gym' : /wild/u.test(troop.id) ? 'wild' : 'other';
  rows.push({ map: '', troop: troop.id, kind, levels: lv });
}
const pick = (kind: string) => rows.filter((r) => r.kind === kind);
const fmt = (r: { troop: string; levels: number[] }) => `${r.troop}: ${r.levels.join(',')}`;
console.log(`gyms in campaign: ${project.system.monsterCampaign?.badges.length}`);
console.log('gym/leader troops:\n  ' + pick('gym').map(fmt).join('\n  '));
console.log('league troops:\n  ' + pick('league').map(fmt).join('\n  '));
const wild = pick('wild').flatMap((r) => r.levels);
console.log(`wild levels: min ${Math.min(...wild)} max ${Math.max(...wild)} (n=${wild.length})`);
