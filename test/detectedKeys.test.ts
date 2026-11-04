// 이미 가진 API 키 찾기·입양 — 목록에는 출처 이름만, 입양은 고정 주소로 도구 시험이 통과할 때만 저장한다.
import { afterAll, describe, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 고정 주소(api.deepseek.com)의 이름 풀이를 네트워크 없이 끝낸다 — 공개 주소로 풀린 것처럼 둔다.
vi.mock("node:dns/promises", () => {
  const lookup = async () => [{ address: "203.0.113.10", family: 4 }];
  return { default: { lookup }, lookup };
});

const dir = mkdtempSync(join(tmpdir(), "oprn-detected-keys-"));
process.env.OPRN_OPENAI_COMPAT_PATH = join(dir, "endpoints.json");
const { listKeySources, adoptKeySource } = await import("../scripts/lib/detectedKeys.ts");
const { listOpenAiCompatPublic } = await import("../scripts/lib/openAiCompatRuntime.ts");
const { KEY_ROUTES } = await import("../src/ai/keyRoutes.ts");

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const HOME = "/home/tester";
const KEYS = {
  openai: "sk-openai-env-1111",
  anthropic: "sk-ant-env-2222",
  proxy: "proxy-token-3333",
  gemini: "AIza-gemini-env-4444",
  google: "AIza-google-env-5555",
  deepseek: "sk-deepseek-env-6666",
  codex: "sk-codex-file-7777",
  geminiFile: "AIza-gemini-file-8888",
};
const ENV = {
  OPENAI_API_KEY: KEYS.openai,
  ANTHROPIC_API_KEY: KEYS.anthropic,
  ANTHROPIC_AUTH_TOKEN: KEYS.proxy,
  GEMINI_API_KEY: KEYS.gemini,
  GOOGLE_API_KEY: KEYS.google,
  DEEPSEEK_API_KEY: KEYS.deepseek,
};
const FILES: Record<string, string> = {
  [`${HOME}/.codex/auth.json`]: JSON.stringify({ auth_mode: "apikey", OPENAI_API_KEY: KEYS.codex, tokens: null }),
  [`${HOME}/.gemini/.env`]: `# gemini\nexport GEMINI_API_KEY="${KEYS.geminiFile}"\nOTHER=1\n`,
  [`${HOME}/.env`]: `DEEPSEEK_API_KEY=sk-home-dotenv-9999\n`,
};
const memFs = (files: Record<string, string>) => ({
  readFileSync(path: string) {
    if (path in files) return files[path]!;
    throw Object.assign(new Error(`ENOENT: ${path}`), { code: "ENOENT" });
  },
});
const deps = (envScan: "ask" | "allow" | "deny", files = FILES) => ({ fs: memFs(files), envScan: () => envScan, endpoints: () => [] });

describe("listKeySources", () => {
  test("출처마다 id·이름을 주고 키 값은 어디에도 싣지 않는다", () => {
    const sources = listKeySources(ENV, HOME, deps("allow"));
    expect(sources.map(({ id, family, label }) => ({ id, family, label }))).toEqual([
      { id: "env:ANTHROPIC_API_KEY", family: "claude", label: "ANTHROPIC_API_KEY (환경 변수)" },
      { id: "env:OPENAI_API_KEY", family: "openai", label: "OPENAI_API_KEY (환경 변수)" },
      { id: "env:GEMINI_API_KEY", family: "google", label: "GEMINI_API_KEY (환경 변수)" },
      { id: "env:GOOGLE_API_KEY", family: "google", label: "GOOGLE_API_KEY (환경 변수)" },
      { id: "env:DEEPSEEK_API_KEY", family: "deepseek", label: "DEEPSEEK_API_KEY (환경 변수)" },
      { id: "codex:OPENAI_API_KEY", family: "openai", label: "Codex CLI 설정의 OpenAI API 키 (~/.codex/auth.json)" },
      { id: "gemini-env:GEMINI_API_KEY", family: "google", label: "~/.gemini/.env 의 GEMINI_API_KEY" },
    ]);
    const text = JSON.stringify(sources);
    for (const key of Object.values(KEYS)) expect(text).not.toContain(key);
    expect(text).not.toContain("sk-home-dotenv-9999");
  });

  test("ANTHROPIC_AUTH_TOKEN 만 있으면 Claude 출처가 없다", () => {
    const sources = listKeySources({ ANTHROPIC_AUTH_TOKEN: KEYS.proxy }, HOME, deps("allow", {}));
    expect(sources).toEqual([]);
  });

  test("OpenAI 키는 찾아도 입양할 수 없다고 알린다(이 경로로 도구 호출 불가)", () => {
    const openai = listKeySources({ OPENAI_API_KEY: KEYS.openai }, HOME, deps("allow", {}))[0];
    expect(openai?.adoptable).toBe(false);
    expect(openai?.note).toBeTruthy();
    const deepseek = listKeySources({ DEEPSEEK_API_KEY: KEYS.deepseek }, HOME, deps("allow", {}))[0];
    expect(deepseek).toMatchObject({ adoptable: true, model: "deepseek" });
  });

  test("동의 전(ask)에는 환경 변수를 보지 않고 CLI 설정 파일만 본다", () => {
    expect(listKeySources(ENV, HOME, deps("ask")).map((row) => row.id)).toEqual(["codex:OPENAI_API_KEY", "gemini-env:GEMINI_API_KEY"]);
  });

  test("거절(deny)이면 아무것도 찾지 않는다", () => {
    expect(listKeySources(ENV, HOME, deps("deny"))).toEqual([]);
  });

  test("ChatGPT 로그인 auth.json 의 키 칸은 출처가 아니다", () => {
    const files = { [`${HOME}/.codex/auth.json`]: JSON.stringify({ auth_mode: "chatgpt", OPENAI_API_KEY: KEYS.codex, tokens: { refresh_token: "r" } }) };
    expect(listKeySources({}, HOME, deps("allow", files))).toEqual([]);
  });

  test("CODEX_HOME·GEMINI_CLI_HOME 을 따른다", () => {
    const files = {
      "/opt/codex/auth.json": JSON.stringify({ auth_mode: "apikey", OPENAI_API_KEY: KEYS.codex }),
      "/opt/gem/.gemini/.env": `GOOGLE_API_KEY='${KEYS.geminiFile}' # note\n`,
    };
    const sources = listKeySources({ CODEX_HOME: "/opt/codex", GEMINI_CLI_HOME: "/opt/gem" }, HOME, deps("ask", files));
    expect(sources.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "codex:OPENAI_API_KEY", label: "Codex CLI 설정의 OpenAI API 키 (/opt/codex/auth.json)" },
      { id: "gemini-env:GOOGLE_API_KEY", label: "/opt/gem/.gemini/.env 의 GOOGLE_API_KEY" },
    ]);
  });

  test("읽지 못하는 파일·깨진 JSON 은 던지지 않고 건너뛴다", () => {
    const denied = { readFileSync() { throw Object.assign(new Error("EACCES"), { code: "EACCES" }); } };
    expect(listKeySources({}, HOME, { fs: denied, envScan: () => "allow", endpoints: () => [] })).toEqual([]);
    expect(listKeySources({}, HOME, deps("allow", { [`${HOME}/.codex/auth.json`]: "{not json" }))).toEqual([]);
  });

  test("같은 키가 두 곳에 있으면 한 번만 보인다", () => {
    const sources = listKeySources({ GEMINI_API_KEY: KEYS.geminiFile }, HOME, deps("allow", { [`${HOME}/.gemini/.env`]: `GEMINI_API_KEY=${KEYS.geminiFile}\n` }));
    expect(sources.map((row) => row.id)).toEqual(["env:GEMINI_API_KEY"]);
  });
});

