// 동반 서비스 클라이언트 회귀 스펙.
//
// 세 결함을 고정한다(전부 2026-08-21 실측):
//  ① 상태 응답의 authKind/expired/env 를 버려서, 브라우저가 "자격 없음"과 "셸 env 만 있음"과
//     "만료"를 구분할 수 없었다.
//  ② companionFetch 에 타임아웃이 없어서 소켓만 잡히면 영원히 매달렸다 — 상태 칩이 "확인 중"에
//     영구히 멈추고 재시도 가드까지 안 풀렸다.
//  ③ 2xx 인데 JSON 이 아닌 응답(vite SPA 폴백 = 경로 미등록)을 성공으로 읽었다.
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ChatGptCompanionResponseError,
  ChatGptCompanionUnreachableError,
  COMPANION_TIMEOUT_MS,
  fetchChatGptAuthStatus,
  fetchCompanionProviders,
  hasStoredCompanionCredential,
  hasUsableCompanionCredential,
} from "@/ai/chatgptOAuthClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** vite dev 서버가 미등록 경로 GET 에 주는 응답 모양. */
function spaFallback(): Response {
  return new Response("<!doctype html><html lang=\"ko\"></html>", {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("상태 응답을 버리지 않는다", () => {
  it("authKind·expired·env 를 그대로 실어 온다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      connected: true, authKind: "oauth", expired: false, env: false, planType: "plus",
    })));

    const status = await fetchChatGptAuthStatus("openai-codex");

    expect(status).toMatchObject({
      connected: true, authKind: "oauth", expired: false, env: false, planType: "plus",
    });
  });

  it("모르는 authKind 값은 undefined 로 떨군다 (지어내지 않는다)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ connected: true, authKind: "sorcery" })));
    expect((await fetchChatGptAuthStatus()).authKind).toBeUndefined();
  });
});

describe("hasStoredCompanionCredential — 환경 변수는 쓸 수 있지만 지우지는 못한다", () => {
  it("저장된 자격만 연결로 인정한다", () => {
    expect(hasStoredCompanionCredential({ connected: true, env: false })).toBe(true);
    expect(hasStoredCompanionCredential({ connected: true })).toBe(true);
  });

  it("환경 변수 키는 쓸 수 있지만 저장 자격은 아니다", () => {
    expect(hasUsableCompanionCredential({ connected: true, env: true })).toBe(true);
    expect(hasStoredCompanionCredential({ connected: true, env: true })).toBe(false);
  });

  it("만료된 자격은 인정하지 않는다", () => {
    expect(hasStoredCompanionCredential({ connected: true, expired: true })).toBe(false);
  });

  it("미연결은 당연히 인정하지 않는다", () => {
    expect(hasStoredCompanionCredential({ connected: false })).toBe(false);
  });
});

describe("도달 불가 (A) 의 세 원인을 구분한다", () => {
  it("fetch 가 던지면 network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));

    const error = await fetchChatGptAuthStatus().catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ChatGptCompanionUnreachableError);
    expect((error as ChatGptCompanionUnreachableError).reason).toBe("network");
  });

  it("응답이 오지 않으면 타임아웃으로 끊는다", async () => {
    // 타임아웃이 없던 동안 이 호출은 영원히 pending 이었다.
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })));
    vi.useFakeTimers();

    const pending = fetchChatGptAuthStatus().catch((cause: unknown) => cause);
    await vi.advanceTimersByTimeAsync(COMPANION_TIMEOUT_MS + 10);
    const error = await pending;

    expect(error).toBeInstanceOf(ChatGptCompanionUnreachableError);
    expect((error as ChatGptCompanionUnreachableError).reason).toBe("timeout");
  });

  it("2xx 인데 앱 HTML 이면 경로 미등록으로 읽는다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => spaFallback()));

    const error = await fetchChatGptAuthStatus().catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ChatGptCompanionUnreachableError);
    expect((error as ChatGptCompanionUnreachableError).reason).toBe("not-mounted");
  });

  it("4xx 는 도달 불가가 아니라 응답 오류 (B) 다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "boom" }, 500)));

    const error = await fetchChatGptAuthStatus().catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ChatGptCompanionResponseError);
    expect((error as ChatGptCompanionResponseError).serverMessage).toBe("boom");
  });
});

describe("fetchCompanionProviders", () => {
  it("제공자 목록을 정규화해 돌려준다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      providers: [
        { id: "openai-codex", label: "OpenAI Codex", authKind: "oauth", defaultModel: "gpt-5.5", hasLogin: true, hasRefresh: true },
        { id: "zai", label: "zAI", authKind: "apiKey", defaultModel: "glm-5.3", hasLogin: true, hasRefresh: false },
        { label: "id 없는 줄은 버린다" },
      ],
    })));

    const providers = await fetchCompanionProviders();

    expect(providers).toHaveLength(2);
    expect(providers[0]).toMatchObject({ id: "openai-codex", authKind: "oauth", hasRefresh: true });
    expect(providers[1]).toMatchObject({ id: "zai", authKind: "apiKey", hasRefresh: false });
  });

  it("목록이 없으면 빈 배열이다 (throw 하지 않는다)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({})));
    expect(await fetchCompanionProviders()).toEqual([]);
  });
});
