import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, describe, it } from "node:test";
import { startOAuthCallbackServer } from "../scripts/lib/oauth/loopbackCallbackServer.mjs";

// 이 파일이 지키는 계약: **포트를 먼저 확보하고 그 다음에 인가 URL 을 만든다.**
// 왜 중요한가 (실측): 이 개발 머신은 51121 을 docker-proxy 가 이미 잡고 있다. 포트를 고정하면
// Antigravity 로그인이 EADDRINUSE 로 죽는데, 그 실패는 백그라운드 대기 쪽에서 나므로 화면에는
// "브라우저에서 로그인하세요"만 뜨고 아무리 승인해도 연결되지 않는다.
// Google 은 루프백 리다이렉트에 임의 포트를 허용한다(RFC 8252 §7.3) — 그래서 대체 포트가 정답이다.

const openSockets = [];

after(() => {
  for (const socket of openSockets) socket.close?.();
});

async function post(url) {
  return fetch(url, { redirect: "manual" });
}

describe("OAuth 루프백 콜백 서버", () => {
  it("바인드된 포트와 redirectUri 를 먼저 알려준다", async () => {
    const handle = await startOAuthCallbackServer({ preferredPort: 0, expectedState: "s1" });

    assert.ok(handle.port > 0, `port=${handle.port}`);
    assert.equal(handle.redirectUri, `http://localhost:${handle.port}/oauth-callback`);
    handle.close();
  });

  it("첫 콜백의 code 로 resolve 하고 브라우저에 완료 페이지를 준다", async () => {
    const handle = await startOAuthCallbackServer({ preferredPort: 0, expectedState: "s2" });

    const response = await post(`http://127.0.0.1:${handle.port}/oauth-callback?code=abc123&state=s2`);
    const body = await response.text();
    const result = await handle.waitForCode;

    assert.equal(response.status, 200);
    assert.match(body, /닫아도/);
    assert.equal(result.code, "abc123");
    assert.equal(result.state, "s2");
  });

  it("state 가 다르면 거절한다 (CSRF)", async () => {
    const handle = await startOAuthCallbackServer({ preferredPort: 0, expectedState: "expected" });

    const response = await post(`http://127.0.0.1:${handle.port}/oauth-callback?code=abc&state=attacker`);

    assert.equal(response.status, 400);
    await assert.rejects(() => handle.waitForCode, /State mismatch/);
  });

  it("제공자가 error 를 실어 보내면 그 이유로 거절한다", async () => {
    const handle = await startOAuthCallbackServer({ preferredPort: 0 });

    const response = await post(
      `http://127.0.0.1:${handle.port}/oauth-callback?error=access_denied&error_description=user+said+no`,
    );

    assert.equal(response.status, 400);
    await assert.rejects(() => handle.waitForCode, /user said no/);
  });

  it("다른 경로는 404 로 두고 계속 기다린다", async () => {
    const handle = await startOAuthCallbackServer({ preferredPort: 0, expectedState: "s3" });

    const stray = await post(`http://127.0.0.1:${handle.port}/favicon.ico`);
    assert.equal(stray.status, 404);

    await post(`http://127.0.0.1:${handle.port}/oauth-callback?code=late&state=s3`);
    assert.equal((await handle.waitForCode).code, "late");
  });

  it("선호 포트가 이미 쓰이면 다른 포트로 붙는다 — 로그인이 EADDRINUSE 로 죽지 않는다", async () => {
    const squatter = createServer(() => {});
    openSockets.push(squatter);
    await new Promise((resolve) => squatter.listen(0, "127.0.0.1", resolve));
    const taken = squatter.address().port;

    const handle = await startOAuthCallbackServer({ preferredPort: taken, expectedState: "s4" });

    assert.notEqual(handle.port, taken);
    assert.ok(handle.port > 0);
    assert.equal(handle.redirectUri, `http://localhost:${handle.port}/oauth-callback`);
    handle.close();
  });

  it("close 는 포트를 실제로 놓아준다 — 같은 포트에 다시 바인드된다", async () => {
    const handle = await startOAuthCallbackServer({ preferredPort: 0 });
    const port = handle.port;
    handle.close();
    await assert.rejects(() => handle.waitForCode);

    const again = await startOAuthCallbackServer({ preferredPort: port });
    assert.equal(again.port, port, "포트가 풀리지 않았다면 대체 포트로 밀렸을 것이다");
    again.close();
  });

  it("abort 신호로도 정리된다", async () => {
    const controller = new AbortController();

    const handle = await startOAuthCallbackServer({ preferredPort: 0, signal: controller.signal });
    const port = handle.port;

    controller.abort(new Error("cancelled by user"));
    await assert.rejects(() => handle.waitForCode, /cancelled by user|aborted/);

    const again = await startOAuthCallbackServer({ preferredPort: port });
    assert.equal(again.port, port);
    again.close();
  });

  // OpenAI Codex 는 http://localhost:1455/auth/callback 하나만 허용목록에 두므로 대체 포트가
  // 곧 403 이다. 그래서 이 경로만은 EADDRINUSE 를 삼키지 않고 그대로 올려, 호출부가 디바이스
  // 코드 흐름으로 갈 수 있게 해야 한다.
  it("allowPortFallback:false 는 점유된 포트를 대체하지 않고 EADDRINUSE 를 올린다", async () => {
    const blocker = createServer(() => {});
    await new Promise((resolve) => blocker.listen(0, "127.0.0.1", resolve));
    const busyPort = blocker.address().port;
    openSockets.push(blocker);

    await assert.rejects(
      () => startOAuthCallbackServer({ preferredPort: busyPort, allowPortFallback: false }),
      (error) => {
        assert.equal(error.code, "EADDRINUSE", `code=${error.code}`);
        assert.match(error.message, new RegExp(String(busyPort)));
        return true;
      },
    );

    const moved = await startOAuthCallbackServer({ preferredPort: busyPort });
    assert.notEqual(moved.port, busyPort, "폴백 허용이 기본값이므로 이쪽은 다른 포트로 붙어야 한다");
    moved.close();
    blocker.close();
  });

  // 실측: 이 머신의 `getent hosts localhost` 는 ::1 을 먼저 준다. redirect_uri 의 호스트명이
  // localhost 이므로(Codex 는 허용목록이 그 값으로 고정) IPv4 만 듣고 있으면 브라우저는
  // [::1]:PORT 로 붙고 콜백이 영원히 도착하지 않는다.
  it("localhost 가 ::1 로 풀리는 호스트에서도 콜백을 받는다", async () => {
    const handle = await startOAuthCallbackServer({ preferredPort: 0, expectedState: "v6" });
    assert.ok(handle.hosts.includes("127.0.0.1"), `hosts=${JSON.stringify(handle.hosts)}`);

    const viaIpv6 = handle.hosts.includes("::1");
    const target = viaIpv6
      ? `http://[::1]:${handle.port}/oauth-callback?code=v6code&state=v6`
      : `http://127.0.0.1:${handle.port}/oauth-callback?code=v6code&state=v6`;
    const response = await fetch(target, { redirect: "manual" });
    const result = await handle.waitForCode;

    assert.equal(response.status, 200);
    assert.equal(result.code, "v6code");
  });

  it("redirectUri 의 localhost 이름으로 실제 연결이 된다", async () => {
    // 이름 해석 결과가 무엇이든(127.0.0.1 이든 ::1 이든) 우리가 그 주소를 듣고 있어야 한다.
    const handle = await startOAuthCallbackServer({ preferredPort: 0, expectedState: "name" });

    const response = await fetch(`${handle.redirectUri}?code=namecode&state=name`, { redirect: "manual" });
    const result = await handle.waitForCode;

    assert.equal(response.status, 200);
    assert.equal(result.code, "namecode");
  });
});
