// `npm start` = vite preview. Auth/completions 은 vite.config.ts 의 configurePreviewServer
// 가 페이지와 같은 오리진(/auth, /v1)에 붙인다. 예전처럼 127.0.0.1:17832 동반 서비스를
// 따로 열지 않는다 — Tailscale(`mdc-server:9888`) 탭이 사용자 PC 루프백을 치면 안 되기 때문이다.
// 단독 동반 서비스가 필요하면 `npm run ai:oauth`.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(root, "..");

function envFileValue(name) {
  for (const file of [join(repoRoot, ".env.local"), join(repoRoot, ".env")]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      if (line.startsWith(`${name}=`)) {
        return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
      }
    }
  }
  return "";
}

// 0.0.0.0:9888 은 Tailscale(`mdc-server`) 에서 연다. Origin/Host 가 빠져도
// 로그인 시작 URL 이 127.0.0.1 로 새지 않게 공개 origin 을 고정한다.
const publicOrigin = process.env.RPG_ZZU_PUBLIC_ORIGIN
  || envFileValue("RPG_ZZU_PUBLIC_ORIGIN")
  || "http://mdc-server:9888";
console.log(`[oprn] preview public origin ${publicOrigin}`);

const vite = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const preview = spawn(
  process.execPath,
  [vite, "preview", "--configLoader", "runner", "--host", "0.0.0.0", "--port", "9888", "--strictPort"],
  { stdio: "inherit", env: { ...process.env, RPG_ZZU_PUBLIC_ORIGIN: publicOrigin } },
);

// 종료 사유를 남긴다 — 이게 없으면 preview 가 조용히 exit 1 로 죽어 원인을 못 읽는다.
preview.on("exit", (code, signal) => {
  console.log(`[oprn] vite preview exited: code=${code ?? "null"} signal=${signal ?? "none"}`);
  process.exit(signal ? 1 : (code ?? 0));
});
preview.on("error", (error) => {
  console.error(`[oprn] vite preview failed to start: ${error.message}`);
  process.exit(1);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => preview.kill(signal));
}
