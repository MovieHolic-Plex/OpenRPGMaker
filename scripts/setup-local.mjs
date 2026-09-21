import { lstatSync, openSync, fchmodSync, writeFileSync, fsyncSync, closeSync, unlinkSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

// Only these value-free errors may reach the terminal. Remote bodies and causes
// can contain credentials, so never include them in error messages or stacks.
export class SetupError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
export function requireNode24(version = process.versions.node) {
  if (!/^24\./.test(version)) throw new SetupError('NODE_VERSION', 'Node.js 24 LTS와 npm이 필요합니다. https://nodejs.org 에서 직접 설치한 뒤 터미널을 다시 여세요. 도구를 자동으로 설치하지 않았습니다.');
}
function exists(path) {
  try { lstatSync(path); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw new SetupError('CONFIG_IO', '이 폴더를 읽을 수 없습니다. 본인이 쓰기 권한을 가진 폴더에 압축을 풀어 주세요.'); }
}
export function runCommand(command, args, options = {}) {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(command, args, { shell: false, stdio: 'ignore', ...options });
    const interrupt = () => child.kill('SIGINT');
    const terminate = () => child.kill('SIGTERM');
    const cleanup = () => { process.off('SIGINT', interrupt); process.off('SIGTERM', terminate); };
    process.on('SIGINT', interrupt); process.on('SIGTERM', terminate);
    child.once('error', error => { cleanup(); reject(error); });
    child.once('close', (code, signal) => {
      cleanup();
      if (signal) reject(new SetupError('CANCELLED', '명령을 취소했습니다. 기존 설치 파일과 설치 중 생성된 파일은 그대로 두었습니다.'));
      else if (code === 0) resolveCommand();
      else reject(new Error('명령 실행에 실패했습니다'));
    });
  });
}
export async function ensureDependencies(root, run = runCommand) {
  try { await run('npm', ['--version'], { cwd: root }); }
  catch (error) { if (error instanceof SetupError) throw error; throw new SetupError('NPM_MISSING', 'npm이 필요합니다. npm이 포함된 Node.js 24 LTS를 직접 설치한 뒤 터미널을 다시 여세요.'); }
  if (exists(join(root, 'node_modules'))) return;
  try { await run('npm', ['ci'], { cwd: root, stdio: 'inherit' }); }
  catch (error) { if (error instanceof SetupError) throw error; throw new SetupError('INSTALL_FAILED', 'npm ci 설치에 실패했습니다. 네트워크와 폴더 권한을 확인하세요. 설치 중 생성된 node_modules는 그대로 두었습니다. 복구하려면 해당 폴더를 직접 다른 곳으로 옮긴 뒤 npm ci를 다시 실행하세요.'); }
}
const SETTINGS_FILE = '.oprn-local.json';
export async function readConfiguration(root, env = process.env) {
  if (env.OPRN_PROJECT_DIR) return validateConfig({ projectDir: env.OPRN_PROJECT_DIR }, root);
  const path = join(root, SETTINGS_FILE);
  if (!existsSync(path)) return null;
  try { return validateConfig(JSON.parse(readFileSync(path, 'utf8')), root); }
  catch { throw new SetupError('CONFIG_IO', '개인 프로젝트 설정을 읽을 수 없습니다. .oprn-local.json의 projectDir과 폴더 권한을 확인하세요.'); }
}
export function validateConfig({ projectDir }, root = process.cwd()) {
  if (typeof projectDir !== 'string' || !projectDir.trim() || /[\p{C}]/u.test(projectDir)) {
    throw new SetupError('INVALID_PROJECT', '프로젝트를 저장할 폴더 경로가 필요합니다.');
  }
  return { projectDir: resolve(root, projectDir.trim()) };
}
export async function prepareProject(config, { initialize, open } = {}) {
  if (!initialize || !open) {
    const { withTsModule } = await import('./ontology-ts-loader.mjs');
    return withTsModule(fileURLToPath(new URL('../electron/local-store/store.ts', import.meta.url)), 'oprn-local-store.mjs',
      module => prepareProject(config, { initialize: module.initLocalProjectStore, open: module.openLocalProjectStore }));
  }
  let store;
  if (existsSync(config.projectDir)) {
    if (!existsSync(join(config.projectDir, 'project.sqlite'))) {
      throw new SetupError('PROJECT_MISSING', '기존 폴더에 project.sqlite가 없습니다. 올바른 프로젝트 폴더 또는 아직 없는 새 폴더를 지정하세요.');
    }
    store = await open(config);
  } else {
    store = await initialize(config);
  }
  try { return store.info(); } finally { store.close(); }
}
async function askConfiguration() {
  const { createInterface } = await import('node:readline/promises');
  if (!process.stdin.isTTY) throw new SetupError('TTY_REQUIRED', 'OPRN_PROJECT_DIR을 설정하거나 대화형 터미널에서 npm run setup:local을 실행하세요.');
  const input = createInterface({ input: process.stdin, output: process.stdout });
  try { return { projectDir: await input.question('기존 프로젝트 폴더 또는 새로 만들 폴더 경로: ') }; }
  finally { input.close(); }
}
export async function setupLocal({ root, ask = askConfiguration, prepare = prepareProject, signal } = {}) {
  const path = join(root, SETTINGS_FILE);
  if (exists(path)) throw new SetupError('CONFIG_EXISTS', '.oprn-local.json이 이미 있습니다. 기존 설정을 유지했습니다.');
  const config = validateConfig(await ask(signal), root);
  signal?.throwIfAborted();
  await prepare(config);
  signal?.throwIfAborted();
  let fd;
  try {
    fd = openSync(path, 'wx', 0o600); fchmodSync(fd, 0o600);
    writeFileSync(fd, JSON.stringify(config, null, 2) + '\n'); fsyncSync(fd);
  } catch (error) {
    if (fd !== undefined) unlinkSync(path);
    throw new SetupError('CONFIG_WRITE', '프로젝트 설정을 저장하지 못했습니다. 기존 프로젝트 데이터는 유지했습니다.');
  } finally { if (fd !== undefined) closeSync(fd); }
  return config;
}
export function reportError(error) {
  console.error(error instanceof SetupError ? `${error.code}: ${error.message}` : 'START_FAILED: 실행에 실패했습니다. Node 24, 프로젝트 폴더와 설치 상태를 확인하세요.');
  process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  try { requireNode24(); await ensureDependencies(root); await setupLocal({ root }); console.log('프로젝트 설정 완료. npm run mac:launch로 여세요.'); }
  catch (error) { reportError(error); }
}
