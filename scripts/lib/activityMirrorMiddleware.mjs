import { ACTIVITY_MIRROR_LIMITS, handleActivityMirror, isActivityMirrorPath } from "./activityMirror.mjs";

/**
 * node `req`/`res` 미들웨어 어댑터. vite dev·preview 와 `oprn-serve` 가 이걸 쓴다.
 *
 * 본문을 다 읽은 뒤에 코어를 부르는 이유: 편집 배치는 상한 초과를 **파싱 전에** 끊어야 하는데
 * 코어가 상한을 알고 있으므로, 여기서는 스트림을 모아 바이트 수와 함께 넘기기만 한다.
 * 상한을 넘긴 뒤로는 chunks 를 버려 메모리를 잡지 않는다.
 */
export function createActivityMirrorMiddleware(options = {}) {
  const baseDir = options.baseDir ?? process.cwd();
  // 허용 출처는 두 가지로 준다 — 고정 문자열(앱의 app://oprn) 또는 요청을 보고 정하는 함수
  // (vite 는 같은 머신의 localhost/개임포트만 허용한다).
  const fixedOrigin = typeof options.allowedOrigin === "string" ? options.allowedOrigin : null;
  const resolveOrigin = typeof options.corsOrigin === "function" ? options.corsOrigin : null;
  const corsOrigin = (req) => fixedOrigin ?? resolveOrigin?.(req) ?? null;

  return function activityMirror(req, res, next) {
    if (!isActivityMirrorPath(req.url ?? "")) return next();

    const origin = corsOrigin(req);
    const withCors = (headers = {}) => {
      if (!origin) return headers;
      return { ...headers, "access-control-allow-origin": origin, vary: "Origin" };
    };

    if (req.method === "OPTIONS") {
      res.writeHead(204, withCors({
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "Content-Type",
      }));
      res.end();
      return;
    }

    const finish = (result) => {
      const headers = withCors(result.contentType ? { "content-type": result.contentType } : {});
      res.writeHead(result.status, headers);
      res.end(result.body);
    };

    if (req.method === "GET") {
      finish(handleActivityMirror({ method: "GET", url: req.url ?? "", baseDir }));
      return;
    }
    if (req.method !== "POST") {
      finish(handleActivityMirror({ method: req.method ?? "GET", url: req.url ?? "", baseDir }));
      return;
    }

    const chunks = [];
    let size = 0;
    let aborted = false;
    req.on("data", (chunk) => {
      if (aborted) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      // 상한을 넘긴 순간 끊는다. 코어가 최종 판단을 하지만 여기서 더 모으면 메모리만 쓴다.
      if (size > ACTIVITY_MIRROR_LIMITS.editMaxBodyBytes) {
        aborted = true;
        chunks.length = 0;
        finish({ status: 413, contentType: "text/plain; charset=utf-8", body: "payload too large" });
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => {
      if (aborted) return;
      finish(
        handleActivityMirror({
          method: "POST",
          url: req.url ?? "",
          bodyText: Buffer.concat(chunks).toString("utf8"),
          baseDir,
        }),
      );
    });
  };
}
