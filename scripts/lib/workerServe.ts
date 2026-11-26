// 워커 HTTP 서버를 Bun 과 Node(Electron 의 Node 포함) 양쪽에서 띄운다. omp-to-pi 시제품에서 bun --compile 없이 워커를 돌리려고 만들었다.
// Node 쪽은 fetch 핸들러 모양(Request → Response)을 그대로 쓴다. 연결이 끊기면 request.signal 을 중단한다 — /agent/run 이 그 신호로 실행을 멈춘다.
import { createServer, type IncomingMessage } from "node:http";
import { Readable } from "node:stream";

type FetchHandler = (request: Request) => Response | Promise<Response>;

export async function serveWorker(options: { port: number; maxRequestBodySize: number; fetch: FetchHandler }): Promise<{ port: number }> {
  const bun = (globalThis as { Bun?: { serve(options: unknown): { port: number } } }).Bun;
  if (bun) return bun.serve({ hostname: "127.0.0.1", port: options.port, idleTimeout: 0, maxRequestBodySize: options.maxRequestBodySize, fetch: options.fetch });
  const server = createServer(async (req, res) => {
    const aborter = new AbortController();
    res.on("close", () => { if (!res.writableFinished) aborter.abort(); });
    let response: Response;
    try {
      response = await options.fetch(toRequest(req, options.maxRequestBodySize, aborter.signal));
    } catch (error) {
      response = new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500 });
    }
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (!response.body) { res.end(); return; }
    try {
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) res.write(chunk);
    } finally {
      res.end();
    }
  });
  server.requestTimeout = 0;
  server.headersTimeout = 0;
  server.keepAliveTimeout = 0;
  await new Promise<void>((resolve) => server.listen(options.port, "127.0.0.1", resolve));
  const address = server.address();
  return { port: typeof address === "object" && address ? address.port : options.port };
}

function toRequest(req: IncomingMessage, limit: number, signal: AbortSignal): Request {
  let seen = 0;
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : Readable.toWeb(req.on("data", (chunk: Buffer) => {
    seen += chunk.length;
    if (seen > limit) req.destroy(new Error(`요청 본문이 ${limit} 바이트를 넘었습니다`));
  })) as unknown as ReadableStream;
  return new Request(`http://127.0.0.1${req.url ?? "/"}`, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body,
    signal,
    duplex: "half",
  } as RequestInit);
}
