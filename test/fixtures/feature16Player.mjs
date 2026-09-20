// Detached engine contract fixture only; never upsert a project or ship a demo.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { shopFixture } from '../../scripts/qa/runtime/shop-decision-fixtures.mjs';
export async function writeFeature16PlayerFixture() {
  const { project } = await shopFixture('economy', { shopUiPreset: 'split', itemIds: ['item_potion', 'equip_sword'] });
  project.system.menuUiStyle = 'workbench';
  project.session.inventory = { item_potion: 5, item_ether: 2, equip_sword: 1 };
  for (const item of project.database.items) {
    if (['item_potion', 'item_ether'].includes(item.id)) { item.type = 'medicine'; item.occasion = 'field'; }
  }
  const dir = resolve('verify-shots/runtime-qa/_fixtures');
  await mkdir(dir, { recursive: true });
  const path = resolve(dir, 'feature16-player.json');
  await writeFile(path, JSON.stringify(project));
  return path;
}
