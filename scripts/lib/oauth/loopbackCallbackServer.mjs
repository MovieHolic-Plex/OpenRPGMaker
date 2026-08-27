// OAuth 리다이렉트를 한 번만 받는 루프백 서버.
//
// 이 저장소에서 node:http 를 import 해도 되는 유일한 파일이다: OAuth 모듈들(src/ai/oauth/*)은
// 순수 fetch 로 유지해야 브라우저/테스트에서도 돌기 때문에, 소켓을 여는 책임만 여기로 격리했다.
// 127.0.0.1 로 바인드한다 — 0.0.0.0 이면 LAN 의 아무나 인가 코드를 밀어넣을 수 있다.
//
// **바인드가 먼저, 인가 URL 이 나중이다.** 선호 포트가 이미 점유돼 있을 수 있고(실측: 이 개발
// 머신은 51121 을 docker-proxy 가 잡고 있다), 그때는 임의 포트로 붙은 뒤 그 포트로 redirect_uri
// 를 만들어야 한다. Google 은 루프백 리다이렉트의 포트를 고정하지 않는다(RFC 8252 §7.3).
// 포트를 고정해 두면 로그인은 백그라운드에서 EADDRINUSE 로 죽고, 화면에는 성공처럼 보인다.
import { createServer } from "node:http";

const DEFAULT_PORT = 51121;
const DEFAULT_PATH = "/oauth-callback";
const DEFAULT_TIMEOUT_MS = 300_000;
const HOSTNAME = "127.0.0.1";

const PAGE = (title, message) =>
  `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title>` +
  `<style>body{font:16px/1.6 system-ui,sans-serif;margin:0;display:grid;place-items:center;height:100vh;` +
  `background:#14161a;color:#e8eaed}main{text-align:center;padding:24px}h1{font-size:20px;margin:0 0 8px}` +
  `p{margin:0;color:#9aa0a6}</style></head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`;

/** 선호 포트 → 실패하면 임의 포트. resolve 시점에 소켓은 이미 듣고 있다. */
function listenWithFallback(server, preferredPort) {
  return new Promise((resolve, reject) => {
    const onFirstError = (cause) => {
      if (cause.code !== "EADDRINUSE" || preferredPort === 0) {
        reject(new Error(`OAuth callback server failed on ${HOSTNAME}:${preferredPort}: ${cause.message}`));
        return;
      }
      server.once("error", (retryCause) => {
        reject(new Error(`OAuth callback server failed on ${HOSTNAME}: ${retryCause.message}`));
      });
      server.listen(0, HOSTNAME, () => resolve(server.address().port));
    };
    server.once("error", onFirstError);
    server.listen(preferredPort, HOSTNAME, () => {
      server.removeListener("error", onFirstError);
      resolve(server.address().port);
    });
  });
}

/**
 * 콜백 대기를 시작한다. 반환 시점에 포트는 이미 확보돼 있다.
 *
 * @param {{ preferredPort?: number, callbackPath?: string, expectedState?: string, timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<{ port: number, redirectUri: string, waitForCode: Promise<{ code: string, state: string }>, close: () => void }>}
 */
export async function startOAuthCallbackServer(options = {}) {
  const {
    preferredPort = DEFAULT_PORT,
    callbackPath = DEFAULT_PATH,
    expectedState,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
  } = options;

  let settle;
  const waitForCode = new Promise((resolve, reject) => {
    settle = { resolve, reject };
  });
  // 아무도 await 하지 않아도 unhandled rejection 으로 프로세스를 죽이지 않는다.
  waitForCode.catch(() => {});

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${HOSTNAME}`);
    if (url.pathname !== callbackPath) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state") ?? "";
    const error = url.searchParams.get("error");

    let failure;
    if (error) failure = `Authorization failed: ${url.searchParams.get("error_description") ?? error}`;
    else if (!code) failure = "Missing authorization code";
    else if (expectedState && state !== expectedState) failure = "State mismatch - possible CSRF attack";

    // 본문이 **실제로 플러시된 뒤에** 정리한다. res.end() 직후에 소켓을 파괴하면 본문이
    // 나가기 전에 연결이 끊겨 브라우저는 빈 페이지를, HTTP 클라이언트는 영원히 끝나지 않는
    // 응답을 본다(실측: 이 테스트가 120초 동안 매달렸다). end(data, cb) 의 cb 가 그 시점이다.
    if (failure) {
      res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      res.end(PAGE("로그인 실패", failure), () => finish(() => settle.reject(new Error(failure))));
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(PAGE("로그인 완료", "이 탭은 닫아도 됩니다."), () => finish(() => settle.resolve({ code, state })));
  });

  let settled = false;
  let timer;

  function finish(apply) {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
    server.closeAllConnections?.();
    server.close(() => apply());
  }

  function onAbort() {
    finish(() => settle.reject(new Error(String(signal?.reason?.message ?? signal?.reason ?? "aborted"))));
  }

  if (signal?.aborted) {
    onAbort();
    return { port: 0, redirectUri: "", waitForCode, close: () => {} };
  }

  // 바인드가 먼저다. 일반 error 핸들러를 listen 보다 먼저 붙이면 EADDRINUSE 가 그 핸들러와
  // 대체 포트 재시도 양쪽에 도달해, 이미 정리된 것으로 표시된 서버가 새 포트에 다시 바인드되고
  // 아무도 닫지 못한다(실측: 살아 있는 리스닝 소켓이 이벤트 루프를 104초 붙잡았다).
  const port = await listenWithFallback(server, preferredPort);
  signal?.addEventListener("abort", onAbort, { once: true });
  server.on("error", (cause) => finish(() => settle.reject(cause)));

  timer = setTimeout(() => {
    finish(() => settle.reject(new Error(`OAuth callback timed out after ${timeoutMs}ms`)));
  }, timeoutMs);
  timer.unref?.();

  return {
    port,
    redirectUri: `http://localhost:${port}${callbackPath}`,
    waitForCode,
    close: () => finish(() => settle.reject(new Error("OAuth callback server closed"))),
  };
}

export const OAUTH_CALLBACK_DEFAULTS = Object.freeze({
  port: DEFAULT_PORT,
  callbackPath: DEFAULT_PATH,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  hostname: HOSTNAME,
});
