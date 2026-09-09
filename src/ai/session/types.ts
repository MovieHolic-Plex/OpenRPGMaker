// ai/session/types.ts
// 어시스턴트 세션의 공개 타입. 세션이 바깥(패널·브리지·영역 작업·테스트)과 주고받는
// 사건·결과·감사 항목·생성 옵션만 담는다. 값이나 동작은 두지 않는다.

import type { RunCheckpointKey } from "../runCheckpointStore";
import type { AcceptanceSnapshot } from "../assistantAcceptance";
import type { ResultReview } from "../independentReview";
import type { RunOutcome } from "../runOutcome";
import type { ToolVerificationEvidence } from "../toolVerificationEvidence";
import type { AppearanceGenerationHandoff } from "@/editor/characterAppearanceGeneration";
import type { ToolDomain, ToolResult } from "@/editor/tools";
import type { IntentDeclarer } from "@/ai/intentDeclarationClient";
import type { ComposerMode } from "@/ai/composerMode";
import type { ProjectPersistenceReceipt, ProjectPersistenceProof } from "@/project/store";
import type { WikiPreparationOutcome, WikiTurnInput } from "@/editor/projectWikiCoordinator";
import type { Project } from "@/project/types";
import type { ContextOptions } from "../contextBuilder";
import type { TurnSelectionSnapshot, ConversationTurnContext } from "../conversationTurnContext";
import type { AiConfig, ChatMessage, ChatRequest, ChatResult } from "../llmClient";
import type { LayerVerdictInput } from "../agentVerification";
import type { YieldToUi } from "../yieldToUi";
import type { FreezeGuard } from "../pageFreezeGuard";
import type { WorkPlan } from "../workPlan";
import type { RunRecap } from "../runRecap";

/** Persistence evidence only; execution and goal outcomes remain separate. */
export interface RunEndProofState {
  readonly status: "attempted" | "failed" | "succeeded";
  readonly verified: boolean;
  readonly receipt?: ProjectPersistenceReceipt;
  readonly commitId?: string | null;
  readonly proof?: ProjectPersistenceProof;
  readonly reason?: string;
}

// UI 스트리밍/로그용 이벤트.
export type SessionEvent =
  | { type: "assistant_token"; delta: string }
  | { type: "reasoning_token"; delta: string }
  | { type: "assistant_message"; content: string }
  | { type: "assistant_stream_reset" }
  | { type: "tool_call"; name: string; args: Record<string, unknown>; result: ToolResult; reason?: string }
  // 툴 실행 직전에 나가는 신호 이벤트 — 결과 도착 전에 "지금 무엇을 하는 중"을 그릴 수 있게 한다.
  // index는 이번 턴의 1-based 실행 서수.
  | { type: "tool_started"; name: string; index: number; args?: Record<string, unknown> }
  | { type: "phase"; value: "plan" | "execute" | "review" }
  | { type: "status"; text: string }
  | { type: "work_plan"; plan: WorkPlan }
  | { type: "acceptance"; snapshot: AcceptanceSnapshot | null }
  | { type: "completion_assessment"; assessment: CompletionAssessment }
  | { type: "result_review"; review: ResultReview }
  // ── 마일스톤 자동 적용(todo 4) ─────────────────────────────────────
  // 자율 런에서 작업 항목 완료가 안전 검사를 통과해 스토어에 자동 적용됐다.
  | { type: "milestone_applied"; title: string; toolCount: number; commitId: string | null }
  // 자동 적용이 차단됐다(파괴적/어휘/규칙 verdict 또는 완성도 경고) — 카드가 렌더되어
  // 사용자 승인을 기다린다(런 일시정지).
  | { type: "proposal_paused"; reason: string; warnings?: readonly string[] }
  /** 사용자 목표(자율 런이면 드라이버 전체)가 끝났을 때 토큰·경과·과정 계량. */
  | { type: "run_recap"; recap: RunRecap }
  | { type: "run_outcome"; runOutcome: RunOutcome }
  | { type: "persistence_proof"; state: RunEndProofState };

// 제안(changeset)에 담기는 개별 쓰기 툴콜.
export interface ProposedCall {
  name: string;
  args: Record<string, unknown>;
  summary: string;
  result: ToolResult;
  destructive: boolean; // remove_event 등 파괴적 작업.
  requiresApproval?: boolean;
  approvalWarning?: string;
  /** 이 쓰기를 한 한 줄 이유. 적용 감사·편집 로그로 복사된다. */
  reason?: string;
}

export interface CompletionAssessment {
  readonly acceptance: AcceptanceSnapshot | null;
  readonly adventure: readonly string[];
  readonly verification: readonly string[];
  readonly blockingVerification: readonly string[];
  readonly checks: readonly LayerVerdictInput[];
}

