import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { AI_ACTIVITY_DISK_ENDPOINT } from "../src/ai/activityLogEndpoint";

// 실측(2026-08-23): 리네임 때 미들웨어만 /__rpgzzu 로 바뀌고 클라이언트는 /__oprn 에 POST 하고 있었다.
// 404 는 fetch 가 throw 하지 않으므로 타입도 런타임도 이 드리프트를 못 잡는다 — 테스트가 유일한 방어선이다.
describe("ai activity disk mirror endpoint", () => {
  const viteConfig = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
  const client = readFileSync(new URL("../src/ai/activityLog.ts", import.meta.url), "utf8");

  it("vite dev 미들웨어가 클라이언트와 같은 경로를 매칭한다", () => {
    expect(viteConfig).toContain(`const AI_ACTIVITY_DISK_ENDPOINT = "${AI_ACTIVITY_DISK_ENDPOINT}"`);
    expect(viteConfig).toContain("req.url?.startsWith(AI_ACTIVITY_DISK_ENDPOINT)");
  });

  it("클라이언트는 경로 문자열을 다시 적지 않고 상수를 쓴다", () => {
    expect(client).toContain("fetch(AI_ACTIVITY_DISK_ENDPOINT");
    expect(client).not.toMatch(/fetch\(\s*"\/__/);
  });

  it("어느 쪽에도 옛 /__oprn 미러 경로가 남아 있지 않다", () => {
    expect(viteConfig).not.toContain("/__oprn/ai-activity");
    expect(client).not.toContain("/__oprn/ai-activity");
  });

  it("미러 실패를 조용히 넘기지 않는다", () => {
    expect(client).toContain("res.ok");
    expect(client).toContain("warnMirrorFailure");
  });
});
