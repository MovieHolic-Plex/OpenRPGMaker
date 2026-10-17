// bun scripts/qa/runtime/monster-hm-fixture.mts <out.json>
// 몬스터 캠페인(build_monster_game create)에 실제 도구로 비전머신 게이트 둘을 심는다 — 모델 없이, 조수와 같은 도구 경로.
//   1번길 y=20 줄: 바위(rock) 게이트 (13,20)  — 배지 1(새잎 배지)이 있어야 말을 듣는다. 비전서 상자 (12,27)
//   1번길 y=16 줄: 덩굴(tree) 게이트 (15,16)  — 조건 없음. 비전서 상자 (10,26)
// fullWidth:true 로 도로 폭 전체를 같은 막는 타일로 닫는다(우회로 없음).
import { writeFileSync } from 'node:fs';
import { createBlankProject } from '@/project/defaults';
import { runToolAsync } from '@/editor/tools/asyncToolRunner';
import { serialize } from '@/project/io';

const out = process.argv[2];
if (!out) throw Error('bun monster-hm-fixture.mts <out.json>');
const project = createBlankProject();
const ctx = { project, currentMapId: project.startMapId };
const call = async (name: string, args: Record<string, unknown>) => {
  const result = await runToolAsync(ctx as never, name, args);
  console.log(result.ok ? 'ok ' : 'ERR', name, result.summary.slice(0, 200));
  for (const warning of ('warnings' in result ? (result.warnings as string[] | undefined) : undefined) ?? []) console.log('   warn:', warning.slice(0, 220));
  if (!result.ok) throw Error(`${name} 실패: ${result.summary}`);
  return result;
};
await call('build_monster_game', { mode: 'create' });
await call('place_field_obstacle', { mapId: 'mx_map_meadow', x: 15, y: 16, kind: 'tree', id: 'ev_hm_tree_1', fullWidth: true, giverX: 10, giverY: 26 });
await call('place_field_obstacle', { mapId: 'mx_map_meadow', x: 13, y: 20, kind: 'rock', id: 'ev_hm_rock_1', fullWidth: true, requiresBadge: 1, giverX: 12, giverY: 27 });
writeFileSync(out, serialize(ctx.project));
console.log('wrote', out);
