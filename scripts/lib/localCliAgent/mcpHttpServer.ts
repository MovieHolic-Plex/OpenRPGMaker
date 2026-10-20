// 에디터 도구를 사용자의 로컬 에이전트 CLI(claude -p · codex exec · gemini)에 MCP 로 내주는 작은 서버.
//
// - 127.0.0.1 에만 묶는다. 포트는 0(운영체제가 고른 빈 포트).
// - 실행마다 새 비밀값(Bearer)을 요구한다. 루프백은 같은 머신의 다른 프로세스에도 열려 있기 때문이다.
// - Origin 헤더가 붙은 요청은 거절한다. CLI 는 Origin 을 보내지 않고, 브라우저 탭(DNS 리바인딩 포함)만 보낸다.
// - MCP Streamable HTTP 의 최소 부분만 구현한다: POST 한 번에 JSON 응답 하나. 서버 → 클라이언트 SSE 는 쓰지 않는다(GET 은 405).
//
// 도구 실행 자체는 호출자가 준 `callTool` 이 한다 — 이 파일은 프로젝트·편집 규칙을 모른다.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { randomBytes, timingSafeEqual } from "node:crypto";

export interface LocalMcpTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: unknown;
}

export type LocalMcpContent =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "image"; readonly data: string; readonly mimeType: string };

export interface LocalMcpCallResult {
  readonly content: readonly LocalMcpContent[];
  readonly isError?: boolean;
}

export interface LocalMcpServerOptions {
  readonly name: string;
  readonly tools: () => readonly LocalMcpTool[];
  readonly callTool: (name: string, args: Record<string, unknown>) => Promise<LocalMcpCallResult>;
  /** 요청 한 건마다(감사 로그용). 비밀값은 넘기지 않는다. */
  readonly onRequest?: (record: { method: string; status: number; tool?: string }) => void;
}

export interface LocalMcpServer {
  readonly url: string;
  /** CLI 자식 프로세스에 환경 변수로만 넘긴다. 명령줄 인자(ps 로 보임)·로그에 남기지 않는다. */
  readonly token: string;
  close(): Promise<void>;
}

const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_BODY = 4 * 1024 * 1024;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) { reject(new Error("body too large")); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function tokenMatches(header: string | undefined, token: string): boolean {
  const expected = Buffer.from(`Bearer ${token}`);
  const got = Buffer.from(header ?? "");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

type JsonRpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

export async function startLocalMcpServer(options: LocalMcpServerOptions): Promise<LocalMcpServer> {
  const token = randomBytes(32).toString("base64url");

  async function handle(message: JsonRpc): Promise<unknown | null> {
    const id = message.id ?? null;
    const reply = (result: unknown) => ({ jsonrpc: "2.0", id, result });
    const fail = (code: number, text: string) => ({ jsonrpc: "2.0", id, error: { code, message: text } });
    // id 없는 것은 알림 — 응답하지 않는다.
    if (message.id === undefined) return null;
    switch (message.method) {
      case "initialize": {
        const asked = typeof message.params?.protocolVersion === "string" ? message.params.protocolVersion : SUPPORTED_PROTOCOLS[0]!;
        return reply({
          protocolVersion: SUPPORTED_PROTOCOLS.includes(asked) ? asked : SUPPORTED_PROTOCOLS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: options.name, version: "0.1.0" },
        });
      }
      case "ping":
        return reply({});
      case "tools/list":
        return reply({ tools: options.tools().map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema })) });
      case "tools/call": {
        const name = message.params?.name;
        const args = message.params?.arguments ?? {};
        if (typeof name !== "string") return fail(-32602, "params.name must be a string");
        if (!args || typeof args !== "object" || Array.isArray(args)) return fail(-32602, "params.arguments must be an object");
        try {
          return reply(await options.callTool(name, args as Record<string, unknown>));
        } catch (error) {
          // 도구 실패는 프로토콜 오류가 아니라 isError 결과다 — 모델이 읽고 고칠 수 있게.
          return reply({ content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }], isError: true });
        }
      }
      default:
        return fail(-32601, `Method not found: ${message.method}`);
    }
  }

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      const done = (status: number, body?: unknown, tool?: string) => {
        options.onRequest?.({ method: req.method ?? "?", status, ...(tool ? { tool } : {}) });
        if (body === undefined) { res.writeHead(status); res.end(); return; }
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
      };
      if (req.headers.origin) return done(403, { error: "browser origins are not allowed" });
      if (!tokenMatches(req.headers.authorization, token)) return done(401, { error: "unauthorized" });
      if (req.url !== "/mcp") return done(404, { error: "not found" });
      if (req.method === "GET") return done(405);
      if (req.method === "DELETE") return done(200, {});
      if (req.method !== "POST") return done(405);
      let parsed: JsonRpc | JsonRpc[];
      try { parsed = JSON.parse(await readBody(req)) as JsonRpc | JsonRpc[]; } catch { return done(400, { error: "bad json" }); }
      const batch = Array.isArray(parsed) ? parsed : [parsed];
      const replies = (await Promise.all(batch.map(handle))).filter((entry) => entry !== null);
      const tool = batch.find((entry) => entry.method === "tools/call")?.params?.name;
      if (replies.length === 0) return done(202, undefined, typeof tool === "string" ? tool : undefined);
      return done(200, Array.isArray(parsed) ? replies : replies[0], typeof tool === "string" ? tool : undefined);
    })().catch(() => { if (!res.headersSent) { res.writeHead(500); res.end(); } });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    token,
    close: () => new Promise<void>((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); }),
  };
}
