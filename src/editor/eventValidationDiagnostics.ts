import type { EventDraftValidation } from "./eventDraftValidator";
import type { GameEvent } from "@/project/types";
import { eventDraftRuleGuidance } from "./eventDraftIssueDetails";

/** A projection, not a string redactor: no authored values, IDs, logs or project payload. */
export function eventValidationDiagnosticReport(validation: EventDraftValidation, event: GameEvent) {
  return {
    schemaVersion: 1 as const,
    status: "UNSENT" as const,
    issues: validation.issues.filter(issue => issue.severity === "error").map(issue => {
      const rule = eventDraftRuleGuidance(issue.code);
      return {
        code: rule.code,
        severity: issue.severity,
        page: Math.max(0, (event.pages ?? []).findIndex(page => page.id === issue.pageId) + 1),
        commandPath: [...(issue.commandPath ?? [])],
        field: issue.field?.testId ?? rule.testId,
        conditionPath: [...(issue.field?.conditionPath ?? [])],
        ...(issue.field?.selectTestId ? { selection: issue.field.selectTestId } : {}),
        cause: rule.cause,
        expected: rule.expected,
        hint: rule.hint,
      };
    }),
  };
}

export type EventValidationDiagnosticReport = ReturnType<typeof eventValidationDiagnosticReport>;

export function formatEventValidationDiagnostics(report: EventValidationDiagnosticReport, format: "markdown" | "json"): string {
  const json = JSON.stringify(report, null, 2);
  if (format === "json") return json;
  return `# 이벤트 검증 진단 (UNSENT)\n\n현재 이벤트의 오류만 포함합니다. 이름·입력값·프로젝트 데이터는 제외했습니다.\n\n\`\`\`json\n${json}\n\`\`\``;
}
