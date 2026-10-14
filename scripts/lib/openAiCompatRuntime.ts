// 사용자 지정(OpenAI 호환) 엔드포인트 — 동반 서비스(Node)의 관리·시험·실행 자격 해석.
//
// 순수 Node 다(Bun 불필요). 와이어 전송(채팅 스트리밍·도구 호출)은 Bun 워커가 pi-ai 의 `openai-completions` 로 한다 —
// 이 파일은 «어느 주소에 어떤 자격으로» 를 정해 워커에 넘기는 일과, 설정 화면의 「연결 시험」만 맡는다.
//
// 보안 계약:
//  - 키·헤더 값은 응답·오류·로그에 실리지 않는다(redact). 브라우저에는 hasKey/headerNames 만 간다.
//  - 이 프로세스가 말을 거는 곳은 사용자가 저장(또는 시험 중 입력)한 기본 주소의 호스트뿐이다. 리다이렉트는 따라가지 않는다.
//  - 클라우드 메타데이터·링크로컬 주소는 호스트 이름이 풀린 결과까지 포함해 막는다(DNS 로 메타데이터 IP 를 가리키는 이름 대비).
//    이 검사는 요청 직전의 최선 검사다 — 검사와 연결 사이에 DNS 가 바뀌는 경쟁(TOCTOU)은 막지 못한다. 문서에 한계로 적었다.

import { lookup } from "node:dns/promises";
import {
  OPENAI_COMPAT_MODELS_TIMEOUT_MS,
  OPENAI_COMPAT_NO_KEY,
  checkOpenAiCompatBaseUrl,
  explainOpenAiCompatError,
  isBlockedOpenAiCompatHost,
  isOpenAiCompatProviderId,
  openAiCompatAllowedModels,
  openAiCompatModelVerdict,
  type OpenAiCompatEndpointPublic,
  type OpenAiCompatLastTest,
  type OpenAiCompatWorkerEndpoint,
} from "../../src/ai/openAiCompat.ts";
import {
  openAiCompatPublicView,
  openAiCompatStore,
  type OpenAiCompatSaveInput,
  type StoredOpenAiCompatEndpoint,
} from "./openAiCompatStore.ts";

export { OPENAI_COMPAT_NO_KEY, type OpenAiCompatWorkerEndpoint };

function httpError(message: string, status = 400): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

function redactor(secrets: readonly string[]): (text: string) => string {
  const needles = secrets.filter((secret) => secret.length >= 4);
  return (text) => needles.reduce((acc, secret) => acc.split(secret).join("***"), text);
}

export function listOpenAiCompatPublic(): OpenAiCompatEndpointPublic[] {
  return openAiCompatStore.list().map(({ id, row }) => openAiCompatPublicView(id, row));
}

export function saveOpenAiCompat(input: OpenAiCompatSaveInput): OpenAiCompatEndpointPublic {
  return openAiCompatStore.upsert(input);
}

export function deleteOpenAiCompat(id: string): { removed: boolean; endpoints: OpenAiCompatEndpointPublic[] } {
  if (!isOpenAiCompatProviderId(id)) throw httpError("엔드포인트 id 형식이 올바르지 않습니다.");
  const removed = openAiCompatStore.remove(id);
  return { removed, endpoints: listOpenAiCompatPublic() };
}

/** `/auth/status` 모양. 연결됨 = 엔드포인트가 저장돼 있다(키는 선택이므로 키 유무로 판정하지 않는다). 실제 도달은 「연결 시험」이 말한다. */
export function openAiCompatStatus(id: string) {
  const row = openAiCompatStore.get(id);
  if (!row) return { connected: false, provider: id, authKind: "apiKey" as const, lastLoginError: "저장된 엔드포인트가 없습니다. AI 설정에서 다시 추가하세요." };
  return { connected: true, provider: id, authKind: "apiKey" as const, planType: row.name, expired: false };
}

/** 호스트 이름이 풀린 모든 주소가 허용되는지. 막히면 사람 말 오류. */
export async function assertOpenAiCompatHostSafe(baseUrl: string): Promise<void> {
  const url = new URL(baseUrl);
  if (isBlockedOpenAiCompatHost(url.hostname)) throw httpError("이 주소(클라우드 메타데이터·링크로컬)에는 연결하지 않아요.");
  if (/^[\d.]+$/u.test(url.hostname) || url.hostname.includes(":")) return; // IP 직접 지정은 위 검사로 충분하다
  try {
    const addresses = await lookup(url.hostname, { all: true });
    if (addresses.some((entry) => isBlockedOpenAiCompatHost(entry.address))) {
      throw httpError(`${url.hostname} 이(가) 클라우드 메타데이터·링크로컬 주소로 연결돼 있어 막았어요.`);
    }
  } catch (error) {
    if (error && typeof error === "object" && "status" in error) throw error;
    // 이름 풀이 실패는 여기서 막지 않는다 — 실제 연결이 «호스트를 찾지 못했다» 로 말한다.
  }
}

