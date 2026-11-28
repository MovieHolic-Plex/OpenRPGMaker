import { ASSISTANT_CHATGPT_MODEL } from "./chatgptDefault";
import { getOhMyPiProvider, parseOhMyPiProvider } from "@/ai/ohMyPiProviders";
import { getKnownOpenAiCompatEndpoint, isOpenAiCompatProviderId, openAiCompatModelBlockReason } from "@/ai/openAiCompat";
import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "@/ai/oauth/credentials";

export interface AiModelCatalogGroup {
  readonly label: string;
  readonly models: readonly string[];
}

/** ChatGPT(Codex) 구독으로 고를 수 있는 모델 — 2026-11-19 부터 GPT-6.2 Sol 을 권장한다.
 * 예전엔 pi-catalog 번들 8종(gpt-5.4-mini·codex-spark·daybreak …)을 다 떠서 보여 줘 고를 이유가 없는
 * 선택지가 목록을 덮었다. 순서가 공장 기본 우선순위다(첫 항목 = 기본, ohMyPiProviders 와 일치).
 * gpt-6-* 는 설치 번들(17.4.0) 밖이라 동반 서비스가 scripts/lib/ohMyPiModel.ts 의 로컬 확장으로 풀어 준다.
 * 2026-11-04: 최신 우선으로 줄 세웠다. 끝의 둘(gpt-6-sol·gpt-5.6-sol)은 옛 모델이라 LEGACY_MODEL_IDS 에 있다. */
const CODEX_MODELS: readonly string[] = [
  ASSISTANT_CHATGPT_MODEL,
  "gpt-6.2-astra",
  "gpt-6.1-sol",
  "gpt-6-astra",
  "gpt-6-luna",
  "gpt-6-sol",
  "gpt-5.6-sol",
];

/**
 * Antigravity 경로에서 고를 수 있는 모델.
 *
 * `getBundledModels("google-antigravity")` 실측(2026-08-27) 결과를 그대로 쓴다. pi-catalog 가
 * 제공자 전송 계층이 실제로 해석하는 모델 목록이므로, gemini 밖 네임스페이스(Claude·gpt-oss·
 * tab_*)도 여기서는 **Antigravity 소속 모델**이다. 첫 항목만 제품 기본값(gemini-4-argon)에
 * 맞춰 앞으로 옮겼다(2026-10-14: gemini-3.8-flash → gemini-4-argon).
 *
 * `gemini-3.7-flash-high` 는 없다 — 실측(2026-08-26) 결과 Cloud Code Assist 가 그 ID 를 404
 * `Requested entity was not found` 로 거부한다. Antigravity 에서 `-high`/`-medium`/`-low` 는
 * 독립 모델이 아니라 `gemini-3.7-flash` 의 `thinking.effortRouting` 대상 이름이다.
 *
 * Gemini 4 Argon / Gemini 3.8 Flash are provided by the local OMP catalog extension.
 * OAuth wire gemini-4-argon-{low,medium,high} verified 2026-10-14.
 */
const ANTIGRAVITY_MODELS: readonly string[] = [
  "gemini-4-argon",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "claude-opus-4-5",
  "claude-opus-4-6",
  "claude-sonnet-4-5",
  "claude-sonnet-4-6",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-3-flash",
  "gemini-3-pro",
  "gemini-3.1-flash-image",
  "gemini-3.1-flash-lite",
  "gemini-3.1-pro",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash-tiered",
  "gpt-oss-120b",
  "tab_flash_lite_preview",
  "tab_jump_flash_lite_preview",
];

/**
 * Claude 계정(제공자 anthropic)의 5.5 세 모델. 첫 항목 = ohMyPiProviders 의 defaultModel.
 * pi-catalog(18.9.1·18.13.2) anthropic 제공자에 세 id 가 다 있고, 2026-11-04 Anthropic messages 호출이 세 모델 모두 통과했다.
 */
const ANTHROPIC_MODELS: readonly string[] = [
  "claude-sonnet-5-5",
  "claude-opus-5-5",
  "claude-haiku-5-5",
];

const AGY_ACP_MODELS: readonly string[] = [
  "gemini-4-argon",
  "gemini-4-neon",
  "gemini-4-carbon",
  "gemini-4-hydrogen",
  "gemini-3.8-flash",
  "claude-sonnet-5-5",
  "claude-opus-5-5",
];

/**
 * 제공자별 모델 목록. 카탈로그 행이 없는 제공자는 레지스트리 defaultModel 하나로 떨어진다(modelCatalogForAuthMode).
 * 옛 게이트웨이 그룹은 걷어냈다 — 그 모델들에 닿을 제공자가 레지스트리에 없다.
 */
