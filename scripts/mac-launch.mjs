import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SetupError, requireNode24, ensureDependencies, readConfiguration, validateConfig, prepareProject, setupLocal, runCommand, reportError } from './setup-local.mjs';
import { withTsModule } from './ontology-ts-loader.mjs';

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
      host: '127.0.0.1', port: 9999, publicOrigin: 'http://127.0.0.1:9999',
      enableOwnerAi: process.env.OPRN_HOST_OWNER_AI === '1' });
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
  let projectDir; let noOpen = false;
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--no-open') noOpen = true;
    else if (argv[index] === '--project-dir' && argv[index + 1] && !argv[index + 1].startsWith('--')) projectDir = argv[++index];
    else throw new SetupError('ARGUMENTS', '지원 인자: --no-open, --project-dir <폴더>');
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  await ensureDependencies(root);
  const config = projectDir ? validateConfig({ projectDir }, root) : await readConfiguration(root) ?? await setupLocal({ root });
  await prepareProject(config);
  await runCommand('npm', ['run', 'build:packaged'], { cwd: root, stdio: 'inherit' });
  await runCommand('npm', ['run', 'build:electron'], { cwd: root, stdio: 'inherit' });
  process.env.OPRN_OH_MY_PI_WORKER_SCRIPT ??= resolve(root, 'scripts/oh-my-pi-worker.ts');
  await withTsModule(resolve(root, 'electron/serve/runtime.ts'), 'oprn-local-host.mjs', async runtime => {
    const running = await launchServer({ root, projectDir: config.projectDir, startServer: runtime.startLocalProjectServer, open: noOpen ? false : openBrowser });
    await running.closed;
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(reportError);