function authHeaders(row: Pick<StoredOpenAiCompatEndpoint, "apiKey" | "headers">, apiKeyOverride?: string): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json", ...row.headers };
  const key = apiKeyOverride ?? row.apiKey;
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

/** 워커·완성 호출에 쓸 자격. 엔드포인트가 없거나 주소가 허용되지 않으면 status 400/404. */
export async function resolveOpenAiCompatRun(ids: readonly string[]): Promise<{
  endpoints: Record<string, OpenAiCompatWorkerEndpoint>;
  keys: Record<string, string>;
}> {
  const endpoints: Record<string, OpenAiCompatWorkerEndpoint> = {};
  const keys: Record<string, string> = {};
  for (const id of new Set(ids.filter(isOpenAiCompatProviderId))) {
    const row = openAiCompatStore.get(id);
    if (!row) throw httpError("사용자 지정 엔드포인트가 지워졌거나 없습니다. AI 설정 → 연결에서 다시 추가하거나 다른 제공자를 고르세요.", 404);
    const check = checkOpenAiCompatBaseUrl(row.baseUrl);
    if (!check.ok || !check.url) throw httpError(`${row.name}: ${check.error ?? "기본 주소가 올바르지 않습니다."}`);
    if (check.insecurePublic && !row.allowInsecurePublic) throw httpError(`${row.name}: 공개 주소에 http 로 연결하려면 설정에서 「그래도 사용」을 확인해야 해요.`);
    await assertOpenAiCompatHostSafe(check.url);
    endpoints[id] = {
      id,
      name: row.name,
      baseUrl: check.url,
      headers: { ...row.headers },
      keyless: row.apiKey.length === 0,
      reasoningMode: row.reasoningMode,
      allowModels: row.allowModels,
      blockModels: row.blockModels,
      supportsImages: row.supportsImages,
      maxOutputTokens: row.maxOutputTokens,
      contextWindow: row.contextWindow,
      firstTokenTimeoutSec: row.firstTokenTimeoutSec,
    };
    keys[id] = row.apiKey || OPENAI_COMPAT_NO_KEY;
  }
  return { endpoints, keys };
}

/**
 * 호스트 요청 직전 검사 — 이 실행·완성이 쓸 (제공자, 모델) 쌍이 엔드포인트의 허용/차단 패턴을 지키는지 본다.
 * 막히면 모델·워커를 부르기 전에 status 403 으로 끝낸다. 다른 모델로 바꿔 보내지 않는다(폴백 금지).
 */
export function assertOpenAiCompatModelsAllowed(pairs: ReadonlyArray<{ readonly provider: unknown; readonly model: unknown }>): void {
  for (const { provider, model } of pairs) {
    if (typeof provider !== "string" || !isOpenAiCompatProviderId(provider)) continue;
    const row = openAiCompatStore.get(provider);
    if (!row) continue; // 없는 엔드포인트는 resolveOpenAiCompatRun 이 404 로 말한다
    const id = typeof model === "string" ? model.trim() : "";
    if (!id) continue; // 빈 모델은 워커의 「모델이 선택되지 않았어요」 가 말한다
    const verdict = openAiCompatModelVerdict(row, id);
    if (!verdict.allowed) throw httpError(`${row.name}: 모델 「${id}」 호출을 거절했어요. ${verdict.reason ?? ""} 다른 모델로 바꿔 보내지 않아요. 연결 설정에서 허용/차단 패턴을 확인하세요.`, 403);
  }
}

export function resolveOpenAiCompatRequestKey(id: string): string {
  const row = openAiCompatStore.get(id);
  if (!row) throw httpError("사용자 지정 엔드포인트가 지워졌거나 없습니다. AI 설정 → 연결에서 다시 추가하거나 다른 제공자를 고르세요.", 404);
  return row.apiKey || OPENAI_COMPAT_NO_KEY;
}

// ── 연결 시험 ─────────────────────────────────────────────────────────────────

