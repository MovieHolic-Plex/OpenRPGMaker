import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SetupError, requireNode24, ensureDependencies, readConfiguration, validateConfig, prepareProject, setupLocal, runCommand, reportError } from './setup-local.mjs';
import { withTsModule } from './ontology-ts-loader.mjs';

// ── 빌드 재사용 판정 ─────────────────────────────────────────────
// 실행할 때마다 build:packaged + build:electron 을 돌리면 1~2분(맥에서는 몇 분)이 걸린다.
// 성공한 빌드 뒤에 입력 지문을 dist/ 안에 남기고, 다음 실행에서 같으면 빌드를 건너뛴다.
// dist/ 에 두는 이유: vite 가 빌드 시작 때 dist/ 를 비우므로 실패·중단된 빌드는 도장까지 지운다.
export const BUILD_STAMP_FILE = 'dist/.oprn-launch-stamp.json';
const BUILD_STAMP_VERSION = 1;
// 빌드 결과에 영향을 주는 입력. vite 플러그인이 scripts/lib 에 있어 함께 본다.
export const BUILD_INPUTS = ['src', 'electron', 'public', 'vendor', 'scripts/lib', 'scripts/build-electron.mjs',
  'index.html', 'benchmark.html', 'start-screen.html', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'tsconfig.app.json'];
const BUILD_OUTPUTS = ['dist/index.html', 'dist-electron/browser-bridge.js'];

// 순수 판정: 강제·결과물 없음·도장 없음/다름이면 빌드한다.
export function decideBuild({ force = false, outputsPresent, previous, current }) {
  if (force) return { build: true, reason: 'forced' };
  if (!outputsPresent) return { build: true, reason: 'missing-output' };
  if (!previous || previous.version !== BUILD_STAMP_VERSION) return { build: true, reason: 'missing-stamp' };
  if (previous.fingerprint !== current.fingerprint) return { build: true, reason: 'changed' };
  return { build: false, reason: 'up-to-date' };
}

function statLine(root, rel) {
  try { const s = statSync(join(root, rel)); return `${rel}\0${s.size}\0${Math.trunc(s.mtimeMs)}`; }
  catch { return `${rel}\0missing`; }
}
function walkStats(root, rel, lines) {
  let entries;
  try { entries = readdirSync(join(root, rel), { withFileTypes: true }); }
  catch { lines.push(statLine(root, rel)); return; }
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const child = `${rel}/${entry.name}`;
    if (entry.isDirectory()) walkStats(root, child, lines);
    else lines.push(statLine(root, child));
  }
}
function gitOutput(root, args) {
  return execFileSync('git', ['-c', 'core.quotepath=off', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
}

// 입력 지문. git 체크아웃이면 HEAD + 입력 경로의 변경 목록(+변경 파일 크기·수정 시각)으로 싸게 구하고,
// zip 으로 받은 폴더처럼 git 이 아니면 입력 파일 전체의 크기·수정 시각을 해시한다(내용은 읽지 않는다).
export function computeBuildFingerprint(root, { git = gitOutput } = {}) {
  const hash = createHash('sha256');
  let mode = 'files';
  try {
    // 압축을 푼 폴더가 우연히 다른 저장소 안에 있으면 그 저장소의 HEAD 를 믿지 않는다.
    const top = git(root, ['rev-parse', '--show-toplevel']).trim();
    if (resolve(top) !== resolve(root)) throw new Error('nested checkout');
    const head = git(root, ['rev-parse', 'HEAD']).trim();
    const status = git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...BUILD_INPUTS]);
    hash.update(`git\0${head}\0${status}`);
    // 이미 더러운 파일을 한 번 더 고치면 status 는 같다 — 크기·시각으로 잡는다.
    for (const record of status.split('\0')) {
      if (record.length > 3) hash.update(`\0${statLine(root, record.slice(3))}`);
    }
    mode = 'git';
  } catch {
    const lines = [];
    for (const rel of BUILD_INPUTS) walkStats(root, rel, lines);
    hash.update(`files\0${lines.join('\n')}`);
  }
  return { version: BUILD_STAMP_VERSION, mode, fingerprint: hash.digest('hex') };
}
export function readBuildStamp(root) {
  try { return JSON.parse(readFileSync(join(root, BUILD_STAMP_FILE), 'utf8')); } catch { return null; }
}
export function buildOutputsPresent(root) {
  return BUILD_OUTPUTS.every(rel => existsSync(join(root, rel)));
}

