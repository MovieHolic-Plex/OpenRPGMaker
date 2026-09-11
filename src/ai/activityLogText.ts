// ai/activityLogText.ts
// AI 조수 사용 로그(src/ai/activityLog.ts)를 **사람이 그냥 읽는 .txt** 로 옮긴다.
//
// 왜 JSON 이 아닌가: 이 로그를 꺼낼 수 있는 창구는 `npm run ai:log` CLI 와
// `serializeAiActivityLogs()`(테스트 전용)뿐이었다. 둘 다 개발자용이라, 조수가 무슨 일을
// 했는지 확인하려는 사용자는 볼 방법이 없었다. 사용자가 첨부·검색·통독하는 대상은
// 169KB 짜리 payload_json 이 아니라 한 턴이 한 문단인 글이다. 그래서 텍스트가 정본이다.
// (기계 판독이 필요하면 `serializeAiActivityLogs()` 가 그대로 남아 있다.)
//
// 규칙 하나: **조용히 자르지 않는다.** 지시문·응답·감사 기록은 길어도 전부 싣고,
// 로그가 이미 예산에 걸려 잘린 몫(record.truncated)은 잘렸다고 적는다. 잘린 로그를
// 잘린 줄 모르고 읽으면 "원래 그만큼이었다" 로 읽힌다.

import type { AuditEntry } from "@/ai/assistantSession";
import type { AiActivityLogRecord, AiActivityToolCall } from "@/ai/activityLogTypes";

const RULE = "────────────────────────────────────────────────────────────";

const CHANNEL_LABEL: Readonly<Record<string, string>> = {
  chat: "대화",
  region: "영역 작업",
  "tileset-analysis": "타일셋 분석",
  ui: "화면 조작",
  pi: "Pi 에이전트",
  other: "기타",
};

const SEVERITY_LABEL: Readonly<Record<string, string>> = {
  ok: "정상",
  warning: "경고",
  error: "오류",
};

/** 내려받기 파일 이름. editActivityPanel 의 내보내기와 같은 시각 표기(콜론/점 → 하이픈). */
export function aiActivityLogTextFileName(at: Date = new Date()): string {
  return `ai-usage-log-${at.toISOString().replace(/[:.]/gu, "-")}.txt`;
}

/** 로그 전체를 사람이 읽는 한 덩어리 텍스트로. 최신 기록이 위(입력 순서 그대로)다. */
export function formatAiActivityLogText(
  records: readonly AiActivityLogRecord[],
  options: { readonly at?: Date } = {},
): string {
  const at = options.at ?? new Date();
  const lines: string[] = [
    "AI 조수 사용 로그",
    `내려받은 시각: ${at.toISOString()}`,
    `기록: ${records.length}건${records.length > 0 ? " (최신 순)" : ""}`,
  ];
  if (records.length === 0) {
    lines.push("", "남은 기록이 없습니다.");
  }
  records.forEach((record, index) => {
    lines.push("", RULE, ...recordLines(record, index + 1));
  });
  return `${lines.join("\n")}\n`;
}

function recordLines(record: AiActivityLogRecord, order: number): string[] {
  const lines: string[] = [
    `[${order}] ${record.at} · ${channelLabel(record.channel)} · ${resultHeadline(record)}`,
  ];
  const model = record.liteModel ? `${record.model ?? "모델 미기록"} (보조 ${record.liteModel})` : record.model;
  if (model) lines.push(`모델: ${model}`);
  if (record.mapName || record.mapId) lines.push(`맵: ${record.mapName ?? record.mapId}${record.mapName && record.mapId ? ` (${record.mapId})` : ""}`);
  if (record.region) {
    const { x, y, width, height } = record.region;
    lines.push(`영역: (${x}, ${y}) 크기 ${width}×${height}`);
  }
  lines.push(...block("지시", record.instruction));

  const detail = resultDetail(record);
  if (detail.length > 0) lines.push(`결과 상세: ${detail.join(" · ")}`);
  const recap = recapLine(record);
  if (recap) lines.push(`자원: ${recap}`);
  if (record.result.error) lines.push(...block("오류", record.result.error));
  if (record.result.stoppedReason) lines.push(`중단 사유: ${record.result.stoppedReason}`);
  if (record.result.commitIds && record.result.commitIds.length > 0) {
    lines.push(`커밋: ${record.result.commitIds.join(", ")}`);
  }

  const diagnostics = record.diagnostics;
  if (diagnostics) {
    const severity = SEVERITY_LABEL[diagnostics.severity] ?? diagnostics.severity;
    const parts = [severity];
    if (diagnostics.kinds.length > 0) parts.push(diagnostics.kinds.join(", "));
    if (diagnostics.failedTools.length > 0) parts.push(`실패 도구 ${diagnostics.failedTools.join(", ")}`);
    lines.push(`진단: ${parts.join(" · ")}`);
    for (const message of diagnostics.messages) lines.push(...block("  진단 메시지", message));
  }

  if (record.toolCalls.length > 0) {
    lines.push(`도구 호출 (${record.toolCalls.length}건):`);
    record.toolCalls.forEach((call, index) => lines.push(...toolCallLines(call, index + 1)));
  }
  if (record.result.assistantText) lines.push(...block("조수 응답", record.result.assistantText));
  if (record.audit.length > 0) {
    lines.push(`대화 기록 (${record.audit.length}건):`);
    for (const entry of record.audit) lines.push(...auditLines(entry));
  }

  const truncated = truncatedNote(record);
  if (truncated) lines.push(`잘린 기록: ${truncated} — 이 턴은 예산에 걸려 일부가 저장되지 않았습니다`);
  if (record.persisted) lines.push(`저장 위치: ${record.persisted}`);
  if (record.runId) lines.push(`런: ${record.runId}`);
  lines.push(`기록 id: ${record.id}`);
  return lines;
}

