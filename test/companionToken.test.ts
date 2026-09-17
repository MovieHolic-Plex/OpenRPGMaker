import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createCompanionMiddleware } from "../scripts/lib/companion/middleware.mjs";

// 왜 진짜 HTTP 서버를 띄우는가: 이 잠금의 목적은 "같은 머신의 다른 프로세스가 못 부른다"이고,
// 그건 헤더·프리플라이트·면제 경로가 **한 요청 안에서** 어떻게 맞물리는지의 문제다.
// 핸들러를 직접 부르면 그 맞물림이 사라진다.
async function withServer(options: { token?: string }, run: (origin: string) => Promise<void>) {
  const companion = createCompanionMiddleware({ allowedOrigin: "app://oprn", ...options });
  const server = createServer((request, response) => {
    void companion(request, response, () => {
      response.writeHead(404).end("not found");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    companion.dispose();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("companion loopback token lock", () => {
  it("토큰이 없으면 403 이고, 있으면 핸들러까지 간다", async () => {
    await withServer({ token: "secret-1" }, async (origin) => {
      const denied = await fetch(`${origin}/auth/status?provider=google-antigravity`);
      expect(denied.status).toBe(403);

      // 제공자가 없어 핸들러 자체는 실패해도 된다 — 403 만 아니면 잠금을 통과한 것이다.
      const allowed = await fetch(`${origin}/auth/status?provider=google-antigravity`, {
        headers: { "x-oprn-companion-token": "secret-1" },
      });
      expect(allowed.status).not.toBe(403);
    });
  });

  it("틀린 토큰·짧은 토큰도 403 이다", async () => {
    await withServer({ token: "secret-1" }, async (origin) => {
      for (const wrong of ["secret-2", "s", ""]) {
        const response = await fetch(`${origin}/auth/providers`, {
          headers: { "x-oprn-companion-token": wrong },
        });
        expect(response.status).toBe(403);
      }
    });
  });

  it("프리플라이트는 토큰 없이 통과한다", async () => {
    // 프리플라이트는 실제 요청 헤더를 싣지 않는다.
    await withServer({ token: "secret-1" }, async (origin) => {
      const preflight = await fetch(`${origin}/v1/chat/completions`, {
        method: "OPTIONS",
        headers: { origin: "app://oprn", "access-control-request-headers": "x-oprn-companion-token" },
      });
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get("access-control-allow-headers")).toContain("X-Oprn-Companion-Token");
    });
  });

  it("OAuth 내비게이션은 면제된다 — 헤더를 실을 수 없는 유일한 경로다", async () => {
    await withServer({ token: "secret-1" }, async (origin) => {
      const launch = await fetch(`${origin}/oauth/launch?port=12345`);
      expect(launch.status).not.toBe(403);
    });
  });

  it("토큰을 주지 않으면 잠그지 않는다 — vite dev 는 같은 출처 개발 서버다", async () => {
    await withServer({}, async (origin) => {
      const response = await fetch(`${origin}/auth/providers`);
      expect(response.status).not.toBe(403);
    });
  });

  it("동반 서비스가 아닌 경로는 흘려보낸다", async () => {
    await withServer({ token: "secret-1" }, async (origin) => {
      const response = await fetch(`${origin}/index.html`);
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("not found");
    });
  });
});
