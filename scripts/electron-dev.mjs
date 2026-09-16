// Electron 개발 실행: vite dev 서버를 띄우고, 그 주소를 렌더러로 쓰는 Electron 창을 연다.
//
// 왜 스크립트인가: `electron .` 만으로는 렌더러 주소를 모른다. 개발 중에는 매번 빌드한 dist/ 대신
// dev 서버를 띄워야 HMR 이 살고, 그 주소는 워크트리마다 다른 DEV_SERVER_PORT(.env.local)에서 온다.
// 설계서 7.1 의 `npm run electron:dev` 가 이 파일이다.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PORT = 9999;

/** .env.local → .env 순으로 첫 정의를 남긴다. vite.config.ts 의 devServerPort 와 같은 순서다. */
function devServerPort() {
  for (const file of [".env.local", ".env"]) {
    const path = join(REPO_ROOT, file);
    if (!existsSync(path)) continue;
    const match = /^DEV_SERVER_PORT=(\d+)\s*$/m.exec(readFileSync(path, "utf8"));
    if (match) return Number(match[1]);
  }
  return DEFAULT_PORT;
}

const port = devServerPort();
const url = `http://127.0.0.1:${port}/`;

/** dev 서버가 실제로 응답할 때까지 기다린다. 고정 대기는 느린 기계에서 깨지고, 없는 대기는 빈 화면이 된다. */
async function waitForServer(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok || response.status < 500) return true;
    } catch {
      /* 아직 안 떴다 */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function run(command, args, options = {}) {
  return spawn(command, args, { cwd: REPO_ROOT, stdio: "inherit", ...options });
}

const vite = run(process.execPath, [join(REPO_ROOT, "node_modules/vite/bin/vite.js"), "--configLoader", "runner", "--host", "127.0.0.1", "--port", String(port), "--strictPort"]);

const stop = (code) => {
  if (!vite.killed) vite.kill("SIGTERM");
  process.exit(code ?? 0);
};

vite.on("exit", (code) => {
  if (code !== 0) {
    console.error(`[electron:dev] vite dev 서버가 종료됐습니다 (exit=${code})`);
    stop(code ?? 1);
  }
});

if (!(await waitForServer())) {
  console.error(`[electron:dev] dev 서버가 ${url} 에 응답하지 않습니다.`);
  stop(1);
}
console.log(`[electron:dev] 렌더러 ${url}`);

const electron = run(join(REPO_ROOT, "node_modules/.bin/electron"), [".", "--disable-gpu", "--disable-dev-shm-usage"], {
  env: { ...process.env, ELECTRON_RENDERER_URL: url },
});
electron.on("exit", (code) => stop(code ?? 0));
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