const PROVIDER_MODELS: Readonly<Record<string, readonly string[]>> = {
  [ANTIGRAVITY_PROVIDER_ID]: ANTIGRAVITY_MODELS,
  [CODEX_PROVIDER_ID]: CODEX_MODELS,
  anthropic: ANTHROPIC_MODELS,
  "local-cli:codex": CODEX_MODELS,
  "local-cli:claude": ANTHROPIC_MODELS,
  "local-cli:agy": AGY_ACP_MODELS,
};

/** 각 제공자에서 최신으로 치는 모델(2026-11-04 기준). 그 밖의 카탈로그 항목은 옛 모델이다. */
const LATEST_MODEL_IDS: Readonly<Record<string, readonly string[]>> = {
  [ANTIGRAVITY_PROVIDER_ID]: ["gemini-4-argon", "gemini-3.8-flash"],
  [CODEX_PROVIDER_ID]: [ASSISTANT_CHATGPT_MODEL, "gpt-6.2-astra", "gpt-6-astra", "gpt-6-luna"],
  anthropic: ANTHROPIC_MODELS,
  "local-cli:codex": [ASSISTANT_CHATGPT_MODEL, "gpt-6.2-astra", "gpt-6-astra", "gpt-6-luna"],
  "local-cli:claude": ANTHROPIC_MODELS,
  "local-cli:agy": ["gemini-4-argon", "gemini-4-neon", "gemini-4-carbon", "gemini-4-hydrogen", "gemini-3.8-flash", "claude-sonnet-5-5", "claude-opus-5-5"],
};

/**
 * 제공자별 옛 모델 id. 설정 화면은 여전히 이 모델들을 보여 주고 고를 수 있다(저장된 선택을 지킨다) —
 * 첫 실행·기본 선택 목록만 latestModelsFor 로 이들을 뺀다. 같은 id 가 제공자마다 다를 수 있어 제공자별로 둔다.
 */
export const LEGACY_MODEL_IDS: Readonly<Record<string, ReadonlySet<string>>> = Object.fromEntries(
  Object.entries(PROVIDER_MODELS).map(([id, models]) => {
    const latest = new Set(LATEST_MODEL_IDS[id] ?? []);
    return [id, new Set(models.filter((model) => !latest.has(model)))];
  }),
);

/**
 * 제공자가 «지금 실제로 내주는» 목록에서 새로 알게 된 모델 id(src/ai/liveModelCatalog.ts 가 GPT·Claude 에 한해 채운다).
 * 코드에 박힌 PROVIDER_MODELS 는 «권장 프리셋» 일 뿐이고, 새 모델이 나와도 목록에서 고를 수 있게 하는 자리가 여기다.
 * 프리셋·LEGACY_MODEL_IDS·기본 모델 계산에는 섞이지 않는다 — 기본값과 첫 실행 선택은 그대로 사람이 정한 프리셋이다.
 */
const LIVE_MODEL_IDS = new Map<string, readonly string[]>();

export function registerLiveModelIds(providerId: string, ids: readonly string[]): void {
  const clean = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (clean.length) LIVE_MODEL_IDS.set(providerId, clean);
  else LIVE_MODEL_IDS.delete(providerId);
}

export function resetLiveModelIdsForTests(): void {
  LIVE_MODEL_IDS.clear();
}

/** 프리셋에 없고 서버 목록에만 있는 모델(대소문자 무시, 서버 순서). */
function liveOnlyModels(providerId: string): readonly string[] {
  const known = new Set((PROVIDER_MODELS[providerId] ?? []).map((id) => id.toLowerCase()));
  return (LIVE_MODEL_IDS.get(providerId) ?? []).filter((id) => !known.has(id.toLowerCase()));
}

/**
 * 그 제공자에서 고를 수 있는 모델 그룹.
 *
 * authMode(전송 축)는 목록을 가르지 않는다 — 주입 게이트웨이 설정(노드 스크립트·벤치마크)도
 * 결국 이 두 제공자의 모델을 쓴다. 인자는 호출부 호환을 위해 유지한다.
 */
export function modelCatalogForAuthMode(
  authMode: "chatgpt" | "apiKey",
  providerId?: string,
): readonly AiModelCatalogGroup[] {
  void authMode;
  const id = parseOhMyPiProvider(providerId);
  const provider = getOhMyPiProvider(id);
  if (isOpenAiCompatProviderId(id)) {
    // 사용자 지정 엔드포인트: 마지막 「연결 시험」 이 받은 목록이 곧 카탈로그다. 목록을 못 받는 서버는 비어 있고,
    // 그때는 모델 ID 를 직접 입력한다(검증은 비어 있지 않은 문자열이면 통과).
    const known = getKnownOpenAiCompatEndpoint(id);
    const listed = [...new Set([known?.defaultModel ?? "", ...(known?.models ?? [])].filter(Boolean))];
    return [{ label: `${provider?.label ?? id} · 연결 시험에서 받은 목록`, models: listed }];
  }
  const models = PROVIDER_MODELS[id] ?? (provider ? [provider.defaultModel] : []);
  const groups: AiModelCatalogGroup[] = [{ label: `${provider?.label ?? id} · oh-my-pi`, models }];
  // 첫 그룹은 항상 프리셋이다(defaultModelForAuthMode·latestModelsFor 의 기준). 서버 목록의 새 모델은 뒤 그룹으로 덧붙인다.
  const extra = liveOnlyModels(id);
  if (extra.length) groups.push({ label: `${provider?.label ?? id} · 서버에서 받은 새 모델`, models: extra });
  return groups;
}

