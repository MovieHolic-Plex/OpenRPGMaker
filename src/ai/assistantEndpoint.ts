import { configForRole } from "./modelRoles";
import { configForUltrabrain } from "./ultrabrainConfig";
// ai/assistantEndpoint.ts
// 에디터 AI 표면이 **조수와 같은 엔드포인트에 닿는 단일 지점**.
//
// 왜 필요한가(실측): 전송(llmClient.chatCompletion)과 시스템 프롬프트(systemPromptEnvelope)는 이미
// 하나로 모여 있었는데, 그 앞단 두 가지가 여전히 표면마다 손으로 조립돼 있었다.
//
//   1. 어떤 설정으로 부르는가 — 조수 채팅은 `loadAiConfig()`, 클러스터·이벤트 커맨드는
//      `configForLiteModel(loadAiConfig())`, 영역 작업은 거기에 maxToolCalls 캡, 타일셋 분석은
//      `{...config, maxTokens: 8192}`, 구조 키트는 생 `loadAiConfig()`. 다섯 군데가 각자 정했다.
//   2. 연결이 준비됐는지 누가 판정하는가 — 채팅·클러스터·이벤트는 `isAiConfigReady`,
//      타일셋 분석은 자기만의 `hasTilesetAiAccess`, 구조 키트는 **아무 판정도 하지 않았다**.
//
// 2번이 실제 결함을 만들었다. `hasTilesetAiAccess` 는 (a) `config.model` 을 보지 않고
// (b) 프로덕션 reader 는 사라진 레거시 `oprn:llmApiKey` localStorage 키를 폴백으로 읽었다. 그래서
// 모델이 빈 설정에서 조수는 "설정 필요" 로 막는데 타일셋 AI 버튼은 열려 있고 `model: ""` 로 요청이
// 나갔으며, 남아 있던 옛 키 하나가 나머지 전체와 어긋난 판정을 만들었다. 저장소 마이그레이션은 호환을
// 위해 이 키를 보존하지만 읽지는 않는다. 이 파일의 형제(같은 표면의
// 옛 주석)가 "중복 검사가 면제를 빼먹은 결함" 이라고 두 번 경고한 그 유형이다.
//
// 이 파일의 불변식: 표면 어휘(AiSurface)와 표면별 설정 정책(SURFACE_POLICIES)과 준비 판정
// (isAssistantEndpointReady)의 선언 지점이 각각 하나뿐이다. 새 AI 표면은 표에 한 줄로 들어오며,
// 엔드포인트·인증·모델 티어를 다시 구현할 자리가 없다.
//
// 여기 들어오지 않는 것: 내부 플래너(workPlan.ORCHESTRATOR)·요약기(contextCompaction)·성향 증류기
// (preferenceDistiller). 셋은 사람이 여는 표면이 아니라 조수 턴 **안에서** 도는 내부 단계이므로
// 표면 정책이 아니라 각자의 단계 정책을 따른다(systemPromptEnvelope 가 봉투를 씌우지 않는 것과 같은 경계).

import { configForLiteModel, isProxyAuth, loadAiConfig, type AiConfig } from "./llmClient";

/**
 * AI 표면 식별자 — 사람이 에디터에서 직접 여는 AI 진입점.
 *
 * activityLogTypes.AiActivityChannel 과 값이 일부 겹치지만 별 타입이다: 그쪽은 project storage
 * ai_activity_logs.channel 컬럼에 그대로 실리는 로깅 어휘라, 표면을 하나 늘리는 사정으로 DB 어휘가
 * 따라 늘어나면 안 된다.
 */
export type AiSurface =
  | "dialogue-review"
  | "chat"
  | "region"
  | "cluster"
  | "event-command"
  | "structure-kit"
  | "world-canon-interview"
  | "project-interview"
  | "world-canon-body"
  | "tileset-analysis"
  | "workshop-draw"
  | "workshop-review";

/** 표면이 쓰는 모델 티어. 조수 설정의 감독 모델(supervisor) 또는 실행 모델(lite). */
type ModelTier = "supervisor" | "lite";

interface SurfacePolicy {
  readonly tier: ModelTier;
  /**
   * 출력 토큰 예산을 이 값으로 못박는다. 표면 산출물의 길이가 사용자 예산과 무관하게 정해질 때만 쓴다.
   * 하한(Math.max)이 아니라 정확 지정이다. 실제 효과는 companion 등 더 큰 예산을 지원하는
   * 공급자도 이 값으로 낮추는 것이다.
   * 새 정책이 아니라 통합 전 타일셋 분석의 정확 지정 동작을 그대로 물려받는다.
   */
  readonly maxTokens?: number;
  /** 라운드 안전핀 상한. 표면이 한 번에 도는 툴콜 수를 제한할 때만 쓴다. */
  readonly maxToolCallsCeiling?: number;
}

