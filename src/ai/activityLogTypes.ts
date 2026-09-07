import type { AuditEntry } from "@/ai/assistantSession";
import type { RunOutcome } from "./runOutcome";
import type { AiUiEvent } from "@/ai/uiEventTypes";
import type { ConstructionAuditRecord } from "@/editor/construction/constructionAudit";

/**
 * `ui` = 턴 밖에서 일어난 프론트 액션 묶음(src/ai/uiEventLog.ts). 턴 «안» 의 액션은 그 턴 행의
 * `uiEvents` 에도 함께 실린다 — 턴 행은 읽는 서사이고 ui 행은 빠짐없는 스트림이라, 둘 다 필요하다.
 * DB 쪽 `channel` 컬럼에는 CHECK 제약이 없으므로 값 추가에 마이그레이션이 필요하지 않다.
 */
export type AiActivityChannel = "chat" | "region" | "tileset-analysis" | "ui" | "other";

export type AiActivityToolCall = {
  readonly name: string;
  readonly args: Record<string, unknown>;
  readonly ok?: boolean;
  readonly summary?: string;
  /** 이 호출을 한 한 줄 이유. 예전 행에는 없을 수 있다. */
  readonly reason?: string;
  readonly softConfirm?: unknown;
  readonly construction?: ConstructionAuditRecord;
};

export type AiActivityResult = {
  readonly runOutcome?: RunOutcome;
  readonly execution?: import("./assistantSession").RequestExecution;
  readonly acceptance?: import("./assistantAcceptance").AcceptanceSnapshot | null;
  readonly requests?: readonly import("./assistantRequestContract").RequestSource[];
  readonly ok: boolean;
  readonly applied?: boolean;
  readonly error?: string;
  readonly stoppedReason?: string;
  readonly changedCells?: number;
  readonly changedEvents?: number;
  readonly clippedCells?: number;
  readonly proposedCalls?: number;
  /** 마일스톤 및 턴 종료 적용에 성공한 쓰기 호출 수. 미적용 제안과 별도로 센다. */
  readonly appliedCalls?: number;
  readonly assistantText?: string;
  /**
   * 턴이 아직 안 끝났다. 시작 시점에 먼저 쓰는 행의 표시 — 새로고침·크래시·강제 종료로
   * 종료 기록이 못 남아도 «무슨 지시였고 언제 시작했는지» 는 남는다.
   */
  readonly pending?: boolean;
  /**
   * 소유권이 끊긴 뒤에 정착한 턴(프로젝트 전환 중 늦게 도착한 결과). 이전에는 이 경로가
   * 활동 로그를 통째로 건너뛰어서 존재 자체가 안 남았다(aiChatPanel 의 ownsTurn 조기 반환).
   */
  readonly orphaned?: boolean;
  /** 이 턴이 만든 프로젝트 커밋. 예전에는 audit 텍스트의 `commit=` 를 정규식으로 긁어야 했다. */
  readonly commitIds?: readonly string[];
  /** 이 목표가 태운 토큰·경과·과정. 있으면 로그 요약에 그대로 싣는다. */
  readonly recap?: {
    readonly runOutcome?: RunOutcome;
    readonly execution?: import("./assistantSession").RequestExecution;
    readonly elapsedMs: number;
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly llmCalls: number;
    readonly toolCalls: number;
    readonly ralphContinues: number;
    readonly volumeContinues: number;
    readonly process: readonly string[];
  };
};

export type AiActivityDiagnosticKind =
  | "turn-error"
  | "tool-failure"
  | "planner-fallback"
  | "intent-clarification"
  | "work-plan";

export type AiActivityDiagnostics = {
  readonly severity: "ok" | "warning" | "error";
  readonly kinds: readonly AiActivityDiagnosticKind[];
  readonly messages: readonly string[];
  readonly failedTools: readonly string[];
};

