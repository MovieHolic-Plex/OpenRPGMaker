import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { AI_ACTIVITY_DISK_ENDPOINT } from "../src/ai/activityLogEndpoint";
import { buildAiActivityLogRecord, buildAiActivityMirrorRequest } from "../src/ai/activityLog";

// 실측(2026-08-23): 리네임 때 미들웨어와 클라이언트가 서로 다른 접두사를 매칭하고 있었다.
// 404 는 fetch 가 throw 하지 않으므로 타입도 런타임도 이 드리프트를 못 잡는다 — 테스트가 유일한 방어선이다.
describe("ai activity disk mirror endpoint", () => {
  const viteConfig = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
  const client = readFileSync(new URL("../src/ai/activityLog.ts", import.meta.url), "utf8");

  const e2eConsumers = [
    "desktop-editor-interactions.spec.ts",
    "ice-grand-expanse-play.spec.ts",
    "title-play-controls.spec.ts",
  ].map((name) => readFileSync(new URL(`./e2e/${name}`, import.meta.url), "utf8"));
  it("vite dev 미들웨어가 클라이언트와 같은 경로를 매칭한다", () => {
    expect(viteConfig).toContain(`const AI_ACTIVITY_DISK_ENDPOINT = "${AI_ACTIVITY_DISK_ENDPOINT}"`);
    expect(viteConfig).toContain("req.url?.startsWith(AI_ACTIVITY_DISK_ENDPOINT)");
  });

  it("클라이언트는 경로 문자열을 다시 적지 않고 상수를 쓴다", () => {
    expect(client).toContain("fetch(AI_ACTIVITY_DISK_ENDPOINT");
    expect(client).not.toMatch(/fetch\(\s*"\/__/);
  });

  it("클라이언트·서버·E2E 목에 옛 브랜드 미러 경로가 남아 있지 않다", () => {
    expect(viteConfig).not.toContain("/__rpgzzu/ai-activity");
    expect(client).not.toContain("/__rpgzzu/ai-activity");
    expect(AI_ACTIVITY_DISK_ENDPOINT).toBe("/__oprn/ai-activity");
    for (const e2e of e2eConsumers) {
      expect(e2e).not.toContain("/__rpgzzu/ai-activity");
      expect(e2e).toContain(AI_ACTIVITY_DISK_ENDPOINT);
    }
  });

  it("미러 실패를 조용히 넘기지 않는다", () => {
    expect(client).toContain("res.ok");
    expect(client).toContain("warnMirrorFailure");
  });

  it("작은 로그만 keepalive로 보내고 60 KiB 초과 로그는 일반 요청으로 보낸다", () => {
    const small = buildAiActivityMirrorRequest(buildAiActivityLogRecord({
      channel: "chat",
      instruction: "맵을 확인해줘",
      result: { ok: true },
    }));
    expect(small.keepalive).toBe(true);

    const large = buildAiActivityMirrorRequest(buildAiActivityLogRecord({
      channel: "chat",
      instruction: "적대적 통합 QA",
      result: { ok: false, error: "도구 실패" },
      audit: Array.from({ length: 8 }, (_, index) => ({
        kind: "status" as const,
        text: `${index}:${"가".repeat(4_000)}`,
      })),
    }));
    expect(new TextEncoder().encode(large.body).byteLength).toBeGreaterThan(60 * 1024);
    expect(large.keepalive).toBe(false);
  });
});