function channelLabel(channel: string): string {
  return CHANNEL_LABEL[channel] ?? channel;
}

function resultHeadline(record: AiActivityLogRecord): string {
  if (record.result.pending) return "진행 중";
  return record.result.ok ? "성공" : "실패";
}

function resultDetail(record: AiActivityLogRecord): string[] {
  const result = record.result;
  const parts: string[] = [];
  if (result.applied !== undefined) parts.push(result.applied ? "적용됨" : "적용 안 됨");
  if (result.changedCells !== undefined) parts.push(`셀 ${result.changedCells}칸`);
  if (result.changedEvents !== undefined) parts.push(`이벤트 ${result.changedEvents}건`);
  if (result.clippedCells !== undefined && result.clippedCells > 0) parts.push(`영역 밖 ${result.clippedCells}칸 잘림`);
  if (result.proposedCalls !== undefined) parts.push(`제안 ${result.proposedCalls}건`);
  if (result.appliedCalls !== undefined) parts.push(`적용 ${result.appliedCalls}건`);
  if (result.orphaned) parts.push("소유권 끊긴 뒤 도착");
  return parts;
}

/** 이 턴이 태운 것. 사람이 "왜 이렇게 오래 걸렸나" 를 묻는 자리라 요약에 그대로 싣는다. */
function recapLine(record: AiActivityLogRecord): string | null {
  const recap = record.result.recap;
  if (!recap) return null;
  const parts = [
    `${(recap.elapsedMs / 1000).toFixed(1)}초`,
    `LLM ${recap.llmCalls}회`,
    `도구 ${recap.toolCalls}회`,
    `토큰 ${recap.promptTokens}/${recap.completionTokens}`,
  ];
  if (recap.ralphContinues > 0) parts.push(`이어가기 ${recap.ralphContinues}회`);
  if (recap.volumeContinues > 0) parts.push(`분량 이어가기 ${recap.volumeContinues}회`);
  return parts.join(" · ");
}

function toolCallLines(call: AiActivityToolCall, order: number): string[] {
  const status = call.ok === undefined ? "?" : call.ok ? "ok" : "실패";
  const head = `  ${order}. [${status}] ${call.name}${call.summary ? ` — ${call.summary}` : ""}`;
  const lines = [head];
  if (call.reason) lines.push(...block("     사유", call.reason));
  if (call.softConfirm) lines.push("     (목업 확인 후 진행)");
  const args = formatArgs(call.args);
  if (args) lines.push(`     인자: ${args}`);
  return lines;
}

/** 인자는 한 줄 JSON 으로. 사람이 읽는 문서라 들여쓴 JSON 블록보다 한 줄이 낫다. */
function formatArgs(args: Record<string, unknown>): string | null {
  const keys = Object.keys(args);
  if (keys.length === 0) return null;
  try {
    return JSON.stringify(args);
  } catch {
    return `${keys.length}개 키 (직렬화 실패)`;
  }
}

function auditLines(entry: AuditEntry): string[] {
  const at = entry.at ? `${entry.at} ` : "";
  if (entry.kind === "user") return block(`  ${at}[사용자]`, entry.text);
  if (entry.kind === "assistant") {
    const calls = entry.toolCalls && entry.toolCalls.length > 0 ? ` (도구 ${entry.toolCalls.map((call) => call.name).join(", ")})` : "";
    return block(`  ${at}[조수]${calls}`, entry.text);
  }
  if (entry.kind === "status") return block(`  ${at}[상태]`, entry.text);
  const status = entry.ok ? "ok" : "실패";
  const lines = [`  ${at}[도구 ${status}] ${entry.name} — ${entry.summary}`];
  if (entry.reason) lines.push(...block("      사유", entry.reason));
  if (entry.issues && entry.issues.length > 0) lines.push(`      지적: ${entry.issues.join(" / ")}`);
  return lines;
}

function truncatedNote(record: AiActivityLogRecord): string | null {
  const truncated = record.truncated;
  if (!truncated) return null;
  const parts: string[] = [];
  if (truncated.audit) parts.push(`대화 기록 ${truncated.audit}건`);
  if (truncated.toolCalls) parts.push(`도구 호출 ${truncated.toolCalls}건`);
  if (truncated.uiActions) parts.push(`화면 조작 ${truncated.uiActions}건`);
  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * `라벨: 값` 한 줄, 값이 여러 줄이면 라벨 아래로 들여쓴 블록. 지시문과 조수 응답은 줄바꿈을
 * 품고 있어서 한 줄로 이어 붙이면 서로 다른 문장이 한 문장으로 읽힌다.
 */
function block(label: string, text: string): string[] {
  const rows = text.replace(/\r\n/gu, "\n").split("\n");
  if (rows.length === 1) return [`${label}: ${rows[0] ?? ""}`];
  const indent = " ".repeat(label.length - label.trimStart().length + 2);
  return [`${label}:`, ...rows.map((row) => `${indent}${row}`)];
}
