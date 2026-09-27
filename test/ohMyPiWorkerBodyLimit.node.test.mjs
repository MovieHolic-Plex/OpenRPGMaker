import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";

// Break: Bun.serve 의 maxRequestBodySize 기본값(128MiB)을 넘는 /agent/run 본문은 응답 없이 소켓이 닫혀
// 호스트 fetch 가 `fetch failed`(EPIPE) 로 끝났다. 실측(2026-09-27): 새 프로젝트 기본 자료가 늘어 몬스터 수집 프리셋
// 팀 첫 생성 요청이 151MB 가 됐고, 브라우저에는 「Pi 에이전트 실행 실패: fetch failed」 만 남았다.
// 모델 없이 같은 조건을 만든다: project 없이 큰 본문을 보내 400(검증 오류) 이 돌아오면 워커가 본문을 받은 것이다.
const BODY_MB = 150;
const WORKER = fileURLToPath(new URL("../scripts/oh-my-pi-worker.ts", import.meta.url));

describe("oh-my-pi 워커는 큰 요청 본문을 받는다", () => {
  let child;
  after(() => child?.kill());

  it(`${BODY_MB}MB 본문에도 응답한다`, { timeout: 60_000 }, async () => {
    child = spawn("bun", [WORKER], { env: { ...process.env, OPRN_OH_MY_PI_WORKER_PORT: "0" }, stdio: ["ignore", "pipe", "pipe"] });
    const port = await new Promise((resolve, reject) => {
      child.stdout.on("data", (chunk) => { const match = String(chunk).match(/READY (\d+)/u); if (match) resolve(Number(match[1])); });
      child.on("exit", (code) => reject(new Error(`worker exited (${code})`)));
    });
    const body = JSON.stringify({ request: { task: "t", pad: "x".repeat(BODY_MB * 1024 * 1024) } });
    const response = await fetch(`http://127.0.0.1:${port}/agent/run`, { method: "POST", headers: { "content-type": "application/json" }, body });
    assert.equal(response.status, 400, "워커가 큰 본문을 받지 못했다 — Bun.serve maxRequestBodySize 기본값(128MiB)이 돌아왔다");
    assert.match(await response.text(), /request\.project/u);
  });
});
