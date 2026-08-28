import type { AuditEntry } from "@/ai/assistantSession";
import type { ConstructionAuditRecord } from "@/editor/construction/constructionAudit";

export type AiActivityChannel = "chat" | "region" | "tileset-analysis" | "other";

export type AiActivityToolCall = {
  readonly name: string;
  readonly args: Record<string, unknown>;
  readonly ok?: boolean;
  readonly summary?: string;
  readonly softConfirm?: unknown;
  readonly construction?: ConstructionAuditRecord;
};

export type AiActivityResult = {
  readonly ok: boolean;
  readonly applied?: boolean;
  readonly error?: string;
  readonly stoppedReason?: string;
  readonly changedCells?: number;
  readonly changedEvents?: number;
  readonly clippedCells?: number;
  readonly proposedCalls?: number;
  readonly assistantText?: string;
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
  readonly uiEvents?: readonly unknown[];
  readonly diagnostics: AiActivityDiagnostics;
  readonly persisted?: "local" | "supabase" | "both" | "failed-remote";
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
    readonly softConfirm?: unknown;
    readonly construction?: ConstructionAuditRecord;
  }[];
  readonly audit: readonly AuditEntry[];
  readonly uiEvents: readonly unknown[];
};
