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
  // 장면 교훈 묶음(scene-lessons-seed.json): genre-prepare/genre-run 으로 실행한 뒤 채점·영상·판정 입력.
  if (stage === 'scene-score' || stage === 'scene-film' || stage === 'scene-judge-input') {
    const script = { 'scene-score': 'sceneLessons.mjs', 'scene-film': 'sceneFilm.mjs', 'scene-judge-input': 'sceneJudgePrompt.mjs' }[stage];
    const args = stage === 'scene-score' ? ['score', ...argv.slice(1)] : argv.slice(1);
    const child = spawn(process.execPath, [resolve('src/harnesses/assistant-capability/node', script), ...args], { stdio: 'inherit', cwd: process.cwd() });
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
  if (stage === 'matrix') {
    const child = spawn(process.execPath, [resolve('src/harnesses/assistant-capability/node/commandMatrix.mjs'), ...argv.slice(1)], { stdio: 'inherit', cwd: process.cwd() });
    return await new Promise<number>((done, reject) => { child.once('error', reject); child.once('exit', code => done(code ?? 1)); });
  }
  if (stage === 'matrix-tools') {
    const root = option('out');
    if (!root) throw Error('matrix-tools --out <새 실행 폴더>');
    const child = spawn('bun', [resolve('src/harnesses/assistant-capability/node/matrixToolsEntry.ts'), resolve(root)], { stdio: 'inherit', cwd: process.cwd() });
    return await new Promise<number>((done, reject) => { child.once('error', reject); child.once('exit', code => done(code ?? 1)); });
  }
  if (stage === 'matrix-live') {
    const root = option('out');
    if (!root) throw Error('matrix-live --out <새 실행 폴더>');
    const child = spawn('bun', [resolve('src/harnesses/assistant-capability/node/matrixLiveEntry.ts'), resolve(root)], { stdio: 'inherit', cwd: process.cwd() });
    return await new Promise<number>((done, reject) => { child.once('error', reject); child.once('exit', code => done(code ?? 1)); });
  }
  if (stage === 'matrix-ui-all') {
    const root = option('out');
    if (!root) throw Error('matrix-ui-all --out <새 실행 폴더>');
    const child = spawn('bun', [resolve('src/harnesses/assistant-capability/node/matrixUiAllEntry.ts'), resolve(root)], { stdio: 'inherit', cwd: process.cwd() });
    return await new Promise<number>((done, reject) => { child.once('error', reject); child.once('exit', code => done(code ?? 1)); });
  }
  if (stage === 'matrix-native') {
    const root = option('out');
    if (!root) throw Error('matrix-native --out <새 실행 폴더>');
    const child = spawn('bun', [resolve('src/harnesses/assistant-capability/node/matrixNativeEntry.ts'), resolve(root)], { stdio: 'inherit', cwd: process.cwd() });
    return await new Promise<number>((done, reject) => { child.once('error', reject); child.once('exit', code => done(code ?? 1)); });
  }
  if (stage === 'matrix-score') {
    const root = option('out');
    if (!root) throw Error('matrix-score --out <새 실행 폴더>');
    const child = spawn('bun', [resolve('src/harnesses/assistant-capability/node/matrixScoreEntry.ts'), resolve(root)], { stdio: 'inherit', cwd: process.cwd() });
    return await new Promise<number>((done, reject) => { child.once('error', reject); child.once('exit', code => done(code ?? 1)); });
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