function inputPolicy(input: { readonly allowModels?: unknown; readonly blockModels?: unknown }, stored: { allowModels: readonly string[]; blockModels: readonly string[] }) {
  const list = (value: unknown, fallback: readonly string[]) => Array.isArray(value)
    ? value.filter((p): p is string => typeof p === "string" && p.trim().length > 0) : typeof value === "string"
      ? value.split(/[\n,]+/u).map((p) => p.trim()).filter(Boolean) : fallback;
  return { allowModels: list(input.allowModels, stored.allowModels), blockModels: list(input.blockModels, stored.blockModels) };
}

export interface OpenAiCompatTestInput {
  readonly name?: unknown;
  /** 아직 저장하지 않은 폼의 패턴 — 있으면 저장된 값보다 우선한다(시험 호출이 차단 모델을 부르지 않게). */
  readonly allowModels?: unknown;
  readonly blockModels?: unknown;
  readonly id?: unknown;
  readonly baseUrl?: unknown;
  readonly apiKey?: unknown;
  readonly headers?: unknown;
  readonly allowInsecurePublic?: unknown;
  /** 있으면 이 모델로 짧은 채팅을 한 번 보내 본다(토큰 몇 개 소비). */
  readonly model?: unknown;
  /** 모델이 있을 때 도구 호출(tools) 가능 여부도 시험한다. */
  readonly probeTools?: unknown;
}

export interface OpenAiCompatTestResult {
  readonly ok: boolean;
  /** auth | not-found | network | timeout | redirect | not-json | blocked | invalid | server | insecure | ok */
  readonly code: string;
  readonly status?: number;
  readonly message: string;
  readonly models: string[];
  /** /models 가 목록을 줬는가. false 여도 채팅 시험이 통과하면 서버는 쓸 수 있다(직접 모델 ID 입력). */
  readonly modelsAvailable: boolean;
  /** 허용/차단 패턴 때문에 목록에서 숨긴 모델 수. */
  readonly hiddenModels: number;
  readonly chat?: { readonly ok: boolean; readonly status?: number; readonly message?: string };
  /** true/false = 도구 호출 시험 결과, null = 시험하지 않았다. */
  readonly toolsOk: boolean | null;
  readonly latencyMs: number;
  readonly warnings: string[];
}

type FetchLike = typeof fetch;

async function boundedFetch(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ status: number; text: string; location?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...init, redirect: "manual", signal: controller.signal });
    const location = response.headers.get("location") ?? undefined;
    // 본문은 2MB 까지만 읽는다 — 모델 목록 말고는 읽을 일이 없고, 엉뚱한 서버가 무한 본문을 주는 경우를 막는다.
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2 * 1024 * 1024) { void reader.cancel().catch(() => undefined); break; }
        chunks.push(value);
      }
    }
    return { status: response.status, text: Buffer.concat(chunks).toString("utf8"), ...(location ? { location } : {}) };
  } finally {
    clearTimeout(timer);
  }
}

function errorTextOf(text: string): string {
  try {
    const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
    const err = parsed.error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string") return (err as { message: string }).message;
    if (typeof parsed.message === "string") return parsed.message;
  } catch { /* 본문이 JSON 이 아님 */ }
  return text.replace(/\s+/gu, " ").trim().slice(0, 240);
}

function modelIdsOf(text: string): string[] | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    const list = Array.isArray(parsed) ? parsed
      : Array.isArray((parsed as { data?: unknown })?.data) ? (parsed as { data: unknown[] }).data
      : Array.isArray((parsed as { models?: unknown })?.models) ? (parsed as { models: unknown[] }).models : null;
    if (!list) return null;
    const ids = list.flatMap((item) => {
      if (typeof item === "string") return [item];
      const id = (item as { id?: unknown; name?: unknown })?.id ?? (item as { name?: unknown })?.name;
      return typeof id === "string" ? [id] : [];
    });
    return [...new Set(ids)].sort((a, b) => a.localeCompare(b)).slice(0, 500);
  } catch {
    return null;
  }
}

