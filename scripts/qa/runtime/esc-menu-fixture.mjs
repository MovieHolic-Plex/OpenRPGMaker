// QA-only copy: the historical fixture stores medicines as normalGoods.
// Keep game content untouched and make the input/effect contract explicit here.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export async function writeEscMenuFixture() {
  const project = JSON.parse(await readFile(new URL('../../../test/fixtures/projects/item-runtime-qa-v3.json', import.meta.url), 'utf8'));
  for (const item of project.database.items) {
    if (['item_potion', 'item_ether', 'item_antidote', 'item_wake_herb', 'item_gen2_party_potion'].includes(item.id)) item.type = 'medicine';
  }
  const path = resolve('verify-shots/runtime-qa/_fixtures/esc-menu.json');
  await mkdir(resolve('verify-shots/runtime-qa/_fixtures'), { recursive: true });
  await writeFile(path, JSON.stringify(project));
  return path;
}
