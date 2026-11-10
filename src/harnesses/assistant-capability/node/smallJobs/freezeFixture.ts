// 작은 일 묶음의 «만든 게임» 픽스처를 얼린다(bun 한 번짜리 — 출처 기록).
//   bun src/harnesses/assistant-capability/node/smallJobs/freezeFixture.ts <저장된 project 폴더> [출력.json.gz]
// 조수(v2)가 실제로 만든 게임의 저장 문서를 읽어, 빈 프로젝트와 같은 칸·타일셋 본문·생성 그림 참조를 빼고 남긴다.
// 픽스처를 얼려 두는 까닭: 도구·빌더를 고치는 동안에도 모든 기준선이 같은 시작 상태에서 재야 비교가 된다.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { createBlankProject } from '../../../../project/defaults';
import { readProjectSqlite } from '../../../../../scripts/content/read-project-sqlite.mts';
import { BUILT_FIXTURE_FILE } from './fixtures';

const [input, output] = process.argv.slice(2);
if (!input) throw Error('freezeFixture <저장된 project 폴더> [출력.json.gz]');
const saved = readProjectSqlite(resolve(input)) as unknown as Record<string, any>;
const blank = createBlankProject() as unknown as Record<string, any>;

// 맵이 쓰는 타일셋은 빈 프로젝트에 있어야 한다 — 픽스처는 타일셋 본문을 싣지 않는다.
const used = [...new Set(Object.values<any>(saved.maps).map(map => map.tilesetId))];
const missing = used.filter(id => !blank.tilesets[id]);
if (missing.length) throw Error(`빈 프로젝트에 없는 타일셋을 쓰는 맵이 있다: ${missing.join(', ')}`);

// 이 게임만의 생성 그림(타이틀·엔딩·얼굴·아이콘)은 커밋하지 않는다(수 MB). 가리키는 칸도 함께 뺀다.
const generated = Object.keys(saved.assets?.uploaded ?? {}).filter(id => !id.startsWith('shared_'));
// 공용 라이브러리 그림(shared_*) 목록과 설치 도장도 뺀다 — 파일 없이 목록만 있으면 편집기가 다시 받지 않는다.
// 비워 두면 빈 프로젝트처럼 첫 부팅에서 다시 설치된다(같은 id).
saved.assets.uploaded = {};
delete saved.meta.bootNormalization;
const dropped: string[] = [];
(function strip(node: any, path: string): void {
  if (!node || typeof node !== 'object') return;
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (typeof value === 'string' && generated.includes(value)) { delete node[key]; dropped.push(`${path}/${key}`); }
    else strip(value, `${path}/${key}`);
  }
})(saved, '');
for (const appearance of saved.database?.characterAppearances ?? []) if (appearance.face && !appearance.face.resourceId) delete appearance.face;

const overlay: Record<string, unknown> = {};
for (const key of Object.keys(saved)) {
  if (key === 'tilesets') continue;
  if (!isDeepStrictEqual(saved[key], blank[key])) overlay[key] = saved[key];
}
const out = resolve(output ?? BUILT_FIXTURE_FILE);
const body = JSON.stringify({ schemaVersion: 1, source: 'assistant v2 whole-game run (GPT 6.1 Terra high), saved project', droppedGeneratedAssets: generated, droppedReferences: dropped, overlay });
writeFileSync(out, gzipSync(body, { level: 9 }));
console.log(`${out}: ${Object.keys(overlay).join(', ')}`);
console.log(`맵 ${Object.keys(saved.maps).length} · 타일셋 ${used.join(', ')} · 뺀 생성 그림 ${generated.length} · 뺀 참조 ${dropped.join(', ') || '-'} · ${(body.length / 1e6).toFixed(2)}MB → gz ${(gzipSync(body, { level: 9 }).length / 1e3).toFixed(0)}KB`);
