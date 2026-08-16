// benchmark/llmClient.ts
// 벤치마크 LLM 클라이언트(todo 9) — direct API / paste 두 모드.
//
// 설계(계획 todo 9 + src/editor/panels/tilesetAiCpenClient.ts:60-105 미러):
//  - BenchmarkSettings {mode:"api"|"paste", baseUrl?, apiKey?, model?} 를
//    localStorage "rpg-zzu:benchmark-settings" 에 저장한다(키가 저장되는 유일한 곳).
//  - api 모드: loadAiConfig()(@/ai/llmClient) 기본값 + settings 오버라이드로
//    baseUrl/apiKey/model 을 해석하고 POST {baseUrl}/chat/completions 로
//    [system JSON-only, user(text+image_url)] 본문을 보낸다
//    (response_format json_object, max_tokens 8192, temperature 0.2, 120초 타임아웃).
//  - isProxyAuth(상대 baseUrl = /api/ai 등 루프백 게이트웨이)면 클라이언트가
//    Authorization 을 아예 보내지 않는다 — vite 프록시가 서버 측 키를 주입한다.
//  - 오류는 항상 구조화된 {kind, message, status?} 로 반환하고 절대 throw 하지
//    않는다(kind: "config" | "timeout" | "network" | "http" | "response").
//  - 키 전송 가드: apiKey 는 https 또는 localhost/127.0.0.1/[::1] URL 로만 보낸다.
//    평문 http 원격 URL 로의 키 전송은 config 오류로 거부한다(프록시 모드는 키
//    자체를 보내지 않으므로 무관).
//  - paste 모드: pasteAnswerProvider 가 붙여넣은 원문을 그대로 반환한다.
//
// Node 실행 계약: 모듈 top-level 에서 DOM(localStorage/document/window)을
// 접근하지 않는다 — 저장소는 storageFromGlobals() 로 호출 시점에 늦게 해석한다.
import { isProxyAuth, loadAiConfig, type AiConfig } from "@/ai/llmClient";
import { normalizeCpenResponseText } from "@/editor/panels/tilesetAiCpenClient";

export const BENCHMARK_SETTINGS_STORAGE_KEY = "rpg-zzu:benchmark-settings";

/** 요청/응답 정책 상수 — tilesetAiCpenClient.ts 실측값과 동일. */
const MAX_OUTPUT_TOKENS = 8192;
const TEMPERATURE = 0.2;
const REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_MODEL = "google/gemini-3.1-flash-lite";

export interface BenchmarkSettings {
  readonly mode: "api" | "paste";
  readonly baseUrl?: string;
  readonly apiKey?: string;
  readonly model?: string;
}

/** localStorage 최소 계약(테스트는 메모리 stub 을 주입한다). */
export interface BenchmarkStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface BenchmarkSendRequest {
  readonly prompt: string;
  /** data:image/ URL 목록(멀티모달 user 파트). 비면 텍스트 전용 메시지. */
  readonly imageDataUrls: readonly string[];
}

export type BenchmarkSendErrorKind = "config" | "timeout" | "network" | "http" | "response";

export interface BenchmarkSendError {
  readonly kind: BenchmarkSendErrorKind;
  readonly message: string;
  readonly status?: number;
}

export type BenchmarkSendResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly error: BenchmarkSendError };

/** api 모드 전송에 필요한 것들로 해석된 설정. */
export interface ResolvedBenchmarkRequest {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  /** 상대 baseUrl(같은 오리진 프록시) — 클라이언트 키 없이 서버가 인증한다. */
  readonly proxyAuth: boolean;
}

export interface BenchmarkClientDeps {
  /** paste 모드에서 모델의 원문 답변을 공급하는 UI 쪽 콜백(todo 12 실행 뷰). */
  readonly pasteAnswerProvider?: (request: BenchmarkSendRequest) => Promise<string>;
}

type ChatCompletionResponse = {
  readonly choices?: readonly {
    readonly message?: { readonly content?: unknown };
  }[];
};

/** JSON-only 시스템 프롬프트 — tilesetAiCpenClient.ts:22-25 계약 스타일. */
const JSON_ONLY_SYSTEM_PROMPT =
  "Return exactly one JSON object answering the benchmark task. Do not include markdown, prose, code fences, or hidden reasoning. Numbers must be JSON integers.";

// ── 저장소 해석(호출 시점, lazy) ─────────────────────────────────────────

function isStorageLike(value: unknown): value is BenchmarkStorageAdapter {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as BenchmarkStorageAdapter).getItem === "function" &&
      typeof (value as BenchmarkStorageAdapter).setItem === "function" &&
      typeof (value as BenchmarkStorageAdapter).removeItem === "function",
  );
}

