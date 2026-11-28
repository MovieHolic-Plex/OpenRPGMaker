// 동반 서비스: 제공자가 «지금 실제로 내주는» 모델 목록을 받아 온다(GET /v1/models?family=gpt|claude).
//
//  - gpt    → Codex 백엔드 `GET https://chatgpt.com/backend-api/codex/models?client_version=<버전>`(ChatGPT 로그인 토큰).
//             client_version 은 요청 때 쓰는 값(OPRN_CODEX_CLIENT_VERSION)과 같아야 «실제로 부를 수 있는» 모델만 온다
//             (scripts/lib/codexClientVersion.ts: 버전이 낮으면 새 모델이 목록에 없고, 목록에 있으면 그 버전으로 호출된다).
//  - claude → Anthropic `GET https://api.anthropic.com/v1/models?limit=1000`. 기본 쪽수가 20 이라 limit 을 올려야 목록이 잘리지 않는다.
//             자격은 ① 사용자가 연결한 Anthropic API 키 엔드포인트 ② ANTHROPIC_API_KEY(환경 변수 읽기에 동의한 경우)·저장된 키 순서.
//             Claude Code 구독 로그인만 있는 PC 는 목록을 받을 수 없다 — 우리는 그 CLI 의 토큰을 보지 않는다(no-credential).
//
// 실패는 던지지 않는다: 호출부(설정 화면)가 코드의 프리셋으로 물러서도록 `{ ok:false, reason }` 을 돌려준다. 모델을 바꿔치기하지 않는다.
// 성공한 목록은 10분 캐시(제공자를 두드리는 횟수를 줄인다), `fresh` 로 우회한다. 같은 계열의 동시 요청은 한 번으로 합친다.
import {
  isLiveModelFamily,
  parseAnthropicModelList,
  parseCodexModelList,
  type LiveModelFamily,
  type LiveModelResult,
} from "../../src/ai/liveModels.ts";
import { decodeJwtPayload } from "../../src/ai/oauth/credentials.ts";
import { OPRN_CODEX_CLIENT_VERSION } from "./codexClientVersion.ts";

export const LIVE_MODELS_TIMEOUT_MS = 8_000;
export const LIVE_MODELS_CACHE_TTL_MS = 10 * 60_000;
const CODEX_MODELS_URL = "https://chatgpt.com/backend-api/codex/models";
const ANTHROPIC_ORIGIN = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_MAX_PAGES = 5;
const AUTH_CLAIM = "https://api.openai.com/auth";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** 자격 해석을 밖에서 주입한다 — 실제 구현(aiAuthRuntime·openAiCompatRuntime)은 호출부(ohMyPiPiAi.mjs)가 꽂는다. */
export interface LiveModelDeps {
  readonly fetchImpl?: FetchLike;
  readonly now?: () => number;
  /** ChatGPT(Codex) 로그인의 요청 토큰. 로그인이 없으면 undefined. */
  readonly codexAccessToken: () => Promise<string | undefined>;
  /** Anthropic 으로 보낼 수 있는 자격 후보(앞이 우선). baseOrigin 은 https://api.anthropic.com 형태다. */
  readonly anthropicCredentials: () => Promise<readonly AnthropicCredential[]>;
}

export interface AnthropicCredential {
  readonly source: "anthropic-compat" | "anthropic-api";
  readonly key: string;
  readonly origin?: string;
}

interface CacheEntry { readonly at: number; readonly result: Extract<LiveModelResult, { ok: true }> }
const cache = new Map<LiveModelFamily, CacheEntry>();
const inflight = new Map<LiveModelFamily, Promise<LiveModelResult>>();

export function resetLiveModelCacheForTests(): void {
  cache.clear();
  inflight.clear();
}

function failure(family: LiveModelFamily, now: number, reason: "no-credential" | "upstream-error" | "timeout", message: string): LiveModelResult {
  return { ok: false, family, reason, message, fetchedAt: now };
}

function codexAccountId(token: string): string | undefined {
  const payload = decodeJwtPayload<Record<string, unknown>>(token);
  const auth = payload?.[AUTH_CLAIM];
  const id = auth && typeof auth === "object" ? (auth as Record<string, unknown>).chatgpt_account_id : undefined;
  return typeof id === "string" && id.trim() ? id.trim() : undefined;
}

async function boundedJson(fetchImpl: FetchLike, url: string, init: RequestInit): Promise<{ status: number; json: unknown }> {
  // AbortSignal.timeout 대신 직접 만든다 — 일부 DOM 대체 구현(테스트 환경)에는 정적 timeout 이 없다.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(Object.assign(new Error("timeout"), { name: "TimeoutError" })), LIVE_MODELS_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    let json: unknown = null;
    try { json = await response.json(); } catch { json = null; }
    return { status: response.status, json };
  } finally {
    clearTimeout(timer);
  }
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

