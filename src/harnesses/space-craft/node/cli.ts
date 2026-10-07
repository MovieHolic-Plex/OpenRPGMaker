import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadSeed, prepare } from './fixture';

const spawnStage = (command: string, file: string, argv: string[]): Promise<number> => new Promise((done, reject) => {
  const child = spawn(command, [resolve('src/harnesses/space-craft/node', file), ...argv], { stdio: 'inherit', cwd: process.cwd() });
  child.once('error', reject); child.once('exit', code => done(code ?? 1));
});

export async function run(argv: string[]): Promise<number> {
  const stage = argv[0];
  const option = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
  const rest = argv.slice(1);
  if (stage === 'list') {
    const seed = loadSeed();
    for (const entry of seed.cases) console.log(`${entry.id}\t${seed.categories[entry.category]?.label}\t${entry.startTileset}\t${entry.prompt}`);
    return 0;
  }
  if (stage === 'prepare') {
    const out = option('out');
    if (!out) throw Error('prepare --out <새 실행 폴더> [--case id] [--repeat N] [--shared-from <pinned shared-content.sqlite>]');
    await prepare(resolve(out), option('case'), option('repeat') ? Number(option('repeat')) : undefined, option('shared-from'));
    return 0;
  }
  if (stage === 'run') return spawnStage(process.execPath, 'run.mjs', rest);
  if (stage === 'measure') return spawnStage('bun', 'measure.mts', rest);
  if (stage === 'sheet') return spawnStage(process.execPath, 'sheet.mjs', rest);
  if (stage === 'status') {
    const out = resolve(option('out') ?? '');
    if (!existsSync(out)) throw Error('status --out <실행 폴더>');
    for (const name of readdirSync(out).filter(d => existsSync(resolve(out, d, 'fixture.json'))).sort()) {
      const result = existsSync(resolve(out, name, 'result.json')) ? JSON.parse(readFileSync(resolve(out, name, 'result.json'), 'utf8')).status : '—';
      const measure = existsSync(resolve(out, name, 'measure.json')) ? JSON.parse(readFileSync(resolve(out, name, 'measure.json'), 'utf8')).status : '—';
      console.log(`${name}\t${result}\t${measure}`);
    }
    return 0;
  }
  throw Error('단계: list | prepare | run | measure | sheet | status');
}
