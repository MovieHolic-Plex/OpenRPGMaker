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
};

export function createCompanionMiddleware(options?: CompanionMiddlewareOptions): CompanionMiddleware;
