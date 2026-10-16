// 기존 8관 캠페인을 configure_monster_campaign badgeCount 로 줄인 프로젝트를 쓴다. bun scripts/qa/poke-audit-fix/resize-fixture.mts <in.json> <out.json> <badgeCount>
import { readFileSync, writeFileSync } from 'node:fs';
import { deserialize, serialize } from '@/project/io';
import { runToolAsync } from '@/editor/tools/asyncToolRunner';
const [input, out, count] = process.argv.slice(2);
const project = deserialize(readFileSync(input!, 'utf8'));
const ctx = { project, currentMapId: project.startMapId };
const result = await runToolAsync(ctx as never, 'configure_monster_campaign', { badgeCount: Number(count) });
console.log(result.ok ? 'ok' : 'FAIL', String(result.summary).slice(0, 300));
if (result.ok) writeFileSync(out!, serialize(ctx.project));
