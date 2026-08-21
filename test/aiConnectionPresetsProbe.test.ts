// 프리셋 가용성 검지 회귀 스펙.
//
// 배경(2026-08-21 장애): 등록되지 않은 프록시 경로로 GET 하면 vite dev 서버가 404 가 아니라
// **SPA 폴백 200 text/html**(에디터 index.html)을 준다 — 실측. 404 만 미등록으로 보던 판정은
// 이걸 "사용 가능"으로 읽었고, 그래서 죽은 `/api/cliproxy` 가 초록으로 보였다(POST 는 404 라
// 실제 턴은 죽는 비대칭). 이 파일은 그 거짓 초록을 고정해 막는다.
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BUILTIN_CONNECTION_PRESETS,
  findBuiltinPreset,
  probePresetAvailability,
} from "@/ai/connectionPresets";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** vite dev 서버가 미등록 경로 GET 에 주는 응답 모양. */
function spaFallbackResponse(): Response {
  return new Response("<!doctype html><html lang=\"ko\"><head></head></html>", {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

function chatgptPreset() {
  const preset = findBuiltinPreset("chatgpt");
  if (!preset) throw new Error("chatgpt preset missing");
  return preset;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("내장 프리셋 집합", () => {
  it("인증은 무조건 OAuth — apiKey 프리셋은 하나도 없다", () => {
    expect(BUILTIN_CONNECTION_PRESETS.length).toBeGreaterThan(0);
    expect(BUILTIN_CONNECTION_PRESETS.every((preset) => preset.authMode === "chatgpt")).toBe(true);
    // 게이트웨이 경로를 가리키는 프리셋이 되살아나면 이 스펙이 먼저 깨진다.
    expect(BUILTIN_CONNECTION_PRESETS.some((preset) => preset.baseUrl.startsWith("/api/"))).toBe(false);
  });
});

describe("probePresetAvailability — 거짓 초록 방지", () => {
  it("2xx 인데 앱 HTML 이 돌아오면 사용 가능이 아니다 (SPA 폴백 = 경로 미등록)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => spaFallbackResponse()));

    const result = await probePresetAvailability(chatgptPreset());

    expect(result.status).toBe("error");
    expect(result.httpStatus).toBe(200);
    expect(result.detail).toContain("등록되지 않았습니다");
  });

  it("2xx + JSON + connected true 면 ready", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ connected: true, planType: "plus" })));

    const result = await probePresetAvailability(chatgptPreset());

    expect(result.status).toBe("ready");
    expect(result.httpStatus).toBe(200);
  });

  it("2xx + JSON 이지만 미로그인이면 error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ connected: false })));

    const result = await probePresetAvailability(chatgptPreset());

    expect(result.status).toBe("error");
    expect(result.detail).toContain("로그인");
  });

  it("404 는 경로 미등록(missing-key)으로 읽는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ detail: "Not Found" }, 404)));

    const result = await probePresetAvailability(chatgptPreset());

    expect(result.status).toBe("missing-key");
    expect(result.httpStatus).toBe(404);
  });

  it("도달 불가는 error 로 변환하고 절대 reject 하지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));

    const result = await probePresetAvailability(chatgptPreset());

    expect(result.status).toBe("error");
    expect(result.detail).toContain("연결할 수 없습니다");
  });
});
