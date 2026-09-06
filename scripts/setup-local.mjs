import { lstatSync, openSync, fchmodSync, writeFileSync, fsyncSync, closeSync, unlinkSync, constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve, sep } from 'node:path';
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
const commandCancelled = () => new SetupError('CANCELLED', '명령을 취소했습니다. 기존 설정과 설치 중 생성된 파일은 그대로 두었습니다. 준비되면 같은 설정 명령을 다시 실행하세요.');
export function runCommand(command, args, { signal, signals = process, spawnProcess = spawn, ...options } = {}) {
  if (signal?.aborted) return Promise.reject(commandCancelled());
  return new Promise((resolveCommand, reject) => {
    const child = spawnProcess(command, args, { shell: false, stdio: 'ignore', ...options });
    let cancelled = false;
    const stop = name => { cancelled = true; child.kill(name); };
    const interrupt = () => stop('SIGINT');
    const terminate = () => stop('SIGTERM');
    const cleanup = () => {
      signals.off('SIGINT', interrupt); signals.off('SIGTERM', terminate);
      signal?.removeEventListener('abort', terminate);
    };
    // A supplied controller owns OS signal forwarding; avoid sending two signals.
    if (!signal) { signals.on('SIGINT', interrupt); signals.on('SIGTERM', terminate); }
    signal?.addEventListener('abort', terminate, { once: true });
    child.once('error', error => { cleanup(); reject(error); });
    child.once('close', (code, exitSignal) => {
      cleanup();
      if (cancelled || exitSignal) reject(commandCancelled());
      else if (code === 0) resolveCommand();
      else reject(new Error('명령 실행에 실패했습니다'));
    });
    // Abort can race with spawning; always wait for close before reporting cancellation.
    if (signal?.aborted) terminate();
  });
}

