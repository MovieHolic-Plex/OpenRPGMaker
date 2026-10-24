#!/usr/bin/env node
// player-server — 여러 qp 세션이 **하나를 같이 쓰는** player-QA vite 서버.
//
// 왜: qp serve 는 기본으로 자기 vite 서버를 띄운다. 한 상자에서 세션 10개를 띄우면 vite dev 서버
// 10개가 같은 node_modules/.vite 캐시를 서로 덮어쓰며 "Failed to scan for dependencies" 로 죽는다
// (AGENTS.md 「Parallel coding agents」 1절의 실측). 서버 하나를 띄워 두고 세션들이 붙게 한다.
//
// 사용:
//   node scripts/qa/play/player-server.mjs [--port 43100] [--cache-dir DIR]
//   → ready http://127.0.0.1:43100   (이 줄이 뜨면 세션을 붙일 수 있다)
//   node scripts/qa/play/qp.mjs serve --game saesol-red --player-url http://127.0.0.1:43100
//
// 이 프로세스가 살아 있는 동안만 유효하다. 죽이면 붙어 있던 세션은 다음 명령에서 실패한다.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

function parseArgs(argv) {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) flags[key] = true;
    else {
      flags[key] = next;
      index += 1;
    }
  }
  return flags;
}

const flags = parseArgs(process.argv.slice(2));
// 기본 포트를 고정한다 — 세션들이 이 주소를 알아야 하므로 매번 다른 포트면 쓸 수 없다.
const port = Number(flags.port ?? 43100);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  process.stderr.write(`player-server: --port 가 이상하다: ${flags.port}\n`);
  process.exit(2);
}
// 캐시 디렉터리도 하나여야 한다. 워크트리 밖(node_modules 공유)이면 호출자가 VITE_CACHE_DIR 로 준다.
if (flags["cache-dir"]) process.env.VITE_CACHE_DIR = resolve(REPO_ROOT, String(flags["cache-dir"]));

const server = await startPlayerQaServer({ port, logLevel: "warn" });
process.stdout.write(`ready ${server.url}\n`);
process.stderr.write(`player-server: ${server.url} (pid ${process.pid}) — qp serve --player-url ${server.url}\n`);

const shutdown = async (reason) => {
  process.stderr.write(`player-server: shutting down (${reason})\n`);
  await server.close().catch(() => undefined);
  process.exit(0);
};
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => void shutdown(signal));
