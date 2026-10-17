// bun 전용: build_monster_game(create) 위에 배지 게이트(place_badge_gate 배지 3개)와 복종 레벨 상한(배지 0개 Lv8)을 얹어 JSON 으로 쓴다.
// 시각 QA(scripts/qa/runtime/monster-badge-gate.mjs)의 입력이다. 사이드카 <out>.gate.json 에 문지기 칸 좌표를 남긴다.
import { writeFileSync } from 'node:fs';
import { createBlankProject } from '@/project/defaults';
import { runToolAsync } from '@/editor/tools/asyncToolRunner';
import { serialize } from '@/project/io';
import { applyGenrePreset } from '@/project/genrePresets';

const out = process.argv[2];
if (!out) throw Error('bun buildMonsterBadgeGateFixture.ts <out.json>');
const project = createBlankProject();
const ctx = { project, currentMapId: project.startMapId };
const built = await runToolAsync(ctx as never, 'build_monster_game', { mode: 'create' });
if (!built.ok) throw Error(`캠페인 준비 실패: ${built.summary}`);

// 실제 조수 세션처럼 몬스터 수집 장르 잠금을 켠 뒤 게이트를 놓는다(허용 사람 칩만 보인다).
applyGenrePreset(ctx.project, 'monster-collect');

const start = ctx.project.maps[ctx.project.startMapId]!;
const at = { x: ctx.project.startPos.x + 3, y: ctx.project.startPos.y };
const gate = await runToolAsync(ctx as never, 'place_badge_gate', { mapId: start.id, x: at.x, y: at.y, badges: 3, name: '문지기', facing: 'down', graphic: { textureKey: 'tex_scarloxy_charset_people1', characterIndex: 5 } });
if (!gate.ok) throw Error(`배지 게이트 실패: ${gate.summary}`);
const caps = await runToolAsync(ctx as never, 'configure_monster_campaign', { obedienceLevelCaps: { enabled: true, caps: [{ badges: 0, maxLevel: 8 }, { badges: 1, maxLevel: 30 }, { badges: 3, maxLevel: 60 }] } });
if (!caps.ok) throw Error(`복종 상한 실패: ${caps.summary}`);
writeFileSync(out, serialize(ctx.project));
writeFileSync(`${out}.gate.json`, JSON.stringify({ mapId: start.id, ...(gate.data as object), gateSummary: gate.summary, capsSummary: caps.summary }, null, 2));
console.log(gate.summary, '|', caps.summary);
