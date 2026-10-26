// vitest.browser.config.ts 의 globalSetup.
//
// 왜 필요한가(2026-10-26 실측): 브라우저 축의 세 테스트 중 둘(battleStyleWarmup·titleEffectsShader)이
// scripts/bench/*.mts 를 spawn 하는데, 그 bench 들은 player QA 서버를 **따로 띄워 두라고** 전제한다
// (`start server separately`, PLAYER_QA_URL 기본 9944). CI 는 그 서버를 띄우지 않아
// `page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:9944/player.html` 로 죽었고,
// browser 축은 기준선과 무관하게 회귀로 계산되므로(verify-gates.mjs:453) ci-full 이 빨개졌다.
//
// 포트는 9944 를 먼저 시도한다 — bench 의 기본값과 같아서, 혹시 워커가 이 env 를 물려받지 못해도
// 그대로 동작한다. 이미 쓰이고 있으면(개발 상자에서 다른 QA 서버가 떠 있으면) 빈 포트로 물러나고
// PLAYER_QA_URL 로 알린다.
import { startPlayerQaServer } from "../../scripts/lib/runtimeQaRun.mjs";

let running = null;

export async function setup() {
  try {
    running = await startPlayerQaServer({ port: 9944 });
  } catch {
    running = await startPlayerQaServer();
  }
  process.env.PLAYER_QA_URL = running.url;
}

export async function teardown() {
  const server = running;
  running = null;
  await server?.close();
}
