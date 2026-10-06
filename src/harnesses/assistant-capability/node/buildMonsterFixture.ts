// bun 전용: 모델 없이 build_monster_game(create)로 캠페인을 깔아 JSON 으로 쓴다.
// vite-node 안에서 편집기 도구를 동적으로 불러오면 의존성 최적화가 서버를 재시작해 「Request is outdated」로 죽는다(2026-10-06).
import { writeFileSync } from 'node:fs';
import { createBlankProject } from '@/project/defaults';
import { runToolAsync } from '@/editor/tools/asyncToolRunner';
import { serialize } from '@/project/io';

const out = process.argv[2];
if (!out) throw Error('bun buildMonsterFixture.ts <out.json>');
const project = createBlankProject();
const built = await runToolAsync({ project, currentMapId: project.startMapId } as never, 'build_monster_game', { mode: 'create' });
if (!built.ok) throw Error(`캠페인 준비 실패: ${built.summary}`);
writeFileSync(out, serialize((built as { project?: typeof project }).project ?? project));
