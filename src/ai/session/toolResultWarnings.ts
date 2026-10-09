// ai/session/toolResultWarnings.ts
// 이미 성공한 ToolResult 에 경고를 덧붙인다. 성공/실패 판정과 diff 본문은 건드리지 않고
// 사용자에게 보일 경고 목록만 늘린다 — 제안 카드와 게이트 통과 경고가 같은 통로를 쓴다.

import type { ToolResult } from "@/editor/tools";
import type { LintIssue } from "@/project/lint/projectLint";

export function appendDiffWarning(result: ToolResult, warning: string): ToolResult {
  const diff = result.diff;
  if (!diff || diff.warnings.includes(warning)) return result;
  return { ...result, diff: { ...diff, warnings: [...diff.warnings, warning] } };
}

export function withSpecGateWarnings(result: ToolResult, warnings: readonly LintIssue[]): ToolResult {
  if (!result.ok || warnings.length === 0) return result;
  const warningMessages = warnings.map((warning) => warning.message);
  return {
    ...result,
    diff: result.diff
      ? { ...result.diff, warnings: [...result.diff.warnings, ...warningMessages] }
      : result.diff,
    issues: [...(result.issues ?? []), ...warnings],
  };
}
