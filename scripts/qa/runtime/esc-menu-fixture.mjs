// QA-only copy: the historical fixture stores medicines as normalGoods.
// Keep game content untouched and make the input/effect contract explicit here.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export async function writeEscMenuFixture() {
  const project = JSON.parse(await readFile(new URL('../../../test/fixtures/projects/item-runtime-qa-v3.json', import.meta.url), 'utf8'));
  for (const item of project.database.items) {
    if (['item_potion', 'item_ether', 'item_antidote', 'item_wake_herb', 'item_gen2_party_potion'].includes(item.id)) item.type = 'medicine';
  }
  // 이 시나리오는 workbench 스킨(ESC 직후 아이템 미리보기)의 계약이다. 기본 스킨이 pixel 로 바뀐 뒤에도
  // 같은 화면을 검사하도록 명시한다. 도트 창 스킨은 esc-pixel.scenario.mjs 가 본다.
  project.system.menuUiStyle = 'workbench';
  const path = resolve('verify-shots/runtime-qa/_fixtures/esc-menu.json');
  await mkdir(resolve('verify-shots/runtime-qa/_fixtures'), { recursive: true });
  await writeFile(path, JSON.stringify(project));
  return path;
}