export async function testOpenAiCompat(input: OpenAiCompatTestInput, fetchImpl: FetchLike = fetch): Promise<OpenAiCompatTestResult> {
  const started = Date.now();
  const stored = typeof input.id === "string" && isOpenAiCompatProviderId(input.id) ? openAiCompatStore.get(input.id) : undefined;
  const name = stored?.name || (typeof input.name === "string" && input.name.trim() ? input.name.trim().slice(0, 60) : "") || "사용자 지정 엔드포인트";
  const warnings: string[] = [];
  const done = (partial: Omit<OpenAiCompatTestResult, "latencyMs" | "warnings" | "models" | "modelsAvailable" | "toolsOk" | "hiddenModels"> & Partial<Pick<OpenAiCompatTestResult, "models" | "modelsAvailable" | "toolsOk" | "hiddenModels">>): OpenAiCompatTestResult => ({
    models: [], modelsAvailable: false, toolsOk: null, hiddenModels: 0, ...partial, latencyMs: Date.now() - started, warnings,
  });

  const check = checkOpenAiCompatBaseUrl(input.baseUrl ?? stored?.baseUrl);
  if (!check.ok || !check.url) return done({ ok: false, code: "invalid", message: check.error ?? "기본 주소가 올바르지 않아요." });
  warnings.push(...check.warnings);
  const allowInsecure = input.allowInsecurePublic === true || (input.allowInsecurePublic === undefined && stored?.allowInsecurePublic === true);
  if (check.insecurePublic && !allowInsecure) {
    return done({ ok: false, code: "insecure", message: "공개 인터넷 주소에 http(암호화 없음)로는 시험하지 않아요. https 주소를 쓰거나 「그래도 사용」을 확인하세요." });
  }
  try {
    await assertOpenAiCompatHostSafe(check.url);
  } catch (error) {
    return done({ ok: false, code: "blocked", message: error instanceof Error ? error.message : "허용되지 않는 주소예요." });
  }

  // 시험에 쓸 자격: 입력한 값이 이기고, 없으면 저장된 값을 쓴다(저장된 키를 다시 입력하지 않아도 된다).
  const keyInput = typeof input.apiKey === "string" && input.apiKey.trim() ? input.apiKey.trim() : undefined;
  const headersInput = Array.isArray(input.headers) ? input.headers : undefined;
  const headers: Record<string, string> = { ...(stored?.headers ?? {}) };
  if (headersInput) {
    for (const key of Object.keys(headers)) delete headers[key];
    for (const entry of headersInput) {
      const headerName = String((entry as { name?: unknown })?.name ?? "").trim();
      if (!headerName) continue;
      const value = (entry as { value?: unknown })?.value;
      const kept = Object.entries(stored?.headers ?? {}).find(([n]) => n.toLowerCase() === headerName.toLowerCase())?.[1];
      const resolved = typeof value === "string" && value ? value : kept;
      if (resolved !== undefined) headers[headerName] = resolved;
    }
  }
  const apiKey = keyInput ?? stored?.apiKey ?? "";
  const hide = redactor([apiKey, ...Object.values(headers)]);
  const requestHeaders = authHeaders({ apiKey, headers });
  const explain = (raw: string) => hide(explainOpenAiCompatError(raw, { name, baseUrl: check.url }));

  // 1) GET {base}/models
  let models: string[] = [];
  let modelsAvailable = false;
  let modelsNote = "";
  try {
    const response = await boundedFetch(fetchImpl, `${check.url}/models`, { method: "GET", headers: requestHeaders }, OPENAI_COMPAT_MODELS_TIMEOUT_MS);
    if (response.status >= 300 && response.status < 400) {
      return done({ ok: false, code: "redirect", status: response.status,
        message: `서버가 다른 주소로 넘기려 해요(${response.status}${response.location ? ` → ${hide(response.location).slice(0, 120)}` : ""}). 보안상 따라가지 않아요. 넘겨 주는 최종 주소를 기본 주소로 넣으세요.` });
    }
    if (response.status === 401 || response.status === 403) {
      return done({ ok: false, code: "auth", status: response.status, message: explain(`${response.status} ${errorTextOf(response.text)}`) });
    }
    if (response.status === 404 || response.status === 405) {
      modelsNote = explain(`${response.status} ${errorTextOf(response.text) || "not found"}`);
    } else if (response.status >= 500) {
      return done({ ok: false, code: "server", status: response.status, message: explain(`${response.status} ${errorTextOf(response.text)}`) });
    } else if (response.status >= 400) {
      modelsNote = explain(`${response.status} ${errorTextOf(response.text)}`);
    } else {
      const ids = modelIdsOf(response.text);
      if (ids === null) {
        return done({ ok: false, code: "not-json", status: response.status,
          message: "주소는 열렸지만 모델 목록 형식이 아니에요. 웹 화면 주소가 아니라 API 주소(보통 …/v1)를 넣으세요." });
      }
      models = ids;
      modelsAvailable = ids.length > 0;
    }
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    const raw = aborted ? "timed out" : `${(error as { cause?: { code?: string } })?.cause?.code ?? ""} ${error instanceof Error ? error.message : String(error)}`;
    return done({ ok: false, code: aborted ? "timeout" : "network", message: explain(raw) });
  }

  // 허용/차단 패턴은 목록에서 먼저 걷는다 — 차단된 모델은 사용자에게 아예 보이지 않는다(몇 개를 숨겼는지만 알린다).
  const policy = inputPolicy(input, { allowModels: stored?.allowModels ?? [], blockModels: stored?.blockModels ?? [] });
  const listedCount = models.length;
  models = openAiCompatAllowedModels(policy, models);
  const hiddenModels = listedCount - models.length;
  modelsAvailable = models.length > 0;

  // 2) 선택: 짧은 채팅 + 도구 시험
  const modelId = typeof input.model === "string" ? input.model.trim() : "";
  const probeVerdict = modelId ? openAiCompatModelVerdict(policy, modelId) : { allowed: true };
  let chat: OpenAiCompatTestResult["chat"];
  let toolsOk: boolean | null = null;
  if (modelId && !probeVerdict.allowed) {
    // 차단된 모델은 시험 호출도 하지 않는다(비싼 모델을 시험하다 부르는 일을 막는다).
    chat = { ok: false, message: `모델 「${modelId}」 은(는) 호출하지 않았어요. ${probeVerdict.reason ?? ""}` };
  } else if (modelId) {
    const chatUrl = `${check.url}/chat/completions`;
    const post = (body: Record<string, unknown>) => boundedFetch(fetchImpl, chatUrl, {
      method: "POST", headers: { ...requestHeaders, "Content-Type": "application/json" }, body: JSON.stringify(body),
    }, 60_000);
    const base = { model: modelId, messages: [{ role: "user", content: "ping" }], max_tokens: 16, stream: false };
    try {
      if (input.probeTools === true) {
        const withTools = await post({ ...base, tools: [{ type: "function", function: { name: "noop", description: "no-op probe", parameters: { type: "object", properties: {} } } }] });
        if (withTools.status < 300) {
          toolsOk = true;
          chat = { ok: true, status: withTools.status };
        } else {
          const text = errorTextOf(withTools.text);
          const toolsRejected = withTools.status === 400 || withTools.status === 422;
          const plain = toolsRejected ? await post(base) : undefined;
          if (plain && plain.status < 300) {
            toolsOk = false;
            chat = { ok: true, status: plain.status };
          } else {
            chat = { ok: false, status: withTools.status, message: explain(`${withTools.status} ${text}`) };
          }
        }
      } else {
        const plain = await post(base);
        chat = plain.status < 300 ? { ok: true, status: plain.status } : { ok: false, status: plain.status, message: explain(`${plain.status} ${errorTextOf(plain.text)}`) };
      }
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      chat = { ok: false, message: explain(aborted ? "timed out" : error instanceof Error ? error.message : String(error)) };
    }
  }

  const chatFailed = chat && !chat.ok;
  const ok = !chatFailed && (modelsAvailable || (chat?.ok === true));
  const message = chatFailed ? `모델 목록은 받았지만 채팅 시험이 실패했어요. ${chat?.message ?? ""}`.trim()
    : modelsAvailable ? `연결됐어요 · 모델 ${models.length}개${hiddenModels ? `(차단·비허용 ${hiddenModels}개 숨김)` : ""}${chat?.ok ? ` · ${modelId} 응답 확인` : ""}`
    : chat?.ok ? `채팅은 되지만 모델 목록을 받지 못했어요. 모델 ID 를 직접 입력하세요.${modelsNote ? ` ${modelsNote}` : ""}`
    : hiddenModels > 0 ? `서버가 모델 ${hiddenModels}개를 알려 줬지만 전부 허용/차단 패턴에 걸려 숨겼어요. 패턴을 확인하세요.`
    : `서버에는 닿았지만 모델 목록이 비어 있어요. ${modelsNote || "모델 ID 를 직접 입력하고 다시 시험해 보세요."}`;
  const result = done({
    ok, code: ok ? "ok" : chatFailed ? "server" : "not-found", ...(chat?.status ? { status: chat.status } : {}),
    message, models, modelsAvailable, hiddenModels, ...(chat ? { chat } : {}), toolsOk,
  });
  if (stored && typeof input.id === "string") {
    const lastTest: OpenAiCompatLastTest = {
      at: Date.now(), ok, ...(chat?.status ? { status: chat.status } : {}),
      toolsOk, message: message.slice(0, 200),
    };
    openAiCompatStore.recordTest(input.id, { models, lastTest });
  }
  return result;
}
