// 끝난 과제 폴더의 SQLite 정본을 다시 읽어 project.json 을 쓰고 qa:game check 를 돌린다(호스트가 닫힌 뒤에만).
// 사용: node scripts/qa/ai-stress/recheck.mjs <caseDir>...
import { buildTsModule, withTsModule } from '../../ontology-ts-loader.mjs';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const seedFile = resolve(tmpdir(), `oprn-stress-recheck-${process.pid}.mjs`);
await buildTsModule(resolve('scripts/qa/ai-stress/seed-entry.ts'), seedFile);
const S = await import(seedFile);
await withTsModule(resolve('electron/local-store/store.ts'), `stress-recheck-store-${process.pid}.mjs`, async ({ initLocalProjectStore }) => {
  for (const dir of process.argv.slice(2).map(d => resolve(d))) {
    const store = await initLocalProjectStore({ projectDir: dir + '/project' });
    let snapshot;
    try { snapshot = store.loadSnapshot(); } finally { store.close(); }
    await writeFile(dir + '/project.json', S.serialize(snapshot.project));
    const check = spawnSync('bun', ['scripts/qa-game/cli.mts', 'check', '--project', dir + '/project.json'], { encoding: 'utf8', timeout: 600000 });
    await writeFile(dir + '/check.txt', (check.stdout ?? '') + (check.stderr ?? ''));
    const resultFile = dir + '/result.json';
    const result = JSON.parse(await readFile(resultFile, 'utf8'));
    Object.assign(result, { checkExit: check.status, checkHead: (check.stdout ?? '').split('\n').slice(0, 40).join('\n'),
      canonicalReload: { sha256: snapshot.sha256, revision: snapshot.revision } });
    await writeFile(resultFile, JSON.stringify(result, null, 2) + '\n');
    console.log(dir.split('/').at(-1), 'check exit', check.status, 'rev', snapshot.revision);
  }
});
