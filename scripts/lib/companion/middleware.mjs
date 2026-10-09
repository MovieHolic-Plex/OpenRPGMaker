import { timingSafeEqual } from "node:crypto";
import { readRequestJson, writeCompanionResult } from "../companionHttpUtil.mjs";
import { handleCompanionRequest, isCompanionPath } from "../ohMyPiHttp.mjs";
import { createOhMyPiAdapters, stopOhMyPiWorker } from "../ohMyPiPiAi.mjs";

/**
 * 토큰을 면제하는 유일한 경로. OAuth 는 **탑레벨 내비게이션**이라 커스텀 헤더를 실을 수 없다
 * (Antigravity 는 Google 데스크톱 클라이언트라 redirect_uri 가 127.0.0.1 만 통과한다).
 */
const TOKEN_EXEMPT_PATHS = new Set(["/oauth/launch"]);

function tokenMatches(provided, expected) {
  if (typeof provided !== "string" || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

/**
 * 동반 서비스(AI 인증·완성·생성)를 connect 스타일 미들웨어 하나로 만든다 — vite dev/preview 서버와
 * 일렉트론·로컬 서버가 같은 본체를 쓴다(설계 7.4). 라우팅을 모르는 요청은 next() 로 흘려보낸다.
 *
 * 토큰(설계 7.4): 루프백은 **같은 머신의 다른 프로세스**에게도 열려 있다. 오리진 검사만으로는
 * 부족하다 — 브라우저 밖(curl)은 오리진을 안 보내고, DNS 리바인딩은 오리진을 속일 수 있다.
 * 그 둘 다 사용자의 AI 자격으로 완성을 돌리거나 키를 바꿀 수 있으므로 실행별 토큰을 요구한다.
 * 렌더러는 fetch 로 부르니 헤더를 실을 수 있고, 헤더를 못 실는 OAuth 내비게이션만 면제한다.
 */
export function createCompanionMiddleware(options = {}) {
  let adaptersPromise = null;
  const getAdapters = () => (adaptersPromise ??= createOhMyPiAdapters());
  const allowedOrigin = options.allowedOrigin ?? null;
  const token = typeof options.token === "string" && options.token.length > 0 ? options.token : null;

  const middleware = async (req, res, next) => {
    if (!isCompanionPath(req.url ?? "")) return next();
    // 일렉트론 렌더러는 app:// 출처라 루프백 동반 서버와 교차 출처다 — 허용 출처를 명시해야 fetch 가 통과한다.
    if (allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      // 실행 번호 헤더는 CORS 안전 목록 밖이다 — 노출하지 않으면 app:// 렌더러가 못 읽어 이어 받기 없이 옛 경로로 돈다.
      res.setHeader("Access-Control-Expose-Headers", "X-Oprn-Run-Id");
      res.setHeader("Vary", "Origin");
    }
    const pathname = (req.url ?? "").split("?")[0];
    // 프리플라이트는 **실제 요청 헤더를 싣지 않는다** — 토큰 검사보다 먼저 통과시켜야 한다.
    // 여기서 403 을 주면 브라우저는 본 요청을 아예 보내지 않고, 원인은 `Failed to fetch` 로만 보인다.
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Content-Encoding, X-Oprn-Provider, X-Oprn-Companion-Token");
      res.end();
      return;
    }
    if (token && !TOKEN_EXEMPT_PATHS.has(pathname) && !tokenMatches(req.headers["x-oprn-companion-token"], token)) {
      res.statusCode = 403;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "companion token required" }));
      return;
    }
    try {
      const body = await readRequestJson(req);
      const disconnect = new AbortController();
      res.on("close", () => {
        if (!res.writableFinished) disconnect.abort();
      });
      const result = await handleCompanionRequest(
        { method: req.method, url: req.url, headers: req.headers, body, signal: disconnect.signal },
        await getAdapters(),
      );
      writeCompanionResult(res, result);
    } catch (error) {
      const status = error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : 500;
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : "OAuth companion bridge failed" }));
    }
  };

  middleware.dispose = () => {
    adaptersPromise = null;
    stopOhMyPiWorker();
  };
  return middleware;
}
