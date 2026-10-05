import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { prepare, prepareWorldmapProof } from './fixture';

export async function run(argv: string[]): Promise<number> {
  const stage = argv[0];
  const option = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
  if (stage === 'film-worldmaps') {
    const root = option('out');
    if (!root) throw Error('film-worldmaps --out <새 실행 폴더>');
    await prepareWorldmapProof(resolve(root));
    const child = spawn(process.execPath, [resolve('src/harnesses/assistant-capability/node/worldmapFilm.mjs'), resolve(root)], { stdio:'inherit', cwd:process.cwd() });
    return await new Promise<number>((done,reject)=>{child.once('error',reject);child.once('exit',code=>done(code??1));});
  }
  if (stage === 'self-check-tools' || stage === 'discover-tools') {
    const { checkTools, discoverTools } = await import('./toolRegression');
    const root=resolve(option('out') ?? 'qa-runs/harnesses/assistant-capability/tool-controls');
    return stage==='discover-tools'?discoverTools(root):checkTools(root);
  }
  if (stage === 'prepare') {
    const root = option('out');
    if (!root) throw Error('prepare --out <새 실행 폴더> [--case <id>]');
    await prepare(resolve(root), option('case')); return 0;
  }
  const child = spawn(process.execPath, [resolve('src/harnesses/assistant-capability/node/runner.mjs'), ...argv], { stdio: 'inherit', cwd: process.cwd() });
  return await new Promise<number>((done, reject) => { child.once('error', reject); child.once('exit', code => done(code ?? 1)); });
}