/**
 * 해당 제공자의 권장 기본 모델. 카탈로그 첫 그룹의 첫 항목을 기준으로 한다.
 * 공장 기본은 Claude 의 Sonnet 5.5 — 새 설정의 모든 모델 슬롯이 이 값 · high 로 시작한다(오너 결정 2026-11-23, 그 전 ChatGPT 2026-11-19).
 * Antigravity 의 첫 항목 gemini-4-argon 은 Google 계정의 기본이자 옛 저장값의 기본이다(감독 지시 2026-08-26, 기본 모델 이동 2026-10-14).
 * 계약은 test/aiDefaultModelForced.test.ts 가 고정한다.
 * Codex 카탈로그 첫 항목은 gpt-6.2-sol(2026-11-19).
 * 카탈로그가 비어 있을 리 없지만(방어), 비어 있으면 빈 문자열을 돌려 호출자가 자기 폴백을 쓰게 한다.
 */
export function defaultModelForAuthMode(authMode: "chatgpt" | "apiKey", providerId?: string): string {
  const groups = modelCatalogForAuthMode(authMode, providerId);
  return groups[0]?.models[0] ?? "";
}

/**
 * 첫 실행·기본 선택 목록용: 그 제공자 카탈로그에서 옛 모델(LEGACY_MODEL_IDS)을 뺼 목록. 순서는 카탈로그 순서라
 * 첫 항목이 defaultModelForAuthMode 와 같다. 설정 화면은 modelCatalogForAuthMode(전부)를 쓴다.
 */
export function latestModelsFor(providerId?: string): readonly string[] {
  const id = parseOhMyPiProvider(providerId);
  const legacy = LEGACY_MODEL_IDS[id];
  // 첫 그룹(프리셋)만 쓴다 — 서버 목록에서 새로 알게 된 모델이 «첫 실행 기본 선택 목록» 에 말없이 끼어들지 않게 한다.
  const models = modelCatalogForAuthMode("chatgpt", id)[0]?.models ?? [];
  return legacy ? models.filter((model) => !legacy.has(model)) : models;
}

/**
 * 모델 ID 가 해당 제공자에서 실제로 쓸 수 있는지 판정한다.
 *
 * apiKey 전송(주입 게이트웨이)은 어떤 ID 든 허용한다 — 그 경로는 UI 가 없고, 설정을 직접 넣는
 * 소비자가 자기 게이트웨이의 모델 이름을 안다.
 *
 * Companion settings validate provider membership for early feedback.
 * The runtime rejects unsupported IDs explicitly; loading settings never substitutes a model.
 *
 * 예외 하나: Antigravity 는 gemini 네임스페이스를 번들링 밖이라도 통과시킨다 — 카탈로그는 굳어
 * 있는 스냅샷이고, 아직 번들링에 없는 새 gemini 변형을 사용자가 직접 입력하는 것은 정상 사용이다.
 * 단 사고 강도 변형(`-high`/`-medium`/`-low`)은 그 예외에서 다시 제외한다 — 독립 모델이
 * 아니라 `thinking.effortRouting` 대상 이름이고 실제로 404 다(실측 2026-08-26).
 */
export function isModelValidForAuthMode(
  authMode: "chatgpt" | "apiKey",
  model: string,
  providerId?: string,
): boolean {
  if (authMode !== "chatgpt") return true;
  const provider = parseOhMyPiProvider(providerId);
  // 사용자 지정 엔드포인트는 서버가 정한 어떤 모델 ID 든 쓸 수 있다 — 비어 있지만 않으면 된다.
  if (isOpenAiCompatProviderId(provider)) return model.trim().length > 0 && openAiCompatModelBlockReason(provider, model) === null;
  const wanted = model.trim().toLowerCase();
  const allowed = PROVIDER_MODELS[provider] ?? [];
  if (allowed.some((id) => id.toLowerCase() === wanted)) return true;
  if (liveOnlyModels(provider).some((id) => id.toLowerCase() === wanted)) return true;
  if (provider !== ANTIGRAVITY_PROVIDER_ID) return false;
  if (/-(?:high|medium|low)$/u.test(wanted)) return false;
  return wanted.startsWith("gemini");
}