export interface TurnResult {
  /** Session-owned settlement updates this value after ordinary apply/proof. Legacy callers may omit it. */
  runOutcome?: RunOutcome;
  assistantText: string;
  proposedCalls: ProposedCall[]; // 성공한 쓰기 툴콜(수락 시 store에 적용할 시퀀스).
  stoppedReason: "final" | "max-tool-calls" | "token-budget" | "error" | "aborted";
  error?: string;
  /** Independent approval of this exact draft, never a persistence receipt. */
  review?: ResultReview;
  /** 어려운 요청의 다층 To-do 진행 상태(있으면 UI/브리지에 노출). */
  workPlan?: WorkPlan;
  /** 이 사용자 목표가 태운 토큰·경과·과정. 채팅에는 토큰 줄만, 로그에는 전부. */
  recap?: RunRecap;
  readonly completionAssessment?: CompletionAssessment;
  /**
   * 이 턴에 **마일스톤으로 이미 저장소에 적용된** 쓰기 툴콜. `proposedCalls` 와 서로 배타적이다:
   * 마일스톤 적용은 `turnProposals` 를 비우므로(maybeAutoApplyMilestone) 적용된 몫은
   * `proposedCalls` 에서 사라진다.
   *
   * 왜 노출하는가: 턴 끝 정산(완성도 린트·"변경 없음" 배너·상태줄)이 `proposedCalls` 만 보면
   * 마일스톤으로 다 지은 턴을 **0-변경 턴으로 오판**한다. 소비자는 판정에는 두 배열의 합집합을,
   * 재적용에는 `proposedCalls` 만 써야 한다.
   */
  appliedCalls?: ProposedCall[];
  /** Successful DB candidate request in this turn, not an applied project write. */
  appearanceGeneration?: AppearanceGenerationHandoff;
}

// 감사 로그 항목(Phase 1 헤드리스 러너로 리플레이 가능한 시퀀스).
// at: ISO 타임스탬프(결함 ⑬ — 상태 전이/툴 호출/오류 타임라인을 export 가능하게).
// kind:"status"는 턴 수명주기(시작/종료 사유/오류/재시도) 전이 기록이다.
export type AuditEntry =
  | { kind: "user"; text: string; at?: string; context?: ConversationTurnContext }
  | { kind: "assistant"; text: string; toolCalls?: { name: string; args: string }[]; at?: string }
  | { kind: "tool"; name: string; args: Record<string, unknown>; ok: boolean; summary: string; reason?: string; issues?: string[]; issueCodes?: string[]; deferred?: boolean; construction?: import("@/editor/construction/constructionAudit").ConstructionAuditRecord; at?: string }
  | { kind: "status"; text: string; at?: string };

// 하네스 스냅샷 — 오케스트레이션 주입을 포함한 세션 원본 메시지와 감사 로그를 한 번에 관측한다.
// 🔬 하네스 뷰어와 window.__oprnAiHarness(헤드리스 디버깅)가 소비한다.
export interface HarnessSnapshot {
  readonly runIdentity?: RunCheckpointKey | null;
  readonly model: string;
  readonly liteModel?: string;
  readonly maxTokens: number;
  readonly messages: readonly ChatMessage[];
  readonly audit: readonly AuditEntry[];
  readonly workPlan?: WorkPlan | null;
  readonly acceptance?: AcceptanceSnapshot | null;
  readonly verification?: ReturnType<ToolVerificationEvidence["snapshot"]>;
  readonly runEndProof?: RunEndProofState | null;
  readonly resultReview?: ResultReview | null;
  readonly runOutcome?: RunOutcome | null;
}

export type ChatFn = (config: AiConfig, req: ChatRequest) => Promise<ChatResult>;

export type AssistantPhase = "plan" | "execute" | "review";

// ── 비전(BUG C) ───────────────────────────────────────────────────
// 툴 결과는 지금까지 텍스트 JSON으로만 모델에 전달됐다 — 비전 모델이 타일을 '보지' 못해
// 의미를 지어냈다(예: 타일 80을 '탁자'로 오인). 렌더러가 있으면 '보여줘' 계열 툴의 이미지를
// 후속 user 메시지로 주입해 모델이 실제로 보게 한다. 렌더러는 브라우저 전용(패널이 주입).
export interface RenderedToolImage {
  dataUrl: string;
  label: string;
}
export type ToolImageRenderer = (
  project: Project,
  toolName: string,
  data: unknown
) => Promise<RenderedToolImage[]>;

