// bun 전용: 모델 없이 build_monster_game(create)로 캠페인을 깔아 JSON 으로 쓴다(규모 인자 선택).
//   bun scripts/qa/poke-audit-fix/build-fixture.mts <out.json> [gymCount] [speciesCount]
import { writeFileSync } from 'node:fs';
import { createBlankProject } from '@/project/defaults';
import { runToolAsync } from '@/editor/tools/asyncToolRunner';
import { serialize } from '@/project/io';

const [out, gyms, species] = process.argv.slice(2);
if (!out) throw Error('usage: <out.json> [gymCount] [speciesCount]');
const project = createBlankProject();
const ctx = { project, currentMapId: project.startMapId };
const args: Record<string, unknown> = { mode: 'create' };
if (gyms !== undefined) args.gymCount = Number(gyms);
if (species !== undefined) args.speciesCount = Number(species);
const t0 = Date.now();
const built = await runToolAsync(ctx as never, 'build_monster_game', args);
if (!built.ok) throw Error(`build failed: ${built.summary}`);
writeFileSync(out, serialize(ctx.project));
console.log(`built ${Object.keys(ctx.project.maps).length} maps in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${out}`);