/**
 * 저장 어댑터를 늦게 해석한다. getter 를 주면 그것을, 아니면 전역 localStorage 를
 * 본다(브라우저가 아니면 null). 모듈 로드 시점에는 아무것도 건드리지 않는다.
 */
export function storageFromGlobals(getStorage?: () => unknown): BenchmarkStorageAdapter | null {
  const candidate = getStorage ? getStorage() : typeof localStorage === "undefined" ? undefined : localStorage;
  return isStorageLike(candidate) ? candidate : null;
}

// ── 설정 지속화 ─────────────────────────────────────────────────────────

function sanitizeSettings(value: unknown): BenchmarkSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (source.mode !== "api" && source.mode !== "paste") return null;
  const trimOrUndefined = (key: string): string | undefined =>
    typeof source[key] === "string" ? (source[key] as string).trim() || undefined : undefined;
  return {
    mode: source.mode,
    baseUrl: trimOrUndefined("baseUrl"),
    apiKey: trimOrUndefined("apiKey"),
    model: trimOrUndefined("model"),
  };
}

// ── api 모드 요청 해석 ──────────────────────────────────────────────────

/**
 * settings 오버라이드를 loadAiConfig() 기본값 위에 얹어 전송에 필요한 값을
 * 확정한다. 벤치마크 클라이언트는 항상 OpenAI 호환 apiKey 경로로 동작하므로
 * proxyAuth 판정은 isProxyAuth() 에 authMode:"apiKey" + 병합된 baseUrl 로 맡긴다
 * (상대 baseUrl = /api/ai 게이트웨이 → 서버 측 인증).
 */
export function resolveBenchmarkRequest(settings: BenchmarkSettings): ResolvedBenchmarkRequest {
  const aiConfig: AiConfig = loadAiConfig();
  const baseUrl = (settings.baseUrl?.trim() || aiConfig.baseUrl.trim()).replace(/\/$/, "");
  const apiKey = settings.apiKey?.trim() || aiConfig.apiKey.trim();
  const model = settings.model?.trim() || aiConfig.model.trim() || DEFAULT_MODEL;
  const effective: AiConfig = { ...aiConfig, authMode: "apiKey", baseUrl, apiKey, model };
  return { baseUrl, apiKey, model, proxyAuth: isProxyAuth(effective) };
}

/** apiKey 를 이 URL 로 보내도 되는가 — https 또는 루프백만 허용. */
function maySendApiKeyTo(baseUrl: string): boolean {
  if (baseUrl.startsWith("/")) return true; // 상대 경로(같은 오리진) — 실제로는 proxyAuth 경로
  if (/^https:\/\//i.test(baseUrl)) return true;
  const loopback = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])([/:]|$)/i;
  return loopback.test(baseUrl);
}

function messageContent(request: BenchmarkSendRequest): string | readonly unknown[] {
  const images = request.imageDataUrls.filter((url) => url.startsWith("data:image/"));
  if (images.length === 0) return request.prompt;
  return [
    { type: "text", text: request.prompt },
    ...images.map((url) => ({ type: "image_url", image_url: { url } })),
  ];
}

// ── fetch 유틸(tilesetAiCpenClient.ts 미러) ─────────────────────────────

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** 오류 원인을 전송 오류 분류로 변환(throw 금지 계약의 핵심). */
function toSendError(error: unknown): BenchmarkSendError {
  if (error instanceof DOMException && error.name === "AbortError") {
    return { kind: "timeout", message: "AI 응답 시간이 초과되었습니다(120초)." };
  }
  if (error instanceof Error && error.name === "AbortError") {
    return { kind: "timeout", message: "AI 응답 시간이 초과되었습니다(120초)." };
  }
  if (error instanceof TypeError) {
    return { kind: "network", message: "AI 호출 실패: 네트워크 연결 또는 프록시 설정을 확인해 주세요." };
  }
  return { kind: "network", message: `AI 호출 실패: ${error instanceof Error ? error.message : String(error)}` };
}

/** choices[0].message.content — 문자열 또는 content-part 배열(cpen 미러). */
function readResponseText(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("choices" in data)) return null;
  const choices = (data as ChatCompletionResponse).choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        part && typeof part === "object" && "text" in part && typeof (part as { text: unknown }).text === "string"
          ? (part as { text: string }).text
          : "",
      )
      .filter(Boolean)
      .join("\n") || null;
  }
  return null;
}

