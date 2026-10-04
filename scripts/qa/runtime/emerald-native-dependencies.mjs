/** Focused export/AI repair integration controls; no suites or canonical writes. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { withTsModule } from '../../ontology-ts-loader.mjs';
const [canonicalPath, outPath] = process.argv.slice(2);
if (!canonicalPath || !outPath) throw Error('Usage: emerald-native-dependencies.mjs canonical.json output-directory');
const project = JSON.parse(await readFile(canonicalPath, 'utf8'));
const checks = [];
const check = (name, run) => { run(); checks.push({ name, pass: true }); };
await withTsModule(resolve('src/project/webExportAssets.ts'), 'native-export-control.mjs', m => {
  const ids = m.collectUsedUploadedAssetIds(project);
  const trainers = Object.keys(project.assets.uploaded).filter(id => id.startsWith('oprn_emerald_trainer_'));
  check('all17 actual native trainer dependencies survive pruning', () => {
    assert.equal(trainers.length, 17);
    for (const id of trainers) { assert.equal(project.assets.uploaded[id].meta.height, 64); assert(ids.has(id), id); }
  });
  check('actual authored portrait motion survives pruning', () => assert(ids.has(project.meta.oprnOpeningBook.portraitMotion.resourceId)));
  const fixture = { ...project, assets: { ...project.assets, uploaded: { ...project.assets.uploaded } } };
  const picture = height => ({ kind: 'picture', meta: { width: 64, height } });
  fixture.assets.uploaded.oprn_emerald_trainer_legacy_fixture = picture(96);
  fixture.assets.uploaded.oprn_emerald_trainer_invalid_fixture = picture(65);
  fixture.assets.uploaded.unused_native_portrait = picture(64);
  const controls = m.collectUsedUploadedAssetIds(fixture);
  check('explicit legacy64x96 trainer dependency survives pruning', () => assert(controls.has('oprn_emerald_trainer_legacy_fixture')));
  check('invalid trainer shape remains unused', () => assert(!controls.has('oprn_emerald_trainer_invalid_fixture')));
  check('unrelated unreferenced portrait remains unused', () => assert(!controls.has('unused_native_portrait')));
});
await withTsModule(resolve('src/editor/tools/monsterGameTools.ts'), 'native-repair-control.mjs', m => {
  const tool = m.MONSTER_GAME_TOOLS.find(t => t.name === 'build_monster_game');
  const old = structuredClone(project);
  delete old.meta.oprnOpeningBook.portraitMotion;
  old.assets.uploaded.oprn_emerald_professor.meta.height = 96;
  const story = JSON.stringify(old.system.opening);
  const original = JSON.stringify({ session: old.session, start: [old.startMapId, old.startPos] });
  tool.run(old, { mode: 'repair' });
  check('actual AI repair adds native motion to owned professor introduction', () => {
    assert.equal(old.assets.uploaded.oprn_emerald_professor.meta.height, 64);
    assert.equal(old.meta.oprnOpeningBook.portraitMotion.frameWidth, 64);
    assert.equal(old.meta.oprnOpeningBook.portraitMotion.frameHeight, 64);
  });
  check('AI repair preserves authored story and Enter timings', () => assert.equal(JSON.stringify(old.system.opening), story));
  check('AI repair preserves session and start', () => assert.equal(JSON.stringify({ session: old.session, start: [old.startMapId, old.startPos] }), original));
  const custom = structuredClone(project);
  custom.meta.oprnOpeningBook.portraitMotion.fps = 7;
  const book = JSON.stringify(custom.meta.oprnOpeningBook);
  tool.run(custom, { mode: 'repair' });
  check('AI repair preserves an already authored motion controller', () => assert.equal(JSON.stringify(custom.meta.oprnOpeningBook), book));
  const other = structuredClone(project);
  other.meta.oprnOpeningBook.portraitResourceId = 'authored_portrait';
  delete other.meta.oprnOpeningBook.portraitMotion;
  const otherBook = JSON.stringify(other.meta.oprnOpeningBook);
  tool.run(other, { mode: 'repair' });
  check('AI repair preserves a different authored professor portrait', () => assert.equal(JSON.stringify(other.meta.oprnOpeningBook), otherBook));
});
await mkdir(outPath, { recursive: true });
await writeFile(resolve(outPath, 'record.json'), JSON.stringify({ checks, scope: 'Actual resource collector and actual AI repair tool on detached canonical clones. No browser, canonical write, or campaign completion claim.' }, null, 2));
await writeFile(resolve(outPath, 'SUMMARY.md'), '# Native dependencies and AI repair\n\n' + checks.map(c => '- PASS ' + c.name).join('\n') + '\n');
console.log(JSON.stringify({ count: checks.length, output: resolve(outPath) }));