export async function ensureBuilt(root, { force = false, run = runCommand, log = console.log, fingerprint = computeBuildFingerprint } = {}) {
  const current = fingerprint(root);
  const decision = decideBuild({ force, outputsPresent: buildOutputsPresent(root), previous: readBuildStamp(root), current });
  if (!decision.build) { log('이전 빌드를 그대로 씁니다.'); return decision; }
  log('앱을 준비하는 중입니다(처음 한 번은 1~2분 걸려요)…');
  await run('npm', ['run', 'build:packaged'], { cwd: root, stdio: 'inherit' });
  await run('npm', ['run', 'build:electron'], { cwd: root, stdio: 'inherit' });
  // 빌드가 둘 다 성공했을 때만 도장을 남긴다. 지문은 빌드 전에 잰 값(빌드 중 수정은 다음 실행이 다시 짓는다).
  writeFileSync(join(root, BUILD_STAMP_FILE), `${JSON.stringify(current)}\n`);
  return decision;
}

const openBrowser = url => runCommand(process.platform === 'darwin' ? '/usr/bin/open' : 'xdg-open', [url]);

export async function launchServer({ root, projectDir, startServer, open = openBrowser, signals = process, log = console.log }) {
  let server; let stopping = false; let closing;
  const completed = Promise.withResolvers();
  void completed.promise.catch(() => {});
  const stop = () => { stopping = true; if (server) void close(); };
  const cleanup = () => { signals.off('SIGINT', stop); signals.off('SIGTERM', stop); };
  const close = () => closing ??= (async () => {
    try { await server?.close(); completed.resolve(); }
    catch (error) { completed.reject(error); }
    finally { cleanup(); }
  })();
  signals.on('SIGINT', stop); signals.on('SIGTERM', stop);
  try {
    server = await startServer({ projectDir, distDir: resolve(root, 'dist'),
      browserBridgeSource: readFileSync(resolve(root, 'dist-electron/browser-bridge.js'), 'utf8'),
      // 루프백 전용 개인 모드. publicOrigin 을 주면 공유 호스트로 분류되어 AI 가 꺼진다.
      host: '127.0.0.1', port: 9999 });
    if (stopping) { await close(); throw new SetupError('CANCELLED', '실행을 취소했습니다.'); }
    log(`OPRN 실행 주소: ${server.url}`);
    log(`저장 폴더: ${projectDir}. 이 터미널을 열어 두세요. 종료: Ctrl-C`);
    if (open) {
      try { await open(server.url); }
      catch { log(`브라우저에서 직접 여세요: ${server.url}`); }
    }
    return { url: server.url, closed: completed.promise, close };
  } catch (error) {
    await close(); await completed.promise;
    if (error?.code === 'EADDRINUSE') throw new SetupError('PORT_BUSY', '9999 포트를 다른 프로그램이 사용 중입니다. 기존 서버는 그대로 두었습니다.');
    throw error;
  }
}

export async function main(argv = process.argv.slice(2)) {
  requireNode24();
  let projectDir; let noOpen = false; let rebuild = false;
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--no-open') noOpen = true;
    else if (argv[index] === '--rebuild') rebuild = true;
    else if (argv[index] === '--project-dir' && argv[index + 1] && !argv[index + 1].startsWith('--')) projectDir = argv[++index];
    else throw new SetupError('ARGUMENTS', '지원 인자: --no-open, --rebuild, --project-dir <폴더>');
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  await ensureDependencies(root);
  const config = projectDir ? validateConfig({ projectDir }, root) : await readConfiguration(root) ?? await setupLocal({ root });
  await prepareProject(config);
  await ensureBuilt(root, { force: rebuild });
  process.env.OPRN_OH_MY_PI_WORKER_SCRIPT ??= resolve(root, 'scripts/oh-my-pi-worker.ts');
  await withTsModule(resolve(root, 'electron/serve/runtime.ts'), 'oprn-local-host.mjs', async runtime => {
    const running = await launchServer({ root, projectDir: config.projectDir, startServer: runtime.startLocalProjectServer, open: noOpen ? false : openBrowser });
    await running.closed;
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(reportError);
