// 편집기 쪽 «실제 모델 목록» 보관소 — GPT·Claude 만(Google 은 제외).
//
// 동반 서비스(GET /v1/models?family=)가 제공자에게서 받아 준 목록을 가져와 두 곳에 쓴다:
//  1) 메모리 + localStorage 캐시(6시간) — 설정 화면을 열 때마다 제공자를 두드리지 않는다. 열 때 낡았으면 한 번 새로 받는다.
//  2) modelCatalog 의 registerLiveModelIds — 직접 입력 검증과 고급 모델 선택기가 새 모델을 «지원 안 함» 으로 거절하지 않게 한다.
// 목록을 못 받으면(로그인 없음·네트워크·서버 거절) 상태만 failed 로 남기고, 마지막으로 성공한 캐시가 있으면 그것을 계속 쓴다.
// 프리셋(코드에 박힌 권장 목록)은 그대로다 — 이 모듈은 거기에 «덧붙일» 모델만 안다. 모델을 바꿔치기하지 않는다.
import { fetchCompanion } from "@/ai/companionConnection";
import { isLiveModelFamily, LIVE_MODEL_FAMILIES, type LiveModel, type LiveModelFamily, type LiveModelResult, type LiveModelSource } from "@/ai/liveModels";
import { registerLiveModelIds } from "@/ai/modelCatalog";
import { CODEX_PROVIDER_ID } from "@/ai/oauth/credentials";
import { ANTHROPIC_PROVIDER_ID } from "@/ai/ohMyPiProviders";

export const LIVE_MODELS_STORAGE_KEY = "oprn:ai:live-models:v1";
export const LIVE_MODELS_CHANGED_EVENT = "oprn:ai-live-models-changed";
/** 캐시가 이보다 오래되면 설정 화면이 열릴 때 한 번 새로 받는다. 수동 「새로고침」은 이 값과 무관하다. */
export const LIVE_MODELS_STALE_MS = 6 * 60 * 60_000;
const REQUEST_TIMEOUT_MS = 12_000;

export type LiveModelStatus = "idle" | "loading" | "ok" | "failed";

export interface LiveModelState {
  readonly status: LiveModelStatus;
  /** 마지막으로 성공해 받은 목록(캐시 포함). 실패해도 남는다. */
  readonly models: readonly LiveModel[];
  readonly source?: LiveModelSource;
  /** 마지막 성공 시각(ms). 한 번도 못 받았으면 undefined. */
  readonly fetchedAt?: number;
  /** status 가 failed 일 때 사용자에게 보일 이유. */
  readonly message?: string;
}

const PROVIDER_OF: Readonly<Record<LiveModelFamily, string>> = { gpt: CODEX_PROVIDER_ID, claude: ANTHROPIC_PROVIDER_ID };

const states = new Map<LiveModelFamily, LiveModelState>();
const inflight = new Map<LiveModelFamily, Promise<LiveModelState>>();
const lastFailureAt = new Map<LiveModelFamily, number>();
/** 실패한 뒤 자동 재시도(force 아님)까지 기다리는 시간 — 화면이 다시 그려질 때마다 제공자를 두드리지 않게 한다. */
export const LIVE_MODELS_RETRY_BACKOFF_MS = 60_000;
let hydrated = false;

function storage(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

function emit(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LIVE_MODELS_CHANGED_EVENT));
}

function validModels(value: unknown): LiveModel[] {
  if (!Array.isArray(value)) return [];
  const out: LiveModel[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const { id, label } = row as { id?: unknown; label?: unknown };
    if (typeof id !== "string" || !id.trim()) continue;
    out.push({ id: id.trim(), label: typeof label === "string" && label.trim() ? label.trim() : id.trim() });
  }
  return out;
}

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = storage()?.getItem(LIVE_MODELS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<Record<LiveModelFamily, { models?: unknown; fetchedAt?: unknown; source?: unknown }>>;
    for (const family of LIVE_MODEL_FAMILIES) {
      const entry = parsed[family];
      const models = validModels(entry?.models);
      const fetchedAt = typeof entry?.fetchedAt === "number" && Number.isFinite(entry.fetchedAt) ? entry.fetchedAt : undefined;
      if (!models.length || fetchedAt === undefined) continue;
      states.set(family, { status: "ok", models, fetchedAt, ...(typeof entry?.source === "string" ? { source: entry.source as LiveModelSource } : {}) });
      registerLiveModelIds(PROVIDER_OF[family], models.map((model) => model.id));
    }
  } catch { /* 깨진 캐시는 없는 것으로 */ }
}

function persist(): void {
  const out: Record<string, { models: readonly LiveModel[]; fetchedAt: number; source?: LiveModelSource }> = {};
  for (const family of LIVE_MODEL_FAMILIES) {
    const state = states.get(family);
    if (state?.models.length && state.fetchedAt !== undefined) out[family] = { models: state.models, fetchedAt: state.fetchedAt, ...(state.source ? { source: state.source } : {}) };
  }
  try { storage()?.setItem(LIVE_MODELS_STORAGE_KEY, JSON.stringify(out)); } catch { /* 저장 불가는 무시 */ }
}