async function fetchGpt(deps: LiveModelDeps, fetchImpl: FetchLike, now: number): Promise<LiveModelResult> {
  let token: string | undefined;
  try { token = await deps.codexAccessToken(); } catch { token = undefined; }
  if (!token) return failure("gpt", now, "no-credential", "ChatGPT 로그인이 없어 서버의 모델 목록을 받지 못했어요.");
  const accountId = codexAccountId(token);
  const url = `${CODEX_MODELS_URL}?client_version=${encodeURIComponent(OPRN_CODEX_CLIENT_VERSION)}`;
  try {
    const { status, json } = await boundedJson(fetchImpl, url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(accountId ? { "chatgpt-account-id": accountId } : {}),
        originator: "codex_cli_rs",
        version: OPRN_CODEX_CLIENT_VERSION,
        Accept: "application/json",
      },
    });
    if (status < 200 || status >= 300) return failure("gpt", now, "upstream-error", `ChatGPT 서버가 모델 목록을 거절했어요(HTTP ${status}).`);
    const models = parseCodexModelList(json);
    if (!models.length) return failure("gpt", now, "upstream-error", "ChatGPT 서버가 빈 모델 목록을 돌려줬어요.");
    return { ok: true, family: "gpt", source: "codex-backend", fetchedAt: now, models };
  } catch (error) {
    return isTimeout(error)
      ? failure("gpt", now, "timeout", "ChatGPT 서버의 모델 목록 응답이 늦어요.")
      : failure("gpt", now, "upstream-error", "ChatGPT 서버에 닿지 못했어요.");
  }
}

function anthropicHeaders(key: string): Record<string, string> {
  // 구독 OAuth 토큰(sk-ant-oat…)은 Bearer + 베타 머리글, API 키는 x-api-key.
  const oauth = key.startsWith("sk-ant-oat");
  return {
    ...(oauth ? { Authorization: `Bearer ${key}`, "anthropic-beta": "oauth-2025-04-20" } : { "x-api-key": key }),
    "anthropic-version": ANTHROPIC_VERSION,
    Accept: "application/json",
  };
}

async function fetchClaude(deps: LiveModelDeps, fetchImpl: FetchLike, now: number): Promise<LiveModelResult> {
  let credentials: readonly AnthropicCredential[] = [];
  try { credentials = await deps.anthropicCredentials(); } catch { credentials = []; }
  if (!credentials.length) {
    return failure("claude", now, "no-credential", "Claude API 키가 없어 서버의 모델 목록을 받지 못했어요(Claude Code 로그인만으로는 목록을 읽을 수 없어요).");
  }
  let lastMessage = "Anthropic 서버에 닿지 못했어요.";
  let lastReason: "upstream-error" | "timeout" = "upstream-error";
  for (const credential of credentials) {
    const origin = credential.origin ?? ANTHROPIC_ORIGIN;
    try {
      const all = [] as ReturnType<typeof parseAnthropicModelList>;
      let afterId = "";
      let failed = false;
      for (let page = 0; page < ANTHROPIC_MAX_PAGES; page += 1) {
        const url = `${origin}/v1/models?limit=1000${afterId ? `&after_id=${encodeURIComponent(afterId)}` : ""}`;
        const { status, json } = await boundedJson(fetchImpl, url, { method: "GET", headers: anthropicHeaders(credential.key) });
        if (status < 200 || status >= 300) {
          lastMessage = `Anthropic 서버가 모델 목록을 거절했어요(HTTP ${status}).`;
          lastReason = "upstream-error";
          failed = true;
          break;
        }
        all.push(...parseAnthropicModelList(json));
        const body = json && typeof json === "object" ? json as { has_more?: unknown; last_id?: unknown } : {};
        if (body.has_more === true && typeof body.last_id === "string" && body.last_id) afterId = body.last_id;
        else break;
      }
      if (failed) continue;
      const seen = new Set<string>();
      const models = all.filter((model) => !seen.has(model.id) && !!seen.add(model.id));
      if (!models.length) { lastMessage = "Anthropic 서버가 빈 모델 목록을 돌려줬어요."; lastReason = "upstream-error"; continue; }
      return { ok: true, family: "claude", source: credential.source === "anthropic-compat" ? "anthropic-compat" : "anthropic-api", fetchedAt: now, models };
    } catch (error) {
      if (isTimeout(error)) { lastMessage = "Anthropic 서버의 모델 목록 응답이 늦어요."; lastReason = "timeout"; }
      else { lastMessage = "Anthropic 서버에 닿지 못했어요."; lastReason = "upstream-error"; }
    }
  }
  return failure("claude", now, lastReason, lastMessage);
}

/** 한 계열의 실제 모델 목록. 던지지 않는다. */
export async function listLiveModels(family: unknown, deps: LiveModelDeps, options: { readonly fresh?: boolean } = {}): Promise<LiveModelResult> {
  const now = (deps.now ?? Date.now)();
  if (!isLiveModelFamily(family)) {
    return { ok: false, family: "gpt", reason: "upstream-error", message: "family 는 gpt 또는 claude 여야 해요.", fetchedAt: now };
  }
  const cached = cache.get(family);
  if (!options.fresh && cached && now - cached.at < LIVE_MODELS_CACHE_TTL_MS) return cached.result;
  const running = inflight.get(family);
  if (running) return running;
  const fetchImpl = deps.fetchImpl ?? ((input, init) => fetch(input, init));
  const job = (family === "gpt" ? fetchGpt(deps, fetchImpl, now) : fetchClaude(deps, fetchImpl, now))
    .then((result) => {
      if (result.ok) cache.set(family, { at: now, result });
      return result;
    })
    .finally(() => { inflight.delete(family); });
  inflight.set(family, job);
  return job;
}