/** 영역 작업 한 번의 툴콜 상한. 채팅 조수 기본(2000)과 같게 후하게 잡는다. runRegionTask 가 재노출한다. */
export const REGION_SURFACE_MAX_TOOL_CALLS = 2000;

/**
 * 타일셋 매핑 응답의 상속된 고정 출력 예산. 이 핀의 실효는 더 큰 예산을 지원하는
 * companion/Codex/Antigravity 도 8192로 낮추는 데 있다. 이 통합에서
 * 새로 고른 값이 아니라 통합 전 타일셋 분석의 `max_tokens: 8192` 동작을 보존한 것이다.
 */
export const TILESET_ANALYSIS_MAX_TOKENS = 8192;

/**
 * 표면별 엔드포인트 정책. **이 표가 유일한 선언 지점이다.**
 *
 * - `chat`: 조수 본체. 사용자가 고른 감독 모델·예산을 그대로 쓴다(기준선).
 * - `region`·`cluster`·`event-command`: 실행 모델(lite). 반복·배치성 호출이라 감독 모델의 추론
 *   비용을 태울 자리가 아니다. `region` 만 툴콜 상한을 추가로 건다.
 * - `structure-kit`: 구조물 이름·배치 설명을 짓는 일회성 감독 판단이라 감독 모델.
 * - `tileset-analysis`: 이미지를 읽는 감독 판단이라 감독 모델 + 매핑 JSON 전용 고정 예산.
 * - `workshop-draw`: 공방 그리기. 격자 JSON 이 길어 감독 모델 + 넉넉한 고정 예산(16384).
 * - `workshop-review`: 공방 검수. 그림을 읽는 판단이라 vision 역할 + 고정 예산(4096).
 */
const SURFACE_POLICIES: Readonly<Record<AiSurface, SurfacePolicy>> = {
  "chat": { tier: "supervisor" },
  "dialogue-review": { tier: "supervisor", maxTokens: 8192 },
  "region": { tier: "lite", maxToolCallsCeiling: REGION_SURFACE_MAX_TOOL_CALLS },
  "cluster": { tier: "lite" },
  "event-command": { tier: "lite" },
  "structure-kit": { tier: "supervisor" },
  // 세계관 인터뷰: 사람과 문장을 주고받으며 설정을 함께 채우는 감독 판단이라 supervisor + 고정 예산.
  "world-canon-interview": { tier: "supervisor", maxTokens: 4096 },
  "project-interview": { tier: "supervisor", maxTokens: 2048 },
  // 세계관 본문 초안/이어쓰기: 산출물이 장문 prose 라 인터뷰보다 예산을 크게 준다.
  "world-canon-body": { tier: "supervisor", maxTokens: 8192 },
  "tileset-analysis": { tier: "supervisor", maxTokens: TILESET_ANALYSIS_MAX_TOKENS },
  // 공방: 그리기는 격자 JSON 이 길어(48행 × 여러 번 고치기) 감독 모델 + 넉넉한 고정 예산,
  // 검수는 그림을 읽는 판단이라 tileset-analysis 처럼 vision 역할.
  "workshop-draw": { tier: "supervisor", maxTokens: 16384 },
  "workshop-review": { tier: "supervisor", maxTokens: 4096 },
};

/**
 * 표면이 쓸 AiConfig. 저장된 조수 설정(또는 주입된 base)에 표면 정책만 얹는다 —
 * baseUrl·authMode·providerId 는 손대지 않으므로 **엔드포인트는 조수와 항상 같다.**
 *
 * base 를 넘기는 경로: 테스트, 그리고 이미 자기 설정을 들고 있는 호출부(runEventCommandAssist 는
 * 호출자가 준 config 를 존중해야 한다). 생략하면 저장된 설정을 읽는다.
 */