export function getLiveModelState(family: LiveModelFamily): LiveModelState {
  hydrate();
  return states.get(family) ?? { status: "idle", models: [] };
}

/** 응답을 검증해 LiveModelResult 로. 모양이 다르면(옛 동반 서비스·예기치 않은 응답) null. */
export function parseLiveModelResponse(family: LiveModelFamily, payload: unknown): LiveModelResult | null {
  if (!payload || typeof payload !== "object") return null;
  const body = payload as Record<string, unknown>;
  if (body.ok === true) {
    const models = validModels(body.models);
    if (!models.length) return null;
    const source = body.source === "codex-backend" || body.source === "anthropic-api" || body.source === "anthropic-compat" ? body.source : "codex-backend";
    const fetchedAt = typeof body.fetchedAt === "number" && Number.isFinite(body.fetchedAt) ? body.fetchedAt : Date.now();
    return { ok: true, family, source, fetchedAt, models };
  }
  if (body.ok === false && typeof body.message === "string") {
    const reason = body.reason === "no-credential" || body.reason === "timeout" ? body.reason : "upstream-error";
    return { ok: false, family, reason, message: body.message, fetchedAt: Date.now() };
  }
  return null;
}

function companionBase(): string {
  return (typeof window !== "undefined" ? (window as { oprn?: { companionOrigin?: string } }).oprn?.companionOrigin : undefined) ?? "";
}

function applyResult(family: LiveModelFamily, result: LiveModelResult | null, fallbackMessage: string): LiveModelState {
  const previous = states.get(family);
  let next: LiveModelState;
  if (result?.ok) {
    next = { status: "ok", models: result.models, source: result.source, fetchedAt: result.fetchedAt };
    registerLiveModelIds(PROVIDER_OF[family], result.models.map((model) => model.id));
  } else {
    // 실패해도 마지막 성공 목록은 지우지 않는다 — 네트워크가 잠깐 끊겼다고 새 모델이 선택지에서 사라지면 안 된다.
    next = {
      status: "failed",
      models: previous?.models ?? [],
      ...(previous?.source ? { source: previous.source } : {}),
      ...(previous?.fetchedAt !== undefined ? { fetchedAt: previous.fetchedAt } : {}),
      message: result && !result.ok ? result.message : fallbackMessage,
    };
  }
  states.set(family, next);
  if (next.status === "ok") { lastFailureAt.delete(family); persist(); } else lastFailureAt.set(family, Date.now());
  return next;
}

/**
 * 한 계열의 실제 목록을 받아 온다. 같은 계열의 동시 호출은 하나로 합친다. 던지지 않는다 — 실패는 상태(failed)로 남는다.
 * force 가 아니면 캐시가 신선(6시간 이내)할 때 요청하지 않는다.
 */
export function refreshLiveModels(family: LiveModelFamily, options: { readonly force?: boolean } = {}): Promise<LiveModelState> {
  hydrate();
  if (!isLiveModelFamily(family)) return Promise.resolve({ status: "idle", models: [] });
  const current = states.get(family);
  if (!options.force && current?.status === "ok" && current.fetchedAt !== undefined && Date.now() - current.fetchedAt < LIVE_MODELS_STALE_MS) {
    return Promise.resolve(current);
  }
  const running = inflight.get(family);
  if (running) return running;
  const failedAt = lastFailureAt.get(family);
  if (!options.force && failedAt !== undefined && Date.now() - failedAt < LIVE_MODELS_RETRY_BACKOFF_MS && current) return Promise.resolve(current);
  states.set(family, { status: "loading", models: current?.models ?? [], ...(current?.source ? { source: current.source } : {}), ...(current?.fetchedAt !== undefined ? { fetchedAt: current.fetchedAt } : {}) });
  emit();
  const controller = typeof AbortController === "undefined" ? undefined : new AbortController();
  const timer = controller ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : undefined;
  const job = (async () => {
    try {
      const url = `${companionBase()}/v1/models?family=${family}${options.force ? "&fresh=1" : ""}`;
      const response = await fetchCompanion(url, { method: "GET", ...(controller ? { signal: controller.signal } : {}) }, { notifyProblems: false });
      if (!response.ok) return applyResult(family, null, `동반 서비스가 모델 목록을 주지 않았어요(HTTP ${response.status}).`);
      return applyResult(family, parseLiveModelResponse(family, await response.json()), "동반 서비스의 응답을 읽지 못했어요.");
    } catch {
      return applyResult(family, null, "동반 서비스에 닿지 못해 모델 목록을 받지 못했어요.");
    } finally {
      if (timer) clearTimeout(timer);
      inflight.delete(family);
      emit();
    }
  })();
  inflight.set(family, job);
  return job;
}

/** 설정 화면이 열릴 때: 연결된 계열의 목록이 없거나 낡았으면 한 번 받는다(신선하면 요청 없음). */
export function ensureLiveModels(family: LiveModelFamily): Promise<LiveModelState> {
  return refreshLiveModels(family, { force: false });
}

export function resetLiveModelCatalogForTests(): void {
  states.clear();
  inflight.clear();
  lastFailureAt.clear();
  hydrated = false;
}