/** Explicit provisioning only. Never loads env, asks for credentials, or installs npm/system packages. */
export async function setupAiRuntime({ root, signal, run = runCommand, log = console.log } = {}) {
  const checkCancelled = () => { if (signal?.aborted) throw commandCancelled(); };
  checkCancelled();
  let runtimeEntry, cli, executablePath;
  try {
    const project = createRequire(join(root, 'package.json'));
    const testPackage = project.resolve(join(root, 'node_modules/@playwright/test/package.json'));
    const installed = createRequire(testPackage);
    const packagePath = installed.resolve('playwright/package.json');
    // npm may hoist or nest this dependency. Neither NODE_PATH nor a global
    // package is a substitute for the dependency in this installed npm tree.
    const modules = resolve(dirname(testPackage), '../..');
    if (!packagePath.startsWith(modules + sep) || installed(packagePath).version !== installed(testPackage).version) throw new Error('Playwright dependency mismatch');
    runtimeEntry = installed.resolve('playwright');
    cli = resolve(dirname(packagePath), installed(packagePath).bin.playwright);
    executablePath = installed(runtimeEntry).chromium.executablePath();
  } catch {
    throw new SetupError('AI_RUNTIME_PACKAGE', '프로젝트의 Playwright 패키지를 불러올 수 없습니다. 이 폴더에서 npm ci로 잠금 파일의 패키지를 준비한 뒤 npm run setup:ai-runtime을 다시 실행하세요. 기존 설치와 설정은 변경하지 않았습니다.');
  }
  let missing = false;
  try { await access(executablePath, constants.X_OK); }
  catch (error) {
    if (error.code === 'ENOENT') missing = true;
    else throw new SetupError('AI_RUNTIME_ACCESS', '관리형 Chromium 실행 파일에 접근할 수 없습니다. 브라우저 캐시의 파일 권한을 확인한 뒤 npm run setup:ai-runtime을 다시 실행하세요. 파일이나 시스템 패키지는 변경하지 않았습니다.');
  }
  checkCancelled();
  if (missing) {
    log('프로젝트 버전에 맞는 관리형 Chromium을 설치합니다. 네트워크 연결이 필요합니다. Ctrl-C로 취소할 수 있습니다.');
    try { await run(process.execPath, [cli, 'install', 'chromium'], { cwd: root, signal, stdio: 'ignore' }); }
    catch (error) {
      if (signal?.aborted || error?.code === 'CANCELLED') throw commandCancelled();
      throw new SetupError('AI_RUNTIME_INSTALL', 'Chromium 설치에 실패했습니다. 네트워크, 프록시, 브라우저 캐시 권한과 여유 공간을 확인한 뒤 npm run setup:ai-runtime을 다시 실행하세요. 일부 다운로드 파일은 남아 있을 수 있습니다. 시스템 패키지는 설치하지 않았습니다.');
    }
  }
  checkCancelled();
  // A child owns the bounded launch and Playwright signal cleanup. Its raw output
  // stays private: launch/download errors may contain proxy credentials or paths.
  const probe = `
    const { chromium } = require(process.argv[1]);
    let browser;
    try { browser = await chromium.launch({ headless: true, executablePath: process.argv[2], timeout: 15000 }); }
    finally { if (browser) await browser.close(); }
  `;
  try {
    await access(executablePath, constants.X_OK);
    await run(process.execPath, ['--input-type=commonjs', '-e', `(async () => { ${probe} })().catch(() => { process.exitCode = 1; });`, runtimeEntry, executablePath], { cwd: root, signal, stdio: 'ignore' });
  } catch (error) {
    if (signal?.aborted || error?.code === 'CANCELLED') throw commandCancelled();
    throw new SetupError('AI_RUNTIME_PROBE', 'Chromium 실행 확인에 실패했습니다. 지원되는 운영체제인지, 브라우저 캐시 권한과 필요한 OS 라이브러리가 준비되었는지 확인한 뒤 npm run setup:ai-runtime을 다시 실행하세요. 기존 브라우저와 시스템 패키지는 자동 복구하지 않습니다.');
  }
  checkCancelled();
  log(missing ? '관리형 Chromium 설치와 실행 확인을 마쳤습니다. 확인용 브라우저를 종료했습니다.' : '관리형 Chromium 실행 확인을 마쳤습니다. 다운로드 없이 확인용 브라우저를 종료했습니다.');
  return { installed: missing };
}
export async function ensureDependencies(root, run = runCommand) {
  try { await run('npm', ['--version'], { cwd: root }); }
  catch (error) { if (error instanceof SetupError) throw error; throw new SetupError('NPM_MISSING', 'npm이 필요합니다. npm이 포함된 Node.js 24 LTS를 직접 설치한 뒤 터미널을 다시 여세요.'); }
  if (exists(join(root, 'node_modules'))) return;
  try { await run('npm', ['ci'], { cwd: root, stdio: 'inherit' }); }
  catch (error) { if (error instanceof SetupError) throw error; throw new SetupError('INSTALL_FAILED', 'npm ci 설치에 실패했습니다. 네트워크와 폴더 권한을 확인하세요. 설치 중 생성된 node_modules는 그대로 두었습니다. 복구하려면 해당 폴더를 직접 다른 곳으로 옮긴 뒤 npm ci를 다시 실행하세요.'); }
}
export async function readConfiguration(root) {
  let loadEnv;
  try { ({ loadEnv } = await import('vite')); }
  catch { throw new SetupError('DEPENDENCIES_BROKEN', 'Vite를 불러올 수 없습니다. 기존 node_modules는 변경하지 않았습니다. 설치가 손상되었다면 해당 폴더를 직접 다른 곳으로 옮긴 뒤 이 폴더에서 npm ci를 실행하세요.'); }
  let env;
  try { env = loadEnv('development', root, ''); }
  catch { throw new SetupError('CONFIG_IO', '개발용 env 설정 파일을 불러올 수 없습니다. 설정 소유자에게 dotenv 문법과 파일 권한 확인을 요청하세요.'); }
  return {
    url: env.SUPABASE_UPSTREAM_URL ?? env.VITE_SUPABASE_URL ?? '',
    anonKey: env.SUPABASE_ANON_KEY ?? '',
    projectId: env.VITE_SUPABASE_PROJECT_ID ?? '',
    proxy: env.VITE_SUPABASE_USE_PROXY,
  };
}
export function validateConfig({ url, anonKey, projectId }) {
  let origin;
  try { origin = new URL(url); } catch { /* The value-free boundary error below covers parsing too. */ }
  if (!origin || !/^https?:\/\/[^/?#@\\\s]+\/?$/i.test(url) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash
    || !(origin.protocol === 'https:' || (origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)))) {
    throw new SetupError('INVALID_URL', '본인에게 제공된 HTTPS Supabase 기본 주소만 입력하세요. 주소에 계정 정보, 경로, 쿼리 또는 # 조각을 넣을 수 없습니다. HTTP는 이 컴퓨터의 루프백 주소에서만 허용됩니다.');
  }
  let anon = /^sb_publishable_[A-Za-z0-9_-]+$/.test(anonKey);
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(anonKey)) {
    try { anon = JSON.parse(Buffer.from(anonKey.split('.')[1], 'base64url').toString('utf8')).role === 'anon'; }
    catch { anon = false; }
  }
  if (!anon) throw new SetupError('INVALID_KEY', '설정 소유자에게 받은 anon JWT 또는 sb_publishable_ 키를 입력하세요. 관리자, service_role, secret 키나 데이터베이스 접속 정보는 사용할 수 없습니다.');
  if (typeof projectId !== 'string' || !projectId.trim() || projectId.length > 200 || /[\p{C}\\'"`]/u.test(projectId)) {
    throw new SetupError('INVALID_PROJECT', '기존 RPG Maker 작업의 프로젝트 ID를 입력하세요. Supabase 서버의 프로젝트 참조 ID와 다릅니다. 제어 문자, 따옴표, 역슬래시 없이 최대 200자까지 입력할 수 있습니다.');
  }
  return { url: origin.origin, anonKey, projectId: projectId.trim() };
}
export async function probeProject(config, { signal, timeoutMs = 10000 } = {}) {
  const { url, anonKey, projectId } = validateConfig(config);
  const query = new URLSearchParams({ select: 'project_id', project_id: `eq.${projectId}`, limit: '1' });
  const bounded = AbortSignal.timeout(timeoutMs);
  let response;
  try {
    response = await fetch(`${url}/rest/v1/projects?${query}`, {
      method: 'GET', redirect: 'manual', signal: signal ? AbortSignal.any([signal, bounded]) : bounded,
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Accept-Profile': 'rpg_zzu', Accept: 'application/json' },
    });
    if (response.status >= 300 && response.status < 400) throw new SetupError('PROBE_REDIRECT', 'Supabase가 확인 요청을 다른 주소로 돌려보냈습니다. 소유자에게 직접 연결할 HTTPS 기본 주소를 요청하세요. 키를 다른 주소로 전달하지 않았습니다.');
    if ([401, 403].includes(response.status)) throw new SetupError('PROBE_AUTH', 'Supabase가 읽기 접근을 거부했습니다. 소유자에게 anon 키와 해당 프로젝트의 읽기 권한 확인을 요청하세요.');
    if ([400, 404, 406].includes(response.status)) throw new SetupError('PROBE_SCHEMA', 'rpg_zzu 스키마의 projects API에 접근할 수 없습니다. 소유자에게 해당 스키마의 준비와 API 공개 설정을 요청하세요. 이 설정 도구는 마이그레이션을 실행하지 않습니다.');
    if (!response.ok) throw new SetupError('PROBE_SERVER', 'Supabase 서버에서 오류를 반환했습니다. 소유자에게 서버 상태 확인을 요청한 뒤 다시 시도하세요.');
    // Limit both duration and bytes; a remote endpoint must not exhaust local memory.
    const reader = response.body.getReader();
    let body = ''; let size = 0;
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) { await reader.cancel(); throw new SetupError('PROBE_RESPONSE', 'Supabase의 프로젝트 응답이 예상 형식과 다릅니다. 소유자에게 접속 주소 확인을 요청하세요.'); }
      body += decoder.decode(value, { stream: true });
    }
    let rows;
    try { rows = JSON.parse(body + decoder.decode()); }
    catch { throw new SetupError('PROBE_RESPONSE', 'Supabase 응답이 올바른 JSON이 아닙니다. 소유자와 Supabase 기본 주소를 확인하세요.'); }
    if (!Array.isArray(rows)) throw new SetupError('PROBE_RESPONSE', 'Supabase의 프로젝트 응답이 예상 형식과 다릅니다.');
    if (rows.length === 0) throw new SetupError('PROJECT_MISSING', '기존 RPG Maker 프로젝트를 찾을 수 없거나 읽기 권한이 없습니다. 소유자에게 프로젝트 ID와 읽기 권한을 요청하세요. 새 프로젝트를 생성하지 않았습니다.');
    if (rows.length !== 1 || rows[0]?.project_id !== projectId) throw new SetupError('PROBE_RESPONSE', 'Supabase가 요청한 프로젝트 ID를 반환하지 않았습니다. 소유자와 접속 주소를 확인하세요.');
  } catch (error) {
    if (error instanceof SetupError) throw error;
    throw new SetupError('PROBE_NETWORK', 'Supabase에 연결하지 못했거나 응답 시간이 초과되었거나 설정이 취소되었습니다. 네트워크와 TLS 인증서를 확인한 뒤 다시 시도하세요.');
  } finally {
    if (response?.body && !response.body.locked) await response.body.cancel();
  }
}
export function readAnswer(label, { input = process.stdin, output = process.stdout, secret = false, signal } = {}) {
  if (!input.isTTY) return Promise.reject(new SetupError('TTY_REQUIRED', '키를 가려서 입력하려면 대화형 터미널이 필요합니다. 터미널에서 npm run setup:local을 실행하세요. 명령 인자로 키를 전달하지 마세요.'));
  return new Promise((resolveAnswer, reject) => {
    let value = ''; const raw = input.isRaw;
    const finish = (error) => {
      input.off('data', data); input.off('end', cancelled); input.off('error', cancelled);
      signal?.removeEventListener('abort', cancelled);
      input.setRawMode(raw); input.pause(); output.write('\n');
      error ? reject(error) : resolveAnswer(value);
    };
    const cancelled = () => finish(new SetupError('CANCELLED', '설정을 취소했습니다. 설정 파일을 작성하지 않았습니다.'));
    const data = chunk => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003' || character === '\u0004' || character === '\u001b') { cancelled(); return; }
        if (character === '\r' || character === '\n') { finish(); return; }
        if (character === '\u007f' || character === '\b') {
          if (value) { value = [...value].slice(0, -1).join(''); output.write('\b \b'); }
        } else if (!/[\p{C}]/u.test(character)) {
          if (value.length >= 8192) { finish(new SetupError('INPUT_LONG', '입력값이 너무 깁니다. 설정을 취소했습니다.')); return; }
          value += character; output.write(secret ? '*' : character);
        }
      }
    };
    input.setRawMode(true); input.setEncoding('utf8');
    input.on('data', data); input.once('end', cancelled); input.once('error', cancelled);
    signal?.addEventListener('abort', cancelled, { once: true });
    output.write(label); input.resume();
    if (signal?.aborted) cancelled();
  });
}
async function askConfiguration(signal) {
  console.log('본인에게 제공된 Supabase 접속 정보와 기존 RPG Maker 프로젝트를 준비하세요. 이 설정 도구는 읽기 확인만 하며 서버에 데이터를 생성하지 않습니다. Ctrl-C로 취소할 수 있습니다.');
  const url = await readAnswer('Supabase 기본 주소: ', { signal });
  const anonKey = await readAnswer('anon / publishable 키 (입력 숨김): ', { secret: true, signal });
  const projectId = await readAnswer('기존 RPG Maker 프로젝트 ID: ', { signal });
  return { url, anonKey, projectId };
}
export async function setupLocal({ root, ask = askConfiguration, probe = probeProject, signal } = {}) {
  const path = join(root, '.env.local');
  if (exists(path)) throw new SetupError('CONFIG_EXISTS', '.env.local이 이미 있어 변경하지 않았습니다. 소유자에게 설정을 비공개로 수정해 달라고 요청한 뒤 다시 실행하세요.');
  // These override .env.local in Vite. Never silently save settings that will be ignored.
  if (['.env.development', '.env.development.local'].some(name => exists(join(root, name)))
    || ['SUPABASE_UPSTREAM_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PROJECT_ID', 'VITE_SUPABASE_USE_PROXY', 'VITE_SUPABASE_ANON_KEY'].some(name => process.env[name] !== undefined)) {
    throw new SetupError('CONFIG_PRECEDENCE', '개발 모드 설정 파일이나 터미널 환경 변수가 우선 적용됩니다. 소유자에게 해당 설정을 비공개로 수정해 달라고 요청하거나 별도 설정이 없는 폴더와 터미널을 사용하세요. 기존 설정은 변경하지 않았습니다.');
  }
  let config;
  try { config = validateConfig(await ask(signal)); await probe(config, { signal }); }
  catch (error) { if (error instanceof SetupError) throw error; throw new SetupError('SETUP_FAILED', '파일을 작성하기 전에 설정이 실패하거나 취소되었습니다. 제공받은 설정을 확인한 뒤 다시 시도하세요.'); }
  if (signal?.aborted) throw new SetupError('CANCELLED', '설정을 취소했습니다. 설정 파일을 작성하지 않았습니다.');
  const values = { SUPABASE_UPSTREAM_URL: config.url, SUPABASE_ANON_KEY: config.anonKey, VITE_SUPABASE_USE_PROXY: '1', VITE_SUPABASE_PROJECT_ID: config.projectId, VITE_SUPABASE_ANON_KEY: '' };
  // dotenv-expand expands even single-quoted dollars. Escape them for exact Vite round-trip.
  const text = '# 개인용 로컬 설정입니다. 이 파일을 공유하거나 Git에 커밋하지 마세요.\n' + Object.entries(values).map(([name, value]) => `${name}='${value.replaceAll('$', '\\$')}'\n`).join('');
  let fd;
  try {
    fd = openSync(path, 'wx', 0o600);
    fchmodSync(fd, 0o600); // Keep owner access even under a restrictive inherited umask.
    writeFileSync(fd, text); fsyncSync(fd);
  } catch (error) {
    if (fd !== undefined) unlinkSync(path);
    throw new SetupError(error.code === 'EEXIST' ? 'CONFIG_EXISTS' : 'CONFIG_WRITE', error.code === 'EEXIST' ? '설정 중 다른 .env.local 파일이 생성되어 변경하지 않았습니다.' : '개인 설정을 저장하지 못했습니다. 폴더 권한과 남은 저장 공간을 확인한 뒤 다시 시도하세요.');
  } finally { if (fd !== undefined) closeSync(fd); }
  return config;
}
export function reportError(error) {
  console.error(error instanceof SetupError ? `${error.code}: ${error.message}` : 'START_FAILED: 실행에 실패했습니다. 기존 설정은 변경하지 않았습니다. Node 24, 설치된 패키지와 폴더 권한을 확인하세요.');
  process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.on('SIGINT', abort); process.on('SIGTERM', abort);
  try {
    requireNode24();
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 1 || args[0] !== '--ai-runtime')) throw new SetupError('ARGUMENTS', '설정 명령은 인자 없이 실행하거나 --ai-runtime만 지정하세요. 키나 접속 정보를 명령 인자로 전달하지 마세요.');
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    process.chdir(root);
    if (args[0] === '--ai-runtime') {
      await setupAiRuntime({ root, signal: controller.signal });
    } else {
      await ensureDependencies(root);
      await setupLocal({ root, signal: controller.signal });
      console.log('개인 설정 .env.local을 권한 0600으로 저장했습니다. Start RPG Maker.command 또는 npm run mac:launch로 실행하세요.');
    }
  } catch (error) { reportError(error); }
  finally { process.off('SIGINT', abort); process.off('SIGTERM', abort); }
}
