import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "rpgzzu-oh-my-pi-c-"));
process.env.OPRN_OH_MY_PI_AUTH_PATH = join(dir, "auth.json");
delete process.env.OPRN_OH_MY_PI_TEST_STUB;

const { completeProvider } = await import("../scripts/lib/ohMyPiPiAiRuntime.ts");
const { generateProviderImage } = await import("../scripts/lib/ohMyPiImageRuntime.ts");
const {
  publicProviderStatus,
  resolveRequestApiKey,
  seedOAuthForTests,
  startProviderLogin,
} = await import("../scripts/lib/aiAuthRuntime.ts");

function headerAuth(init?: RequestInit): string {
  const headers = init?.headers;
  if (!headers) return "";
  if (headers instanceof Headers) return headers.get("authorization") ?? headers.get("Authorization") ?? "";
  if (Array.isArray(headers)) {
    const hit = headers.find(([key]) => key.toLowerCase() === "authorization");
    return hit?.[1] ?? "";
  }
  return String((headers as Record<string, string>).Authorization ?? (headers as Record<string, string>).authorization ?? "");
}

describe("pi-ai complete (real @earendil-works/pi-ai + mock fetch)", () => {
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("해결된 Codex 자격과 version 헤더가 실제 요청 와이어로 나간다", async () => {
    const testCodexJwt = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: "acct_wire_test" } })).toString("base64url")}.codex-access-on-wire`;
    seedOAuthForTests("openai-codex", {
      access: testCodexJwt,
      refresh: "codex-refresh",
      expires: Date.now() + 60_000,
    });
    const apiKey = await resolveRequestApiKey("openai-codex");
    expect(apiKey).toBe(testCodexJwt);

    const urls: string[] = [];
    const auths: string[] = [];
    const versions: string[] = [];
    try {
      await completeProvider(
        "openai-codex",
        { model: "gpt-6.2-sol", messages: [{ role: "user", content: "ping" }] },
        {
          apiKey,
          fetch: async (input, init) => {
            urls.push(String(input));
            auths.push(headerAuth(init));
            const h = new Headers(init?.headers);
            versions.push(h.get("version") ?? "");
            return new Response("upstream test stop", { status: 400 });
          },
        },
      );
    } catch {
      // 모의 상류는 요청 직렬화 직후 의도적으로 멈춘다.
    }

    expect(urls.some((url) => /chatgpt\.com|openai\.com/.test(url))).toBe(true);
    expect(auths.some((header) => header.includes("codex-access-on-wire"))).toBe(true);
    expect(versions.some((v) => v === "0.170.0")).toBe(true);
  });

  test("Google Antigravity 직접 OAuth 는 계정 보호를 위해 상태·로그인·완성·이미지 모두 차단된다", async () => {
    seedOAuthForTests("google-antigravity", {
      access: "complete-access",
      refresh: "complete-refresh",
      expires: Date.now() + 60_000,
      projectId: "complete-project",
    });

    const status = publicProviderStatus("google-antigravity") as { connected: boolean; disabled?: boolean };
    expect(status.connected).toBe(false);
    expect(status.disabled).toBe(true);
    expect(await resolveRequestApiKey("google-antigravity")).toBeUndefined();
    await expect(startProviderLogin("google-antigravity")).rejects.toMatchObject({ status: 400 });
    await expect(completeProvider("google-antigravity", { model: "gemini-4-argon", messages: [{ role: "user", content: "hi" }] })).rejects.toMatchObject({ status: 400 });
    await expect(generateProviderImage("google-antigravity", { model: "gemini-3.1-flash-image", prompt: "슬라임" })).rejects.toMatchObject({ status: 400 });
  });

  test("서버 목록에서 온 새 gpt-*·claude-* 모델은 같은 계열 기준 모델에 ID 만 덮어 쓰고, 다른 계열은 그대로 거절한다", async () => {
    const { resolveOhMyPiModel } = await import("../scripts/lib/ohMyPiModel.ts");
    expect(resolveOhMyPiModel("openai-codex", "gpt-9.9-future-sol")).toMatchObject({ id: "gpt-9.9-future-sol" });
    expect(resolveOhMyPiModel("anthropic", "claude-fable-9-9")).toMatchObject({ id: "claude-fable-9-9" });
    expect(() => resolveOhMyPiModel("openai-codex", "claude-opus-5-5")).toThrow("대체하지 않았습니다");
    expect(() => resolveOhMyPiModel("anthropic", "gpt-6.2-sol")).toThrow("대체하지 않았습니다");
  });

  test("지원 목록에 없는 모델은 다른 모델로 대체하지 않고 400 으로 거절한다", async () => {
    await expect(completeProvider("openai-codex", { model: "unknown-selected-model", messages: [{ role: "user", content: "hi" }] })).rejects.toThrow("대체하지 않았습니다");
  });
});