/** 이번 턴이 손댈 범위 — 현재 맵의 선택 사각형. 사실이지 의도가 아니다. */
export interface SessionTurnScope {
  readonly mapId: string;
  readonly region: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

export interface SessionTurnOptions {
  /** Explicit host user action, never inferred from model source/reset claims. */
  readonly goalAction?: "resume" | "new-goal";
  readonly autonomous?: boolean;
  /** 사용자 발화 원문. text 에 footer 가 붙어 올 때 의도 선언·툴 언급 스캔은 이것만 본다. */
  readonly instruction?: string;
  readonly scope?: SessionTurnScope | null;
  /** 컴포저 모드(지시/질문/계획). 없으면 지시. 세션이 강제한다 — 프롬프트 힌트가 아니다(`@/ai/composerMode`). */
  readonly composerMode?: ComposerMode;
  /**
   * 하네스 내부 플래그 — 자율 드라이버가 스스로 보낸 합성 「계속」 턴인가. 패널·브리지는 넘기지 않는다.
   *
   * 사용자의 새 메시지(직접 친 「계속」 포함)와 구분해야 하는 것이 둘 있다:
   *  1. 막힌 항목 되살리기 — 사람이 다시 말을 걸었을 때만 재시도한다(2026-09-03).
   *  2. 플래너 왕복 — 계획이 그대로인 드라이버 계속 턴은 resume 이 자명하므로 main 모델 콜을 건너뛴다.
   */
  readonly driverContinue?: boolean;
}

export interface AssistantSessionOptions {
  readonly checkpoint?: Pick<RunCheckpointKey, "conversationId" | "projectId" | "projectContextKey">;
  config?: AiConfig;
  /** Optional supervisor configuration for a surface whose writer uses the lite tier. */
  reviewConfig?: AiConfig;
  contextOptions?: ContextOptions;
  // 테스트/대체용 chat 구현. 기본은 설정 baseUrl의 OpenAI 호환 chatCompletion.
  chat?: ChatFn;
  /**
   * 턴 시작에 사용자 발화를 구조화 의도로 선언하는 함수(한 번, JSON). 패널·영역 작업은 실제 모델
   * 선언자(createLlmIntentDeclarer)를 넣는다. 없으면 중립 폴백 선언으로 진행한다 — 되묻기·계획·툴
   * 도메인을 문장 키워드로 추측하는 경로는 없다(2026-09-03 의도 라우터 감사).
   */
  declareIntent?: IntentDeclarer;
  /** Editor-owned checkpoint or explicit deferral. The detached session never persists wiki writes itself. */
  prepareProjectWiki?: (input: WikiTurnInput) => Promise<WikiPreparationOutcome>;
  /**
   * 자율 실행 드라이버용 사용자-대기 조회 훅(peek-only). 패널의 pendingSends 큐에
   * 메시지가 있는지 "만" 보고한다 — 드라이버는 절대 dequeue 하지 않는다(패널의 기존
   * 드레인 루프가 전달한다). 비문자·빈 문자열은 null 로 취급한다(시스템 경계 검증).
   */
  peekPendingUserMessage?: () => string | null;
  // 비전 이미지 렌더러(브라우저 전용). 없으면 텍스트 전용(Node/테스트에서 동일 동작).
  renderImages?: ToolImageRenderer;
  // Legacy scoped-consumer option. The session exposes the complete active catalog.
  toolMode?: () => ToolDomain | undefined;
  /**
   * 턴 시점 선택 영역 조회(에디터 UI 상태). 사용자 감사 항목의 상황 스냅샷에만 쓰이며
   * 시스템 프롬프트에는 들어가지 않는다 — 그래서 ContextOptions 가 아니라 여기 있다.
   */
  getTurnSelection?: () => TurnSelectionSnapshot | null | undefined;
  /**
   * 복원/되감기로 들어온 세션에 주입할 이전 대화 기록(conversationReplay.serializeAuditTranscript).
   * 시스템 프롬프트 바로 뒤 role "user" 한 덩어리로 들어간다 — 화면만 복원하고 모델은 아무것도
   * 기억하지 못하던 상태를 메꾸는 유일한 입력이다.
   */
  priorTranscript?: string;
  /**
   * 동기 도구 실행 직전에 이벤트 루프를 양보한다. 기본은 브라우저에서 rAF 1틱,
   * Node/테스트는 즉시. 주입하면 테스트가 양보 횟수를 셀 수 있다.
   */
  yieldToUi?: YieldToUi;
  /**
   * 턴 수명 동안 탭 freeze 를 막는 keep-alive. 기본은 Web Lock 을 쥔다.
   * Node/테스트는 no-op. 주입하면 테스트가 획득·해제 시점을 셀 수 있다.
   */
  freezeGuard?: FreezeGuard;
}

/** 수동 압축(compactNow) 결과. 건너뜀은 사유를 사람 문장으로 돌려준다(UI 가 그대로 보여준다). */
export type CompactionOutcome =
  | { readonly kind: "done"; readonly beforeTokens: number; readonly afterTokens: number; readonly summary: string }
  | { readonly kind: "skipped"; readonly reason: string };
