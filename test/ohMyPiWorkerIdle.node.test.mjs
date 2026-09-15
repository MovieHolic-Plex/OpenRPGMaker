import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { connect } from "node:net";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";

// Break: Bun.serve 의 idleTimeout 기본값(10초)이 Pi 진행 스트림을 끊었다. /agent/run 은 턴·툴 호출
// 때만 줄을 쓰므로 모델이 10초 넘게 생각하면 연결이 유휴가 되고, Bun 이 소켓을 닫아 Node fetch 가
// `terminated` 를 던졌다 — 실측(2026-09-14): 팀 모드 "마을 만들어줘" 가 매번 25~110초 만에
// "Pi 에이전트 실패: terminated" 로 끝났고, 워커는 이를 클라이언트 중단으로 오해해 팀장·시공을 전부 abort 했다.
//
// 모델 없이 같은 조건을 만든다: 헤더만 보내고 본문을 보내지 않아 연결을 유휴로 둔다. 기본값이면
// +12초에 닫힌다(실측, 기본·0 두 서버로 대조). 시간 자체가 검사 대상이라 고정 대기를 쓴다.
const IDLE_SECONDS = 14;
const WORKER = fileURLToPath(new URL("../scripts/oh-my-pi-worker.ts", import.meta.url));

describe("oh-my-pi 워커는 유휴 연결을 끊지 않는다", () => {
  let child;
  after(() => child?.kill());

  it(`${IDLE_SECONDS}초 유휴 뒤에도 같은 연결로 요청을 마칠 수 있다`, { timeout: 60_000 }, async () => {
    child = spawn("bun", [WORKER], { env: { ...process.env, OPRN_OH_MY_PI_WORKER_PORT: "0" }, stdio: ["ignore", "pipe", "pipe"] });
    const port = await new Promise((resolve, reject) => {
      child.stdout.on("data", (chunk) => { const match = String(chunk).match(/READY (\d+)/u); if (match) resolve(Number(match[1])); });
      child.on("exit", (code) => reject(new Error(`worker exited (${code})`)));
    });

    const body = JSON.stringify({ request: { task: "t" } }); // project 없음 → 400. 연결이 살아 있음을 응답으로 증명한다.
    const socket = connect(port, "127.0.0.1");
    let closed = false;
    socket.on("close", () => { closed = true; });
    await new Promise((resolve, reject) => { socket.once("connect", resolve); socket.once("error", reject); });
    socket.write(`POST /agent/run HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n`);

    await new Promise((resolve) => setTimeout(resolve, IDLE_SECONDS * 1000));
    assert.equal(closed, false, `유휴 ${IDLE_SECONDS}초 안에 소켓이 닫혔다 — Bun.serve idleTimeout 기본값(10초)이 돌아왔다`);

    const response = await new Promise((resolve, reject) => {
      let text = "";
      socket.on("data", (chunk) => { text += String(chunk); if (/\r\n\r\n[\s\S]*\}/u.test(text)) resolve(text); });
      socket.once("error", reject);
      socket.write(body);
    });
    socket.destroy();
    assert.match(response, /^HTTP\/1\.1 400/u);
    assert.match(response, /request\.project/u);
  });
});
