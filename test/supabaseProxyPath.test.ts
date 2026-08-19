import { describe, expect, it } from "vitest";

import { SUPABASE_PROXY_PATH, resolveBrowserSupabaseUrl } from "../src/project/supabaseProxyPath";

describe("resolveBrowserSupabaseUrl", () => {
  it("folds a plaintext backend to the same-origin proxy on an https page", () => {
    expect(resolveBrowserSupabaseUrl("http://dbserver:8100", { pageProtocol: "https:" })).toBe(
      SUPABASE_PROXY_PATH,
    );
  });

  it("keeps the absolute url on an http page", () => {
    expect(resolveBrowserSupabaseUrl("http://dbserver:8100", { pageProtocol: "http:" })).toBe(
      "http://dbserver:8100",
    );
  });

  it("keeps an https backend untouched because it is not blocked", () => {
    expect(resolveBrowserSupabaseUrl("https://db.example.com", { pageProtocol: "https:" })).toBe(
      "https://db.example.com",
    );
  });

  // 2026-08-19: 과거에는 isDev=false(프로덕션 번들)일 때 http URL을 그대로 돌려줬다.
  // 그 계약은 `npm start`(vite preview = prod 번들 + https + /supabase 프록시)에서
  // 모든 저장/로드 fetch를 mixed content로 100% 실패시켰다(실측: 저장 칩
  // "저장 실패 · 다시 시도 n회" 반복). https 페이지에서 http 직접 fetch는 어떤
  // 환경에서도 성공할 수 없으므로, 빌드 모드와 무관하게 프록시 경로로 접는다.
  it("folds even in production bundles — direct http fetch from https can never succeed", () => {
    expect(resolveBrowserSupabaseUrl("http://dbserver:8100", { pageProtocol: "https:" })).toBe(
      SUPABASE_PROXY_PATH,
    );
  });

  it("keeps the absolute url outside a browser", () => {
    expect(resolveBrowserSupabaseUrl("http://dbserver:8100", { pageProtocol: undefined })).toBe(
      "http://dbserver:8100",
    );
  });

  it("strips a trailing slash", () => {
    expect(resolveBrowserSupabaseUrl("http://dbserver:8100/", { pageProtocol: "http:" })).toBe(
      "http://dbserver:8100",
    );
  });
});