export function resolveSurfaceAiConfig(surface: AiSurface, base?: AiConfig): AiConfig {
  const policy = SURFACE_POLICIES[surface];
  const source = base ?? loadAiConfig();
  const hasRoles = source.roleModels && Object.keys(source.roleModels).length > 0;
  const tiered = hasRoles
    ? surface === "tileset-analysis" || surface === "workshop-review" ? configForRole(source, "vision")
      : policy.tier === "lite" ? configForRole(source, "deep")
      : { ...configForUltrabrain(source), maxTokens: source.maxTokens }
    : policy.tier === "lite" ? configForLiteModel(source) : source;
  // 두 항목은 서로 독립이고 둘 다 없는 표면이 대부분이므로, 정책이 요구할 때만 사본을 만든다.
  if (policy.maxTokens === undefined && policy.maxToolCallsCeiling === undefined) return tiered;
  return {
    ...tiered,
    maxTokens: policy.maxTokens ?? tiered.maxTokens,
    // 툴콜은 상한이다 — 사용자가 더 적게 골랐으면 그 값을 존중한다.
    maxToolCalls: policy.maxToolCallsCeiling === undefined
      ? tiered.maxToolCalls
      : Math.min(tiered.maxToolCalls, policy.maxToolCallsCeiling),
  };
}

/**
 * 조수 엔드포인트에 요청을 보낼 수 있는 설정인가. **모든 AI 표면이 이 판정 하나를 쓴다.**
 *
 * 판정 근거:
 * - `model` 없이 보내면 공급자가 무엇을 답할지 정해지지 않는다 → 어느 표면이든 준비 안 됨.
 * - `chatgpt`(동반 서비스) 전송은 자격 증명을 동반 서비스가 보관한다 → 브라우저에 키가 없는 것이 정상.
 * - 상대 baseUrl(동일 오리진 vite 프록시)은 서버가 Authorization 을 주입한다(isProxyAuth) →
 *   클라이언트 apiKey 를 요구하지 않는다. 이 면제를 빼먹은 중복 검사가 과거에 채팅 전송과
 *   클러스터 AI 시작을 각각 막았다.
 *
 * **표면을 인자로 받지 않는다.** 표면별 판정을 두면 표면끼리 답이 갈리는데, 그것이 이 통합이
 * 없애려는 증상 자체다. 실제로 표면별로 재던 판정은 배치 표면(lite 티어)에서 항상 통과했다 —
 * `configForLiteModel` 이 모델이 하나도 없을 때 `DEFAULT_LITE_MODEL` 을 채워 넣기 때문에, 설정이
 * 통째로 빈 상태에서도 조수만 거부하고 영역·클러스터·이벤트는 기본 모델로 요청을 보냈다.
 * 준비 여부는 **사용자가 설정한 것**으로 판정하고, 모델 티어 해석은 요청을 만들 때만 한다.
 */
export type AssistantConnectionReadiness = {
  readonly kind: "ready" | "disconnected" | "checking" | "offline" | "error";
};

/**
 * 조수 엔드포인트에 요청을 보낼 수 있는가.
 *
 * `config` 기본값은 의도적으로 없다. 브라우저의 `loadAiConfig()`는 OAuth와 기본 모델을 항상
 * 백필하므로 config 모양만 보면 언제나 true이고, 연결 판정으로 쓰면 죽은 게이트가 된다. 브라우저
 * 호출부는 `getAiConnectionStatus(config)`를 두 번째 인자로 넘겨 실제 companion 캐시를 함께 본다.
 * 캐시가 차가운 `checking`은 허용한다. 아직 조회하지 않았다는 이유로 버튼을 영구 잠그지 않되,
 * 조회로 확인된 `disconnected`·`offline`·`error`는 반복될 요청을 막는다.
 *
 * 주입 설정(노드 스크립트·벤치마크·테스트)은 live status가 없으므로 두 번째 인자를 생략하고
 * model/auth/baseUrl/apiKey 모양만 검증할 수 있다. 즉 이 함수는 주입 설정에도 계속 유효하지만,
 * 브라우저 저장 설정에 status 없이 쓰면 연결 확인이 아니라 항상 true인 shape check일 뿐이다.
 */
export function isAssistantEndpointReady(
  config: AiConfig,
  connectionStatus?: AssistantConnectionReadiness,
): boolean {
  if (!config.model.trim()) return false;
  const configReady = config.authMode === "chatgpt"
    ? true
    : isProxyAuth(config)
      ? Boolean(config.baseUrl.trim())
      : Boolean(config.baseUrl.trim() && config.apiKey.trim());
  if (!configReady) return false;
  return connectionStatus === undefined
    || connectionStatus.kind === "ready"
    || connectionStatus.kind === "checking";
}
