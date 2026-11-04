// 이미 가진 API 키 찾기·입양 — 동반 서비스(Node) 전용. 브라우저는 출처 이름만 받고 키 값은 받지 않는다.
//
// 출처: 환경 변수(OPENAI_API_KEY·ANTHROPIC_API_KEY·GEMINI_API_KEY·GOOGLE_API_KEY·DEEPSEEK_API_KEY),
// Codex CLI 의 auth.json(API 키 로그인일 때의 OPENAI_API_KEY), Gemini CLI 의 ~/.gemini/.env.
// ANTHROPIC_AUTH_TOKEN 은 읽지 않는다 — ANTHROPIC_BASE_URL 프록시용 토큰이라 api.anthropic.com 키가 아니다.
// 홈의 .env 같은 남의 파일은 읽지 않는다: 도구가 자기 설정으로 쓰는 파일만 읽는다.
//
// 동의(oh-my-pi-auth.json 의 envScan):
//  - deny  = 아무것도 찾지 않는다(환경 변수도 파일도). 「보지 마」 를 한쪽만 지키면 눈속임이다.
//  - ask   = CLI 설정 파일만 본다. 환경 변수는 동의 전에 읽지 않는다(aiAuthRuntime.publicProviderStatus 와 같은 규칙).
//            Codex auth.json 은 이미 동의 없이 읽고 있다(adoptCodexCliCredentials).
//  - allow = 환경 변수까지 본다.
// CODEX_HOME·GEMINI_CLI_HOME 은 키가 아니라 위치 설정이라 동의와 상관없이 읽는다.
//
// 입양은 키를 이 프로세스 안에서만 꺼내 KEY_ROUTES 의 고정 주소로 시험(도구 달린 채팅)하고, 통과하면
// openAiCompatStore(0600) 에 저장한다. 주소는 클라이언트에게서 받지 않는다.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { KEY_ROUTES, keyRouteAdoptModel, type KeySourcePublic } from "../../src/ai/keyRoutes.ts";
import { checkOpenAiCompatBaseUrl, type OpenAiCompatEndpointPublic } from "../../src/ai/openAiCompat.ts";
import type { ModelFamily, TeamModelKey } from "../../src/ai/teamScoreboard.ts";
import { createOhMyPiAuthStore, defaultOhMyPiAuthPath } from "./ohMyPiAuthStore.mjs";
import { connectOpenAiCompatTested, listOpenAiCompatPublic } from "./openAiCompatRuntime.ts";

export type EnvScanDecision = "ask" | "allow" | "deny";

export interface KeyFs {
  readFileSync(path: string, encoding: "utf8"): string;
}

export interface KeySourceDeps {
  readonly fs?: KeyFs;
  readonly envScan?: () => EnvScanDecision;
  readonly endpoints?: () => readonly OpenAiCompatEndpointPublic[];
}

interface FoundKey {
  readonly id: string;
  readonly family: ModelFamily;
  readonly label: string;
  /** 엔드포인트 이름(60자 이하). */
  readonly endpointName: string;
  readonly value: string;
}

const ENV_SOURCES: ReadonlyArray<{ readonly name: string; readonly family: ModelFamily }> = [
  { name: "ANTHROPIC_API_KEY", family: "claude" },
  { name: "OPENAI_API_KEY", family: "openai" },
  { name: "GEMINI_API_KEY", family: "google" },
  { name: "GOOGLE_API_KEY", family: "google" },
  { name: "DEEPSEEK_API_KEY", family: "deepseek" },
];

const GEMINI_ENV_NAMES = ["GEMINI_API_KEY", "GOOGLE_API_KEY"] as const;
const MAX_CONFIG_CHARS = 64 * 1024;

let authStore: ReturnType<typeof createOhMyPiAuthStore> | undefined;

export function currentEnvScanDecision(): EnvScanDecision {
  authStore ??= createOhMyPiAuthStore(defaultOhMyPiAuthPath());
  return authStore.envScan();
}

/** 키처럼 보이는 값만 받는다: 빈 값·공백·줄바꿈이 든 값은 키가 아니다. */
function keyValue(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  return value.length >= 8 && !/\s/u.test(value) ? value : undefined;
}

function readText(fs: KeyFs, path: string): string | undefined {
  try {
    const text = fs.readFileSync(path, "utf8");
    return text.length <= MAX_CONFIG_CHARS ? text : undefined;
  } catch {
    return undefined;
  }
}