async function sendViaApi(request: BenchmarkSendRequest, settings: BenchmarkSettings): Promise<BenchmarkSendResult> {
  const resolved = resolveBenchmarkRequest(settings);
  if (!resolved.baseUrl) {
    return {
      ok: false,
      error: {
        kind: "config",
        message:
          "AI 엔드포인트(baseUrl)가 설정되지 않았습니다. 벤치마크 설정에서 OpenAI 호환 baseUrl을 입력하세요.",
      },
    };
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // proxyAuth: 프록시가 서버 측에서 Authorization 을 주입한다 — 클라이언트 키를
  // body/headers 어디에도 실어 보내지 않는다(키 유출 방지, 계획 하드 제약).
  if (resolved.proxyAuth) {
    // no Authorization header
  } else if (resolved.apiKey) {
    if (!maySendApiKeyTo(resolved.baseUrl)) {
      return {
        ok: false,
        error: {
          kind: "config",
          message:
            `apiKey는 https(또는 localhost) baseUrl로만 전송할 수 있습니다 — ${resolved.baseUrl} 은(는) 평문 http 원격 URL 입니다.`,
        },
      };
    }
    headers.Authorization = `Bearer ${resolved.apiKey}`;
  }

  try {
    const response = await fetchWithTimeout(`${resolved.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: resolved.model,
        messages: [
          { role: "system", content: JSON_ONLY_SYSTEM_PROMPT },
          { role: "user", content: messageContent(request) },
        ],
        response_format: { type: "json_object" },
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: TEMPERATURE,
      }),
    });
    if (!response.ok) {
      const body = (await response.text().catch(() => "")).trim().slice(0, 400);
      return {
        ok: false,
        error: {
          kind: "http",
          message: body ? `AI 호출 실패: HTTP ${response.status} ${body}` : `AI 호출 실패: HTTP ${response.status}`,
          status: response.status,
        },
      };
    }
    const data: unknown = await response.json();
    const responseText = readResponseText(data);
    if (responseText === null) {
      return { ok: false, error: { kind: "response", message: "AI 응답을 읽지 못했습니다(빈 content)." } };
    }
    return { ok: true, text: normalizeCpenResponseText(responseText) };
  } catch (error) {
    return { ok: false, error: toSendError(error) };
  }
}

// ── 클라이언트 팩토리 ───────────────────────────────────────────────────

export interface BenchmarkLlmClient {
  /** 설정을 저장소에 기록한다(키가 저장되는 유일한 경로). */
  saveSettings(): void;
  /** 저장된 설정을 읽는다. 없으면 null(기본값을 지어내지 않는다). */
  loadSettings(): BenchmarkSettings | null;
  /** 태스크 하나의 모델 원문 답변을 얻는다(api 호출 또는 paste 공급). */
  send(request: BenchmarkSendRequest): Promise<BenchmarkSendResult>;
}

/**
 * 클라이언트를 만든다. settings 를 주면 그것이 이 클라이언트의 기본 설정이고,
 * storage 를 주면 그 어댑터로 지속화한다(생략 시 호출 시점에 전역 localStorage).
 * 모든 오류 경로가 구조화된 결과로 끝난다 — 호출자 밖으로 throw 하지 않는다.
 */
export function createBenchmarkLlmClient(
  settings?: BenchmarkSettings,
  storage?: BenchmarkStorageAdapter | null,
  deps: BenchmarkClientDeps = {},
): BenchmarkLlmClient {
  const currentSettings = (): BenchmarkSettings => settings ?? { mode: "paste" };
  const resolveStorage = (): BenchmarkStorageAdapter | null => storage ?? storageFromGlobals();

  return {
    saveSettings(): void {
      const target = resolveStorage();
      if (!target) return; // 브라우저가 아니면 조용히 무시(Node/테스트)
      const { mode, baseUrl, apiKey, model } = currentSettings();
      target.setItem(
        BENCHMARK_SETTINGS_STORAGE_KEY,
        JSON.stringify({
          mode,
          ...(baseUrl ? { baseUrl } : {}),
          ...(apiKey ? { apiKey } : {}),
          ...(model ? { model } : {}),
        }),
      );
    },
    loadSettings(): BenchmarkSettings | null {
      const source = resolveStorage();
      if (!source) return null;
      try {
        return sanitizeSettings(JSON.parse(source.getItem(BENCHMARK_SETTINGS_STORAGE_KEY) ?? "null"));
      } catch {
        return null;
      }
    },
    async send(request: BenchmarkSendRequest): Promise<BenchmarkSendResult> {
      const active = currentSettings();
      if (active.mode === "paste") {
        const provider = deps.pasteAnswerProvider;
        if (!provider) {
          return {
            ok: false,
            error: {
              kind: "config",
              message: "paste 모드에는 붙여넣은 답변을 공급해야 합니다(실행 뷰의 pasteAnswerProvider).",
            },
          };
        }
        try {
          return { ok: true, text: await provider(request) };
        } catch (error) {
          return {
            ok: false,
            error: { kind: "config", message: `붙여넣은 답변을 읽지 못했습니다: ${String(error)}` },
          };
        }
      }
      return sendViaApi(request, active);
    },
  };
}
