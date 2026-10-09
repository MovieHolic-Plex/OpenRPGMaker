// 모든 툴 호출·프론트 액션에 붙는 한 줄 이유.
//
// 왜 필요한가 (2026-09-02 실측): 검토 요청이 tile_erase 754칸 + author_village 로
// 마을을 갈아엎었는데, 그 턴의 활동 로그는 pending 시작 행만 남고 toolCalls/이유가
// 비어 있었다. 모델이 왜 지웠는지 사후에 복원할 수 없었다.
// 이유는 실행 인자에서 떼어 감사·활동 로그·대화 entries_json 에 따로 실는다 —
// 툴 구현이 reason 필드를 몰라도 되고, 로컬/원격 payload 에는 반드시 남는다.
import type { AiActivityLogRecord, AiActivityToolCall } from "./activityLogTypes";
import type { JsonSchema, ToolResult } from "@/editor/tools/types";

export const TOOL_REASON_KEY = "reason";
export const TOOL_REASON_DESCRIPTION =
  "이 툴을 지금 호출하는 이유. 한 줄. 사용자 지시의 어느 부분을 이 호출로 처리하는지.";

export type ToolReasonKind = "verification" | "spec-npc" | "npc-cast" | "ui-click" | "human-edit" | "tool-direct";

export type SplitToolCallReason = {
  readonly reason: string;
  readonly args: Record<string, unknown>;
  readonly missing: boolean;
};

export type AuditToolLike = {
  readonly kind: string;
  readonly name?: string;
  readonly args?: Record<string, unknown>;
  readonly ok?: boolean;
  readonly summary?: string;
  readonly reason?: string;
};