/** dotenv 한 줄 읽기: `[export ]NAME=value`, 따옴표 벗기기, 따옴표 밖 ` #` 뒤는 주석. 변수 치환은 하지 않는다. */
function parseDotEnv(text: string, wanted: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of text.split(/\r?\n/u)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u.exec(line);
    if (!match || !wanted.includes(match[1]!)) continue;
    let raw = match[2]!.trim();
    const quote = raw[0];
    if ((quote === "\"" || quote === "'") && raw.indexOf(quote, 1) > 0) raw = raw.slice(1, raw.indexOf(quote, 1));
    else raw = raw.replace(/\s+#.*$/u, "");
    const value = keyValue(raw);
    if (value && !out.has(match[1]!)) out.set(match[1]!, value);
  }
  return out;
}

function shownPath(path: string, home: string): string {
  return path === home || path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}

function collect(env: NodeJS.ProcessEnv, home: string, deps: KeySourceDeps): FoundKey[] {
  const decision = (deps.envScan ?? currentEnvScanDecision)();
  if (decision === "deny") return [];
  const fs = deps.fs ?? { readFileSync };
  const found: FoundKey[] = [];

  if (decision === "allow") {
    for (const { name, family } of ENV_SOURCES) {
      const value = keyValue(env[name]);
      if (value) found.push({ id: `env:${name}`, family, label: `${name} (환경 변수)`, endpointName: `${KEY_ROUTES[family].label} (${name})`, value });
    }
  }

  const codexPath = join(env.CODEX_HOME || join(home, ".codex"), "auth.json");
  const codexText = readText(fs, codexPath);
  if (codexText !== undefined) {
    try {
      const auth = JSON.parse(codexText) as { auth_mode?: unknown; OPENAI_API_KEY?: unknown; tokens?: unknown };
      // auth_mode 가 없는 옛 파일은 토큰이 없을 때만 API 키 로그인으로 본다(Codex 의 AuthDotJson).
      const apiKeyMode = auth.auth_mode === "apikey" || (auth.auth_mode === undefined && !auth.tokens);
      const value = apiKeyMode ? keyValue(auth.OPENAI_API_KEY) : undefined;
      if (value) {
        found.push({
          id: "codex:OPENAI_API_KEY", family: "openai",
          label: `Codex CLI 설정의 OpenAI API 키 (${shownPath(codexPath, home)})`, endpointName: "OpenAI (Codex CLI)", value,
        });
      }
    } catch { /* 깨진 JSON 은 출처가 아니다 */ }
  }

  // Gemini CLI 는 GEMINI_CLI_HOME 을 홈으로 쓰고 그 아래 .gemini/.env 를 읽는다(gemini-cli packages/core/src/utils/paths.ts homedir).
  const geminiEnvPath = join(env.GEMINI_CLI_HOME || home, ".gemini", ".env");
  const geminiText = readText(fs, geminiEnvPath);
  if (geminiText !== undefined) {
    const shown = shownPath(geminiEnvPath, home);
    for (const [name, value] of parseDotEnv(geminiText, GEMINI_ENV_NAMES)) {
      found.push({ id: `gemini-env:${name}`, family: "google", label: `${shown} 의 ${name}`, endpointName: `Gemini (${shown})`.slice(0, 60), value });
    }
  }

  // 같은 키가 여러 곳에 있으면 처음 찾은 출처 하나만 남긴다(같은 선택지를 두 번 보이지 않게).
  const seen = new Set<string>();
  return found.filter((row) => (seen.has(row.value) ? false : (seen.add(row.value), true)));
}

function publicView(row: FoundKey): KeySourcePublic {
  const model = keyRouteAdoptModel(row.family);
  const route = KEY_ROUTES[row.family];
  return {
    id: row.id, family: row.family, label: row.label, adoptable: model !== undefined,
    ...(model ? { model } : {}),
    ...(!model && route.unsupportedReason ? { note: route.unsupportedReason } : {}),
  };
}

/**
 * 찾은 키 출처(값 없음). 이미 같은 주소의 엔드포인트가 키와 함께 저장돼 있으면 그 제공자의 출처는 뺀다 — 다시 고를 일이 없다.
 * 읽지 못하는 파일은 출처가 없는 것으로 보고 던지지 않는다.
 */
