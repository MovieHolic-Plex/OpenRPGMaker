import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createCompanionMiddleware } from "../../scripts/lib/companion/middleware.mjs";

const LOOPBACK = "127.0.0.1";
const RENDERER_ORIGIN = "app://oprn";

export type CompanionServer = {
  readonly origin: string;
  close(): Promise<void>;
};

/** 앱 렌더러가 AI 동반 서비스(/auth/*, /v1/*)를 부를 루프백 출처. 웹 트랙의 oprn-serve 와 같은 본체다. */
export async function startCompanionServer(): Promise<CompanionServer> {
  const companion = createCompanionMiddleware({ allowedOrigin: RENDERER_ORIGIN });
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
    async close(): Promise<void> {
      companion.dispose();
      await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
    },
  };
}
