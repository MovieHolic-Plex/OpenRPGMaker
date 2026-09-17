import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createCompanionMiddleware } from "../../scripts/lib/companion/middleware.mjs";

const LOOPBACK = "127.0.0.1";
const RENDERER_ORIGIN = "app://oprn";

export type CompanionServer = {
  readonly origin: string;
  /** 실행별 토큰(설계 7.4). 렌더러가 fetch 헤더로 실어 보낸다. */
  readonly token: string;
  close(): Promise<void>;
};

/** 앱 렌더러가 AI 동반 서비스(/auth/*, /v1/*)를 부르는 루프백 출처. 웹 트랙의 oprn-serve 와 같은 본체다. */
export async function startCompanionServer(): Promise<CompanionServer> {
  // 루프백은 같은 머신의 **다른 프로세스**에도 열려 있다 — 오리진만 보면 curl 과 DNS 리바인딩이
  // 통과해 사용자의 AI 자격으로 완성을 돌리거나 키를 바꿀 수 있다. 실행별 토큰을 요구한다.
  const token = randomUUID();
  const companion = createCompanionMiddleware({ allowedOrigin: RENDERER_ORIGIN, token });
  const server = createServer((request, response) => {
    void companion(request, response, () => {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
    });
  });

  await new Promise<void>((resolvePromise) => server.listen(0, LOOPBACK, resolvePromise));
  const address = server.address() as AddressInfo | null;
  const port = address?.port ?? 0;

  return {
    origin: `http://${LOOPBACK}:${port}`,
    token,
    async close(): Promise<void> {
      companion.dispose();
      await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
    },
  };
}
