import { writeEscMenuFixture } from './esc-menu-fixture.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function writeEscItemEmptyFixture() {
  const source = await writeEscMenuFixture();
  const project = JSON.parse(await readFile(source, 'utf8'));
  project.session.inventory = {};
  const path = resolve('verify-shots/runtime-qa/_fixtures/esc-item-empty.json');
  await mkdir(resolve('verify-shots/runtime-qa/_fixtures'), { recursive: true });
  await writeFile(path, JSON.stringify(project));
  return path;
}

export async function writeEscItemLongListFixture() {
  const source = await writeEscMenuFixture();
  const project = JSON.parse(await readFile(source, 'utf8'));
  project.session.inventory ??= {};
  for (const item of project.database.items ?? []) {
    if (item?.id) project.session.inventory[item.id] = Math.max(project.session.inventory[item.id] ?? 0, 1);
  }
  const path = resolve('verify-shots/runtime-qa/_fixtures/esc-item-long-list.json');
  await mkdir(resolve('verify-shots/runtime-qa/_fixtures'), { recursive: true });
  await writeFile(path, JSON.stringify(project));
  return path;
}
