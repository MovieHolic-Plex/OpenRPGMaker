// scripts/lib/companion/middleware.mjs 의 타입 선언 — TS 호출자(electron/serve/runtime.ts, vite.config.ts)가 쓴다.
import type { IncomingMessage, ServerResponse } from "node:http";

export type CompanionMiddleware = {
  (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void>;
  /** 워커와 어댑터를 버린다. 서버를 닫을 때 부른다. */
  dispose(): void;
};

export type CompanionMiddlewareOptions = {
  /** 교차 출처 허용 출처. 일렉트론은 app://oprn, 같은 출처로 서빙되는 웹은 생략한다. */
  readonly allowedOrigin?: string;
  /** 실행별 토큰. 주면 `X-Oprn-Companion-Token` 없는 요청을 403 으로 막는다(OAuth 내비게이션 면제). */
  readonly token?: string | null;
};

export function createCompanionMiddleware(options?: CompanionMiddlewareOptions): CompanionMiddleware;
