// bun 전용: 모델 없이 build_monster_game(create)로 캠페인을 깔아 JSON 으로 쓴다.
// vite-node 안에서 편집기 도구를 동적으로 불러오면 의존성 최적화가 서버를 재시작해 「Request is outdated」로 죽는다(2026-10-06).
import { writeFileSync } from 'node:fs';
import { createBlankProject } from '@/project/defaults';
import { runToolAsync } from '@/editor/tools/asyncToolRunner';
import { serialize } from '@/project/io';

const out = process.argv[2];
if (!out) throw Error('bun buildMonsterFixture.ts <out.json>');
const project = createBlankProject();
// runToolAsync 는 ctx.project 를 새 문서로 갈아 끼운다 — 넘긴 객체가 아니라 ctx 에서 읽는다.
const ctx = { project, currentMapId: project.startMapId };
const built = await runToolAsync(ctx as never, 'build_monster_game', { mode: 'create' });
if (!built.ok) throw Error(`캠페인 준비 실패: ${built.summary}`);
if (Object.keys(ctx.project.maps).length < 72) throw Error(`캠페인 맵이 ${Object.keys(ctx.project.maps).length}개뿐입니다`);
writeFileSync(out, serialize(ctx.project));
