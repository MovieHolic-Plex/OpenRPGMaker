#!/usr/bin/env node
// 브라우저 탭에서 로컬 폴더 정본(project.sqlite)을 여는 로컬 서버.
// 렌더러는 일렉트론과 **같은** 저장소 어댑터를 쓰고, 전송로만 IPC 대신 HTTP 다.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { withTsModule } from "./ontology-ts-loader.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUNTIME_ENTRY = resolve(REPO_ROOT, "electron/serve/runtime.ts");

const USAGE = [
  "Usage:",
  "  node scripts/oprn-serve.mjs --project-dir <dir> [--port <n>] [--host <address> --public-origin <url>] [--dist <dir>] [--bridge <file>]",
  "",
  "브라우저에서 로컬 폴더 정본을 연다. 렌더러는 일렉트론과 같은 어댑터를 쓰고 전송로만 HTTP 다.",
].join("\n");

function parseArgs(argv) {
  const options = { projectDir: undefined, port: 0, distDir: resolve(REPO_ROOT, "dist"), bridgePath: resolve(REPO_ROOT, "dist-electron/browser-bridge.js") };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--project-dir") options.projectDir = value;
    else if (flag === "--host") options.host = value;
    else if (flag === "--public-origin") options.publicOrigin = value;
    else if (flag === "--port") options.port = Number(value);
    else if (flag === "--dist") options.distDir = value;
    else if (flag === "--bridge") options.bridgePath = value;
    else if (flag === "--help" || flag === "-h") return { help: true };
    else throw new Error(`알 수 없는 인자: ${flag}`);
    index += 1;
  }
  if (!options.projectDir) throw new Error("--project-dir 가 필요합니다");
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) throw new Error("--port 는 0 이상의 정수여야 합니다");
  return options;
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  process.stdout.write(`${USAGE}\n`);
  process.exit(0);
}

const indexPath = resolve(options.distDir, "index.html");
if (!existsSync(indexPath)) throw new Error(`렌더러 번들이 없습니다: ${indexPath} — \`npm run build:fast\` 를 먼저 돌리세요.`);
if (!existsSync(options.bridgePath)) throw new Error(`브라우저 브리지가 없습니다: ${options.bridgePath} — \`npm run build:electron\` 을 먼저 돌리세요.`);

const browserBridgeSource = readFileSync(options.bridgePath, "utf8");

process.env.OPRN_OH_MY_PI_WORKER_SCRIPT ??= resolve(REPO_ROOT, "scripts/oh-my-pi-worker.ts");
// The TypeScript server is bundled in /tmp; its import.meta.url cannot locate repository content.
process.env.OPRN_WORLDMAP_KIT ??= resolve(REPO_ROOT, "tiledata/worldmap-kit");

await withTsModule(RUNTIME_ENTRY, "oprn-serve-runtime.mjs", async (runtime) => {
  const server = await runtime.startLocalProjectServer({
    projectDir: options.projectDir,
    distDir: options.distDir,
    browserBridgeSource,
    port: options.port,
    host: options.host,
    publicOrigin: options.publicOrigin,
    enableOwnerAi: process.env.OPRN_HOST_OWNER_AI === "1",
  });
  if (server.ownerAccessCode) {
    const accessPath = resolve(options.projectDir, '.oprn-host-access');
    process.stdout.write(`팀 소유자 접속 코드 파일: ${accessPath} (외부 공유·백업에 포함하지 마세요)\n`);
  }
  process.stdout.write(`OPRN 로컬 편집기: ${server.url}\n`);
  process.stdout.write(`프로젝트 폴더: ${server.projectDir}\n`);
  process.stdout.write("브라우저에서 위 주소를 열면 이 폴더가 정본입니다. 종료: Ctrl+C\n");

  await new Promise((resolvePromise) => {
    const stop = () => {
      void server.close().then(resolvePromise);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });
});