export function listKeySources(env: NodeJS.ProcessEnv = process.env, home: string = homedir(), deps: KeySourceDeps = {}): KeySourcePublic[] {
  const endpoints = (deps.endpoints ?? listOpenAiCompatPublic)();
  const adopted = new Set(endpoints.filter((row) => row.hasKey).map((row) => checkOpenAiCompatBaseUrl(row.baseUrl).url));
  return collect(env, home, deps)
    .filter((row) => !adopted.has(KEY_ROUTES[row.family].baseUrl))
    .map(publicView);
}

export interface KeyAdoptInput {
  readonly sourceId: string;
  /** 팀 모델 키(flash) 또는 그 제공자 모델 ID(gemini-3.8-flash). 없으면 그 제공자의 기본 워커. */
  readonly model?: string;
  /** OPRN_OH_MY_PI_TEST_STUB=1 일 때만 쓴다(가짜 서버로 하는 e2e). 그 밖에서는 무시하고 KEY_ROUTES 의 고정 주소를 쓴다. */
  readonly testBaseUrl?: unknown;
}

export interface KeyAdoptResult {
  readonly ok: boolean;
  /** ok | not-found | unsupported | invalid-model | error | 시험 코드(auth·tools·chat·network·timeout·server …) */
  readonly code: string;
  readonly message: string;
  /** 시험·기본값으로 쓴(쓰려던) 제공자 모델 ID. */
  readonly model: string;
  readonly endpoint?: OpenAiCompatEndpointPublic;
  readonly endpoints: OpenAiCompatEndpointPublic[];
}

export interface KeyAdoptDeps extends KeySourceDeps {
  readonly env?: NodeJS.ProcessEnv;
  readonly home?: string;
  readonly fetchImpl?: typeof fetch;
}

function readKeyValue(sourceId: string, env: NodeJS.ProcessEnv, home: string, deps: KeySourceDeps): FoundKey | undefined {
  return collect(env, home, deps).find((row) => row.id === sourceId);
}

function redact(text: string, secret: string): string {
  return secret.length >= 4 ? text.split(secret).join("***") : text;
}

/** 찾은 키 하나를 고정 주소로 시험하고 통과하면 사용자 지정 엔드포인트(openai-compat:<slug>)로 저장한다. */
export async function adoptKeySource(input: KeyAdoptInput, deps: KeyAdoptDeps = {}): Promise<KeyAdoptResult> {
  const fail = (code: string, message: string, model = ""): KeyAdoptResult => ({ ok: false, code, message, model, endpoints: listOpenAiCompatPublic() });
  const source = readKeyValue(input.sourceId, deps.env ?? process.env, deps.home ?? homedir(), deps);
  if (!source) return fail("not-found", "그 키를 더 이상 찾을 수 없어요. 키 목록을 새로 고친 뒤 다시 골라 주세요.");
  const route = KEY_ROUTES[source.family];
  const defaultKey = keyRouteAdoptModel(source.family);
  if (!defaultKey) return fail("unsupported", route.unsupportedReason ?? `${route.label} 키는 아직 이 방식으로 연결할 수 없어요.`);

  const wanted = input.model?.trim();
  const entries = Object.entries(route.models) as Array<[TeamModelKey, string]>;
  const picked = wanted ? entries.find(([key, id]) => key === wanted || id === wanted) : entries.find(([key]) => key === defaultKey);
  if (!picked) return fail("invalid-model", `「${wanted}」 은(는) ${route.label} 키로 쓸 수 있는 모델이 아니에요. 쓸 수 있는 모델: ${entries.map(([, id]) => id).join(", ")}`);
  const model = picked[1];
  const testBase = process.env.OPRN_OH_MY_PI_TEST_STUB === "1" ? checkOpenAiCompatBaseUrl(input.testBaseUrl).url : undefined;

  try {
    const result = await connectOpenAiCompatTested({
      name: source.endpointName,
      baseUrl: testBase ?? route.baseUrl,
      apiKey: source.value,
      model,
      reasoningMode: route.reasoningMode,
      contextWindow: route.contextWindow,
      ...(route.maxOutputTokens ? { maxOutputTokens: route.maxOutputTokens } : {}),
    }, deps.fetchImpl ?? fetch);
    return {
      ok: result.ok, code: result.code, message: result.message, model, endpoints: result.endpoints,
      ...(result.endpoint ? { endpoint: result.endpoint } : {}),
    };
  } catch (error) {
    return fail("error", redact(error instanceof Error ? error.message : String(error), source.value), model);
  }
}