export type AiActivityLogRecord = {
  readonly id: string;
  /** 탭 1개 = 런 1개. DB 에서 "내 런의 최신 턴"을 고르는 키(src/ai/activityRunId.ts). */
  readonly runId?: string;
  readonly at: string;
  readonly channel: AiActivityChannel;
  readonly projectContextKey?: string;
  readonly model?: string;
  readonly liteModel?: string;
  readonly instruction: string;
  readonly mapId?: string;
  readonly mapName?: string;
  readonly region?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly result: AiActivityResult;
  readonly toolCalls: readonly AiActivityToolCall[];
  readonly audit: readonly AuditEntry[];
  /** 영역 작업의 세션 이벤트 스트림. 프론트 액션과는 다른 것이라 필드를 섞지 않는다. */
  readonly uiEvents?: readonly unknown[];
  /** 사람이 AI 표면에서 누른 것(src/ai/uiEventLog.ts). 턴 구간만 잘라 싣는다. */
  readonly uiActions?: readonly AiUiEvent[];
  readonly diagnostics: AiActivityDiagnostics;
  /**
   * 평탄 색인 — payload 안을 뒤지지 않고 SQL 로 찾기 위한 배열들. jsonb containment
   * (`payload_json->toolNames=cs.["set_event"]`) 가 이 키들을 직접 짚는다. 이게 없어서
   * "이벤트 툴을 부른 턴" 을 알아내려고 169KB payload 를 받아 grep 해야 했다(2026-08-30).
   */
  readonly index: AiActivityIndex;
  /** 예산에 걸려 버린 양. 조용히 자르면 나중에 "원래 그만큼이었다" 로 읽힌다. */
  readonly truncated?: { readonly audit?: number; readonly toolCalls?: number; readonly uiActions?: number };
  readonly persisted?: "local" | "supabase" | "both" | "failed-remote";
};

export type AiActivityIndex = {
  readonly toolNames: readonly string[];
  readonly failedToolNames: readonly string[];
  readonly uiActions: readonly string[];
  readonly commitIds: readonly string[];
  readonly mapIds: readonly string[];
  readonly userTexts: readonly string[];
  /** 툴·UI 액션에 붙은 한 줄 이유. payload 를 열지 않고 SQL 로 찾기 위한 평탄 축. */
  readonly reasons: readonly string[];
};

export type AiActivityLogInput = {
  readonly channel: AiActivityChannel;
  readonly instruction: string;
  readonly projectContextKey?: string;
  readonly model?: string;
  readonly liteModel?: string;
  readonly mapId?: string;
  readonly mapName?: string;
  readonly region?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly result: AiActivityResult;
  readonly toolCalls?: readonly AiActivityToolCall[];
  readonly audit?: readonly AuditEntry[];
  readonly uiEvents?: readonly unknown[];
  readonly uiActions?: readonly AiUiEvent[];
  readonly id?: string;
  /** 생략하면 이 탭의 런 식별자가 자동으로 붙는다. 테스트에서만 명시한다. */
  readonly runId?: string;
  readonly at?: string;
};

export type RegionActivityLogLike = {
  readonly exportedAt: string;
  readonly mapId: string;
  readonly mapName: string;
  readonly region: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly instruction: string;
  readonly result: {
    readonly ok: boolean;
    readonly applied: boolean;
    readonly changedCells: number;
    readonly changedEvents: number;
    readonly clippedCells: number;
    readonly proposedCalls: number;
    readonly assistantText: string;
    readonly error?: string;
    readonly stoppedReason?: string;
  };
  readonly toolCalls: readonly {
    readonly name: string;
    readonly args: Record<string, unknown>;
    readonly ok: boolean;
    readonly summary: string;
    readonly reason?: string;
    readonly softConfirm?: unknown;
    readonly construction?: ConstructionAuditRecord;
  }[];
  readonly audit: readonly AuditEntry[];
  readonly uiEvents: readonly unknown[];
};
