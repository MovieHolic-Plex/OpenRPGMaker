// OAuth 리다이렉트를 한 번만 받는 루프백 서버.
//
// 이 저장소에서 node:http 를 import 해도 되는 유일한 파일이다: OAuth 모듈들
// (src/ai/oauth/*) 은 순수 fetch 로 유지해야 브라우저/테스트에서도 돌기 때문에,
// 소켓을 여는 책임만 여기로 격리했다.
// 127.0.0.1 로 바인드한다 — 0.0.0.0 이면 LAN 의 아무나 인가 코드를 밀어넣을 수 있다.
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

/**
 * 첫 콜백 요청의 { code, state } 로 resolve 하는 일회용 서버.
 *
 * @param {{ port?: number, callbackPath?: string, expectedState?: string, timeoutMs?: number, signal?: AbortSignal }} [options]
 * @returns {Promise<{ code: string, state: string, port: number, redirectUri: string }>}
 */
export function waitForOAuthCallback(options = {}) {
  const {
    port = DEFAULT_PORT,
    callbackPath = DEFAULT_PATH,
    expectedState,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
  } = options;

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://${HOSTNAME}:${port}`);
      if (url.pathname !== callbackPath) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not Found");
        return;
      }

      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state") ?? "";
      const error = url.searchParams.get("error");
      const errorDescription = url.searchParams.get("error_description") ?? error;

      let failure;
      if (error) failure = `Authorization failed: ${errorDescription}`;
      else if (!code) failure = "Missing authorization code";
      else if (expectedState && state !== expectedState) failure = "State mismatch - possible CSRF attack";

      // 응답 본문을 먼저 끝내고 나서 settle 한다 — 서버를 먼저 닫으면 브라우저가 빈 페이지를 본다.
      if (failure) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        res.end(PAGE("로그인 실패", failure));
        finish(() => reject(new Error(failure)));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(PAGE("로그인 완료", "이 탭은 닫아도 됩니다."));
      finish(() => resolve({ code, state, port, redirectUri: `http://localhost:${port}${callbackPath}` }));
    });

    /** 서버/타이머/abort 리스너를 반드시 정리한 뒤 한 번만 settle 한다. */
    function finish(settle) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      server.close(() => settle());
    }

    function onAbort() {
      finish(() => reject(new Error(`OAuth callback aborted: ${String(signal?.reason ?? "aborted")}`)));
    }

    server.on("error", (cause) => {
      finish(() => reject(new Error(`OAuth callback server failed on ${HOSTNAME}:${port}: ${cause.message}`)));
    });

    if (signal?.aborted) {
      // 서버를 열기 전에 이미 취소된 경우: listen 하지 않고 즉시 거절한다.
      settled = true;
      reject(new Error(`OAuth callback aborted: ${String(signal.reason ?? "aborted")}`));
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });

    server.listen(port, HOSTNAME, () => {
      timer = setTimeout(() => {
        finish(() => reject(new Error(`OAuth callback timed out after ${timeoutMs}ms`)));
      }, timeoutMs);
      timer.unref?.();
    });
  });
}

export const OAUTH_CALLBACK_DEFAULTS = Object.freeze({
  port: DEFAULT_PORT,
  callbackPath: DEFAULT_PATH,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  hostname: HOSTNAME,
});
