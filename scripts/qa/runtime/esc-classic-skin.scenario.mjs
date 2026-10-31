// 「고전 · 윈도스킨」(system.dialogueStyle = classic) 게임의 ESC 메뉴 첫 화면. 파티 줄(이름·HP/MP/EX)이 겹치지 않아야 한다.
// node scripts/runtime-qa.mjs --scenario esc-classic-skin
// 대조군(유리 기본, 표식 없음): ESC_CLASSIC=0 node scripts/runtime-qa.mjs --scenario esc-classic-skin --out <다른 폴더>
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const classic = process.env.ESC_CLASSIC !== '0';

async function writeFixture() {
  const project = JSON.parse(await readFile(new URL('../../../test/fixtures/projects/item-runtime-qa-v3.json', import.meta.url), 'utf8'));
  delete project.system.menuUiStyle; // 기본 메뉴 스킨(pixel)
  if (classic) project.system.dialogueStyle = 'classic';
  else delete project.system.dialogueStyle;
  const path = resolve(`verify-shots/runtime-qa/_fixtures/esc-classic-skin-${classic ? 'classic' : 'glass'}.json`);
  await mkdir(resolve('verify-shots/runtime-qa/_fixtures'), { recursive: true });
  await writeFile(path, JSON.stringify(project));
  return path;
}

const key = (key, times = 1) => ({ kind: 'key', key, times });
export default {
  id: 'esc-classic-skin',
  projectFixture: await writeFixture(),
  beats: [
    { id: 'title', expect: { testidPresent: ['title-screen'] } },
    { id: 'field', ops: [key('Enter'), { kind: 'waitForRuntime' }], expect: { testidAbsent: ['title-screen'] } },
    { id: 'menu', ops: [key('Escape'), { kind: 'waitFor', testid: 'main-menu', state: 'present' }], expect: { testidPresent: ['main-menu'] }, shot: true },
  ],
};