export function isUsableToolReason(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function injectToolReasonSchema(parameters: JsonSchema): JsonSchema {
  const existing = parameters.properties?.[TOOL_REASON_KEY];
  const properties = {
    ...(parameters.properties ?? {}),
    [TOOL_REASON_KEY]: existing ?? {
      type: "string" as const,
      description: TOOL_REASON_DESCRIPTION,
      minLength: 1,
    },
  };
  const required = parameters.required?.includes(TOOL_REASON_KEY)
    ? parameters.required
    : [...(parameters.required ?? []), TOOL_REASON_KEY];
  return {
    ...parameters,
    type: parameters.type ?? "object",
    properties,
    required,
  };
}

export function injectToolReasonIntoOpenAiTool<T extends { function: { parameters: unknown } }>(tool: T): T {
  const parameters = tool.function.parameters;
  if (!parameters || typeof parameters !== "object") return tool;
  return {
    ...tool,
    function: {
      ...tool.function,
      parameters: injectToolReasonSchema(parameters as JsonSchema),
    },
  };
}

export function splitToolCallReason(args: Record<string, unknown> | undefined): SplitToolCallReason {
  const raw = args ?? {};
  const value = raw[TOOL_REASON_KEY];
  const { [TOOL_REASON_KEY]: _ignored, ...rest } = raw;
  const reason = isUsableToolReason(value) ? value.trim() : "";
  return { reason, args: rest, missing: reason.length === 0 };
}

export function missingToolReasonResult(name: string): ToolResult {
  return {
    ok: false,
    summary: `'${name}' 거부: reason(한 줄 이유)이 없습니다. 왜 이 툴을 지금 호출하는지 reason 을 넣어 다시 호출하세요.`,
    issues: [{ severity: "error", code: "missing-tool-reason", message: `${name}: reason is required` }],
  };
}

export function harnessToolReason(kind: ToolReasonKind, detail: string): string {
  switch (kind) {
    case "verification":
      return `레이어 검증: ${detail}`;
    case "spec-npc":
      return `밑그림 NPC 에셋 자동 배치: ${detail}`;
    case "npc-cast":
      return `캐스트 라이터 대사 적용: ${detail}`;
    case "ui-click":
      return `사용자 클릭: ${detail}`;
    case "human-edit":
      return `사람이 편집: ${detail}`;
    case "tool-direct":
      return `툴 직접 실행: ${detail}`;
  }
}

export function reasonForUiAction(input: { action: string; label?: string; testid?: string }): string {
  if (isUsableToolReason(input.label)) return `사용자 클릭: ${input.label.trim()}`;
  if (isUsableToolReason(input.testid)) return `사용자 클릭: ${input.testid.trim()}`;
  return `사용자 클릭: ${input.action}`;
}

export function reasonForEditAction(input: {
  readonly reason?: string;
  readonly label?: string | null;
  readonly origin?: string;
}): string {
  if (isUsableToolReason(input.reason)) return input.reason.trim();
  if (isUsableToolReason(input.label)) {
    return input.origin === "ai" || input.origin === "tool"
      ? input.label.trim()
      : harnessToolReason("human-edit", input.label.trim());
  }
  if (input.origin === "ai") return "AI 적용";
  if (input.origin === "tool") return harnessToolReason("tool-direct", "에디터 툴");
  return "사람이 편집";
}

export function toolCallsFromAudit(entries: readonly AuditToolLike[]): AiActivityToolCall[] {
  const calls: AiActivityToolCall[] = [];
  for (const entry of entries) {
    if (entry.kind !== "tool" || typeof entry.name !== "string") continue;
    calls.push({
      name: entry.name,
      args: entry.args ?? {},
      ...(typeof entry.ok === "boolean" ? { ok: entry.ok } : {}),
      ...(typeof entry.summary === "string" ? { summary: entry.summary } : {}),
      ...(isUsableToolReason(entry.reason) ? { reason: entry.reason.trim() } : {}),
    });
  }
  return calls;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function activityWeight(record: AiActivityLogRecord): number {
  return (
    record.toolCalls.length
    + record.audit.length
    + (record.uiActions?.length ?? 0)
    + (record.index.reasons?.length ?? 0)
    + (record.result.pending ? 0 : 50)
  );
}

function pickLonger<T>(left: readonly T[], right: readonly T[]): readonly T[] {
  return left.length >= right.length ? left : right;
}

/**
 * 같은 id 의 빈 pending 시작 행이, 이미 툴/이유를 담은 행을 덮어쓰지 못하게 한다.
 * 종료 행이 툴을 빠뜨려도 중간 스냅샷의 툴·이유를 살린다.
 */
export function preferRicherActivityRecord(
  prev: AiActivityLogRecord | undefined,
  next: AiActivityLogRecord,
): AiActivityLogRecord {
  if (!prev || prev.id !== next.id) return next;
  if (next.result.pending && activityWeight(next) < activityWeight(prev)) return prev;

  const toolCalls = pickLonger(next.toolCalls, prev.toolCalls);
  const audit = pickLonger(next.audit, prev.audit);
  const uiActions = pickLonger(next.uiActions ?? [], prev.uiActions ?? []);
  const reasons = uniqueStrings([...(prev.index.reasons ?? []), ...(next.index.reasons ?? [])]);
  return {
    ...next,
    toolCalls,
    audit,
    ...(uiActions.length > 0 ? { uiActions } : {}),
    index: {
      ...next.index,
      toolNames: uniqueStrings([...prev.index.toolNames, ...next.index.toolNames]),
      failedToolNames: uniqueStrings([...prev.index.failedToolNames, ...next.index.failedToolNames]),
      uiActions: uniqueStrings([...prev.index.uiActions, ...next.index.uiActions]),
      commitIds: uniqueStrings([...prev.index.commitIds, ...next.index.commitIds]),
      mapIds: uniqueStrings([...prev.index.mapIds, ...next.index.mapIds]),
      userTexts: uniqueStrings([...prev.index.userTexts, ...next.index.userTexts]).slice(-20),
      reasons,
    },
  };
}
