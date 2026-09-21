import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SetupError, runCommand, reportError } from './setup-local.mjs';
import { applyLegacyEnvAliases } from './lib/oprnEnv.mjs';

applyLegacyEnvAliases();

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
    log('이 터미널을 열어 두세요. Ctrl-C로 서버를 종료합니다. 프로젝트는 SQLite 폴더에 저장합니다. 별도 백업은 JSON으로 내보내세요.');
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
  if (process.argv.slice(2).some(arg => arg !== '--no-open')) throw new SetupError('ARGUMENTS', '지원하는 인자는 --no-open뿐입니다. 명령 인자로 키나 접속 정보를 전달하지 마세요.');
  throw new SetupError('STORE_RETIRED', '이 런처의 Supabase 접속은 퇴역했습니다. 있는 project.sqlite 폴더를 npm start -- --project-dir <폴더> 로 여세요. 환경 파일은 바꾸지 않았습니다.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(reportError);
}
