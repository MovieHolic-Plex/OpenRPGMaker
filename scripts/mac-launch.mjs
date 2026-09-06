import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SetupError, requireNode24, ensureDependencies, readConfiguration, validateConfig, probeProject, setupLocal, runCommand, reportError } from './setup-local.mjs';

const ORIGIN = 'http://127.0.0.1:9999';
const openBrowser = url => runCommand(process.platform === 'darwin' ? '/usr/bin/open' : 'xdg-open', [url]);

export async function launchServer({ root, projectId, createServer, open = openBrowser, signals = process, log = console.log }) {
  const url = new URL('/', ORIGIN);
  url.searchParams.set('project', projectId);
  let server; let ready = false; let stopped = false; let closing;
  const completed = Promise.withResolvers();
  // A signal during create/listen is latched: never start or open after cancellation.
  const stop = () => { stopped = true; if (ready) void close(); };
  const close = () => {
    stopped = true;
    if (!closing) closing = (async () => {
      try { if (server) await server.close(); completed.resolve(); }
      catch { completed.reject(new SetupError('CLOSE_FAILED', 'Vite를 정상적으로 종료하지 못했습니다. 이 터미널의 실행 프로세스를 종료한 뒤 다시 시작하세요.')); }
      finally { signals.off('SIGINT', stop); signals.off('SIGTERM', stop); }
    })();
    return closing;
  };
  signals.on('SIGINT', stop); signals.on('SIGTERM', stop);
  try {
    server = await createServer({ root, configLoader: 'runner', mode: 'development', server: { host: '127.0.0.1', port: 9999, strictPort: true, https: false, open: false } });
    if (stopped) throw new SetupError('CANCELLED', '실행을 취소했습니다.');
    await server.listen();
    if (stopped) throw new SetupError('CANCELLED', '실행을 취소했습니다.');
    ready = true;
    log(`RPG Maker 실행 주소: ${url.href}`);
    log('이 터미널을 열어 두세요. Ctrl-C로 서버를 종료합니다. 온라인 저장에는 Supabase 연결이 필요합니다. 별도 백업은 JSON으로 내보내세요.');
    if (open) {
      try { await open(url.href); }
      catch { log(`브라우저를 열지 못했습니다. 아래 주소를 브라우저에서 직접 여세요: ${url.href}`); }
    }
    return { url: url.href, closed: completed.promise, close };
  } catch (error) {
    await close();
    await completed.promise;
    if (error instanceof SetupError) throw error;
    if (error.code === 'EADDRINUSE' || /^Port \d+ is already in use$/.test(error.message)) {
      throw new SetupError('PORT_BUSY', '9999 포트를 다른 프로그램이 사용 중입니다. 브라우저를 열거나 다른 서버를 종료하지 않았습니다. 앞서 실행한 터미널이 있다면 직접 종료한 뒤 다시 시도하세요.');
    }
    throw new SetupError('VITE_START', 'Vite를 실행하지 못했습니다. 폴더 권한과 설치된 패키지를 확인하세요. 기존 node_modules는 그대로 두었습니다. 설치가 손상되었다면 직접 다른 곳으로 옮긴 뒤 npm ci를 실행하세요.');
  }
}

async function main() {
  requireNode24();
  if (process.argv.slice(2).some(arg => arg !== '--no-open')) throw new SetupError('ARGUMENTS', '지원하는 인자는 --no-open뿐입니다. 명령 인자로 키나 접속 정보를 전달하지 마세요.');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  process.chdir(root); // Existing Vite config uses process.cwd() for env precedence.
  await ensureDependencies(root);
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.on('SIGINT', abort); process.on('SIGTERM', abort);
  let config;
  try {
    const existing = await readConfiguration(root);
    if (!existing.url || !existing.anonKey || !existing.projectId) {
      config = await setupLocal({ root, signal: controller.signal });
    } else {
      if (!['1', 'true'].includes(existing.proxy)) throw new SetupError('PROXY_REQUIRED', '개인 설정에 VITE_SUPABASE_USE_PROXY=1과 서버 전용 SUPABASE_ANON_KEY를 지정한 뒤 다시 실행하세요. 기존 파일은 변경하지 않았습니다.');
      config = validateConfig(existing);
      await probeProject(config, { signal: controller.signal });
    }
    if (controller.signal.aborted) throw new SetupError('CANCELLED', '실행을 취소했습니다.');
  } finally { process.off('SIGINT', abort); process.off('SIGTERM', abort); }
  // Override runtime settings only. Never rewrite existing env files, leak a
  // legacy VITE key into the browser, inherit TLS, or reuse a worktree port.
  process.env.DEV_SERVER_NO_TLS = '1';
  process.env.RPG_ZZU_PUBLIC_ORIGIN = ORIGIN;
  process.env.VITE_SUPABASE_ANON_KEY = '';
  // Vite must use exactly the normalized snapshot that passed the probe, even
  // if an env file changes while the request is in flight.
  process.env.SUPABASE_UPSTREAM_URL = config.url;
  process.env.SUPABASE_ANON_KEY = config.anonKey;
  process.env.VITE_SUPABASE_PROJECT_ID = config.projectId;
  process.env.VITE_SUPABASE_USE_PROXY = '1';
  try { await runCommand('bun', ['--version']); }
  catch (error) { if (error instanceof SetupError) throw error; console.log('선택 기능 안내: Bun이 없습니다. 편집과 Node 기반 제공자 로그인은 사용할 수 있습니다. AI 응답 생성에는 Bun과 제공자 설정이 필요합니다. 도구를 자동으로 설치하지 않았습니다.'); }
  let createServer;
  try { ({ createServer } = await import('vite')); }
  catch { throw new SetupError('DEPENDENCIES_BROKEN', 'Vite를 불러올 수 없습니다. 손상된 node_modules를 직접 다른 곳으로 옮긴 뒤 npm ci를 실행하세요.'); }
  const running = await launchServer({ root, projectId: config.projectId, createServer, open: process.argv.includes('--no-open') ? false : openBrowser });
  await running.closed;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(reportError);
}
