// editor/tools/toolRunner.ts
// 툴 실행기. runTool(ctx, name, args, {dryRun}) → ToolResult.
// - 인자를 JSON Schema로 최소 검증.
// - 읽기 툴: project를 읽기만 하고 data 반환.
// - 쓰기 툴: draft(구조적 복제)에 적용 → diff 요약 → commitChangeset(projectLint 게이트).
//   차단 error가 있으면 반영 거부(ok:false). cluster-rule hard error는 issues로 보고하되 통과한다.
//   dryRun이면 통과해도 ctx.project를 갱신하지 않는다.

import type { LintIssue } from "@/project/lint/projectLint";
import { commitChangeset, createDraft, summarizeChanges } from "./changeset";
import { validateArgs } from "./jsonSchema";
import { getTool } from "./toolRegistry";
import { ToolError, type ToolContext, type ToolResult } from "./types";

export interface RunToolOptions {
  readonly dryRun?: boolean;
}

function issueFromError(cause: unknown): LintIssue {
  if (cause instanceof ToolError) {
    return { severity: "error", code: cause.code, mapId: cause.mapId, x: cause.x, y: cause.y, message: cause.message };
  }
  return { severity: "error", code: "tool-exception", message: cause instanceof Error ? cause.message : String(cause) };
}

// 실패 요약에 원인 한 줄을 포함한다 — 감사 로그만 보고도 원인을 알 수 있고,
// 모델도 summary 단계에서 바로 자가 수정 신호를 받는다.
function failureSummary(name: string, cause: unknown): string {
  const issue = issueFromError(cause);
  const message = issue.message.length > 200 ? `${issue.message.slice(0, 200)}…` : issue.message;
  return `'${name}' 실행 실패: ${message}`;
}

export function runTool(
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>,
  options: RunToolOptions = {}
): ToolResult {
  const tool = getTool(name);
  if (!tool) {
    return { ok: false, summary: `알 수 없는 툴: ${name}`, issues: [{ severity: "error", code: "unknown-tool", message: `등록되지 않은 툴: ${name}` }] };
  }

  const argErrors = validateArgs(tool.parameters, args);
  if (argErrors.length > 0) {
    return {
      ok: false,
      summary: `'${name}' 인자 검증 실패`,
      issues: argErrors.map((message) => ({ severity: "error", code: "invalid-args", message })),
    };
  }

  if (tool.mode === "read") {
    try {
      const exec = tool.run(ctx.project, args);
      return { ok: true, summary: exec.summary, data: exec.data };
    } catch (cause) {
      return { ok: false, summary: failureSummary(name, cause), issues: [issueFromError(cause)] };
    }
  }

  // 쓰기 툴: draft에 적용.
  const before = ctx.project;
  const draft = createDraft(before);
  let exec;
  try {
    exec = tool.run(draft, args);
  } catch (cause) {
    return { ok: false, summary: failureSummary(name, cause), issues: [issueFromError(cause)] };
  }

  const diff = summarizeChanges(before, draft);
  if (exec.warnings) diff.warnings.push(...exec.warnings);

  const commit = commitChangeset(draft);
  if (!commit.ok) {
    return { ok: false, summary: `'${name}' 커밋 거부(무결성 오류)`, diff, issues: commit.issues };
  }

  if (!options.dryRun) ctx.project = draft;
  return {
    ok: true,
    summary: exec.summary,
    diff,
    issues: commit.issues.length > 0 ? commit.issues : undefined,
    data: exec.data,
  };
}