describe("adoptKeySource", () => {
  type Reply = { status: number; body: unknown };
  const seen: string[] = [];
  const fakeFetch = (chat: () => Reply) => (async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url);
    seen.push(path);
    expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${KEYS.deepseek}`);
    if (path.endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "deepseek-flash" }] }), { status: 200 });
    const reply = chat();
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  }) as typeof fetch;
  const ok: Reply = { status: 200, body: { choices: [{ message: { role: "assistant", content: "pong" } }] } };
  const adoptDeps = (fetchImpl: typeof fetch) => ({
    env: { DEEPSEEK_API_KEY: KEYS.deepseek }, home: HOME, fs: memFs({}), envScan: () => "allow" as const, fetchImpl,
  });

  test("401 이면 저장하지 않고 응답 어디에도 키가 없다", async () => {
    const result = await adoptKeySource({ sourceId: "env:DEEPSEEK_API_KEY" },
      adoptDeps(fakeFetch(() => ({ status: 401, body: { error: { message: `Authentication Fails, Your api key: ${KEYS.deepseek} is invalid` } } }))));
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(KEYS.deepseek);
    expect(listOpenAiCompatPublic()).toHaveLength(0);
  });

  test("통과하면 고정 주소로 엔드포인트 하나를 저장하고, 다시 입양해도 하나만 남는다", async () => {
    seen.length = 0;
    const first = await adoptKeySource({ sourceId: "env:DEEPSEEK_API_KEY" }, adoptDeps(fakeFetch(() => ok)));
    expect(first.ok).toBe(true);
    expect(first.model).toBe("deepseek-flash");
    expect(first.endpoint).toMatchObject({
      baseUrl: KEY_ROUTES.deepseek.baseUrl, name: "DeepSeek (DEEPSEEK_API_KEY)", hasKey: true, defaultModel: "deepseek-flash",
      reasoningMode: "field", contextWindow: KEY_ROUTES.deepseek.contextWindow,
    });
    expect(first.endpoint?.id).toMatch(/^openai-compat:/u);
    expect(seen.every((url) => url.startsWith(`${KEY_ROUTES.deepseek.baseUrl}/`))).toBe(true);
    expect(JSON.stringify(first)).not.toContain(KEYS.deepseek);

    const again = await adoptKeySource({ sourceId: "env:DEEPSEEK_API_KEY" }, adoptDeps(fakeFetch(() => ok)));
    expect(again.endpoint?.id).toBe(first.endpoint?.id);
    expect(listOpenAiCompatPublic()).toHaveLength(1);
    // 키와 함께 저장됐으니 목록에서 빠진다.
    expect(listKeySources({ DEEPSEEK_API_KEY: KEYS.deepseek }, HOME, { fs: memFs({}), envScan: () => "allow" })).toEqual([]);
  });

  test("없는 출처·그 제공자에 없는 모델은 호출 없이 거절한다", async () => {
    const noCall = (() => { throw new Error("no call"); }) as unknown as typeof fetch;
    expect((await adoptKeySource({ sourceId: "env:NOPE" }, adoptDeps(noCall))).code).toBe("not-found");
    expect((await adoptKeySource({ sourceId: "env:DEEPSEEK_API_KEY", model: "gpt-6-astra" }, adoptDeps(noCall))).code).toBe("invalid-model");
  });
});
