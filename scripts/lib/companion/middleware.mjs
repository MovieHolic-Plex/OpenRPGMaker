import { readRequestJson, writeCompanionResult } from "../companionHttpUtil.mjs";
import { handleCompanionRequest, isCompanionPath } from "../ohMyPiHttp.mjs";
import { createOhMyPiAdapters, stopOhMyPiWorker } from "../ohMyPiPiAi.mjs";

/**
 * 동반 서비스(AI 인증·완성·생성)를 connect 스타일 미들웨어 하나로 만든다 — vite dev/preview 서버와
 * 일렉트론·로컬 서버가 같은 본체를 쓴다(설계 7.4). 라우팅을 모르는 요청은 next() 로 흘려보낸다.
 */
export function createCompanionMiddleware(options = {}) {
  let adaptersPromise = null;
  const getAdapters = () => (adaptersPromise ??= createOhMyPiAdapters());
  const allowedOrigin = options.allowedOrigin ?? null;

  const middleware = async (req, res, next) => {
    if (!isCompanionPath(req.url ?? "")) return next();
    // 일렉트론 렌더러는 app:// 출처라 루프백 동반 서버와 교차 출처다 — 허용 출처를 명시해야 fetch 가 통과한다.
    if (allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      res.setHeader("Vary", "Origin");
    }
    try {
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Oprn-Provider");
        res.end();
        return;
      }
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
