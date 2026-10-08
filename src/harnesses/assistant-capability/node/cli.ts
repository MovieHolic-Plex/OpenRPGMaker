import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

export async function run(argv: string[]): Promise<number> {
  const stage = argv[0];
  const option = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
  if (stage === 'genre-prepare') {
    const root = option('out');
    if (!root) throw Error('genre-prepare --out <experiment root>');
    const child = spawn('bun', [resolve('src/harnesses/assistant-capability/node/genrePrepare.ts'), resolve(root)], { stdio: 'inherit', cwd: process.cwd() });
    return await new Promise<number>((done, reject) => { child.once('error', reject); child.once('exit', code => done(code ?? 1)); });
  }
  if (stage === 'genre-run') {
    const root = option('out'), caseId = option('case');
    if (!root || !caseId) throw Error('genre-run --out <experiment root> --case <genre>');
    const child = spawn(process.execPath, [resolve('src/harnesses/assistant-capability/node/genreEntry.mjs'), ...argv.slice(1)], { stdio: 'inherit', cwd: process.cwd() });
    return await new Promise<number>((done, reject) => { child.once('error', reject); child.once('exit', code => done(code ?? 1)); });
  }
  if (stage === 'portals' || stage === 'portal-controls' || stage === 'portal-recheck' || (stage === 'review' && option('case') === 'map-portals')) {
    const root = option('out');
    if (!root) throw Error(`${stage} --out <새 실행 폴더>`);
    // Editor tool imports trigger Vite dependency re-optimization in vite-node.
    // Use the same isolated Bun route as buildMonsterFixture.ts.
    const child = spawn('bun', [resolve('src/harnesses/assistant-capability/node/portalEntry.ts'), stage === 'review' ? 'portal-review' : stage, resolve(root), ...argv.slice(1)], { stdio: 'inherit', cwd: process.cwd() });
    return await new Promise<number>((done, reject) => { child.once('error', reject); child.once('exit', code => done(code ?? 1)); });
  }
  if (stage === 'film-worldmaps') {
    const root = option('out');
    if (!root) throw Error('film-worldmaps --out <새 실행 폴더>');
    const { prepareWorldmapProof } = await import('./fixture');
    await prepareWorldmapProof(resolve(root), option('case'));
    const child = spawn(process.execPath, [resolve('src/harnesses/assistant-capability/node/worldmapFilm.mjs'), resolve(root), option('case') ?? 'default,pokemon'], { stdio:'inherit', cwd:process.cwd() });
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
    const { prepare } = await import('./fixture');
    await prepare(resolve(root), option('case')); return 0;
  }
  const child = spawn(process.execPath, [resolve('src/harnesses/assistant-capability/node/runner.mjs'), ...argv], { stdio: 'inherit', cwd: process.cwd() });
  return await new Promise<number>((done, reject) => { child.once('error', reject); child.once('exit', code => done(code ?? 1)); });
}
