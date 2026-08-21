// `npm start` = vite preview + the oh-my-pi companion in one process.
//
// 왜 필요한가: dev 서버는 vite.config.ts 의 codexOAuthPlugin 이 /auth/* 와
// /v1/chat/completions 를 same-origin 으로 처리한다. 프로덕션 번들에는 그 플러그인이 없어서
// llmClient.ts 의 DEFAULT_CHATGPT_BASE_URL 이 http://127.0.0.1:17832 로 고정되고, 그 포트를
// 물어줄 프로세스는 동반 서비스뿐이다. preview 만 띄우면 AI 연결이 조용히 전부 실패한다
// (실측: 설정 화면이 "로컬 연결 서비스를 먼저 실행하세요" 로 멈춘다).
//
// 동반 서비스는 import 만으로 서버를 열기 때문에 준비 경합이 없다 — 열린 뒤 preview 를 띄운다.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

await import("./chatgpt-oauth-companion.mjs");

const vite = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const preview = spawn(
  process.execPath,
  [vite, "preview", "--configLoader", "runner", "--host", "127.0.0.1", "--port", "9888", "--strictPort"],
  { stdio: "inherit" },
);

// 종료 사유를 남긴다 — 이게 없으면 preview 가 조용히 exit 1 로 죽어 원인을 못 읽는다.
preview.on("exit", (code, signal) => {
  console.log(`[rpg-zzu] vite preview exited: code=${code ?? "null"} signal=${signal ?? "none"}`);
  process.exit(signal ? 1 : (code ?? 0));
});
preview.on("error", (error) => {
  console.error(`[rpg-zzu] vite preview failed to start: ${error.message}`);
  process.exit(1);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => preview.kill(signal));
}
