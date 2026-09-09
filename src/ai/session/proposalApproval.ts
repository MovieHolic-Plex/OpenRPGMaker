// ai/session/proposalApproval.ts
// 제안 카드가 사용자 승인을 명시로 받아야 하는가와 그때 보여줄 경고 문구.
// 파괴성 판정 자체는 approvalPolicy.isDestructiveOutcome 한 곳이 정본이다 — 여기 있던
// 3개짜리 지역 목록이 그쪽 6개짜리와 어긋났던 전례가 있다.

import type { ToolResult } from "@/editor/tools";
import { isRecord } from "./unknownValue";
import type { ProposedCall } from "./types";

export const RULE_TOOLS: ReadonlySet<string> = new Set(["set_cluster_rule", "set_group_junction", "set_group_overlay"]);

// 어휘 합의: propose_tile_vocabulary 또는 soft-confirm 시공(목업 확인)은 검수 전 초안에
// origin:user 로 확정된다(reviewCurrentDraft — 승인 뒤 후보 변경 금지(R2)).
export const VOCABULARY_PROPOSAL_TOOLS: ReadonlySet<string> = new Set(["propose_tile_vocabulary"]);
const VOCABULARY_APPROVAL_WARNING = "🔒 재료 합의: 적용하면 해당 타일/그룹을 다음부터 바로 씁니다(되돌리기로 원복).";
export const VOCAB_SOFT_CONFIRM_APPROVAL_WARNING =
  "🖼 맵 배치와 함께 재료를 합의했습니다(origin:user). 되돌리면 배치와 합의가 함께 원복됩니다.";
const HARD_CLUSTER_RULE_WARNING = "⚠️ 강한 규칙: 이 타일셋을 쓰는 모든 맵의 저장(커밋)이 규칙 위반 시 거부됩니다.";

export function proposalNeedsExplicitApproval(calls: readonly ProposedCall[]): boolean {
  return calls.some((call) => call.requiresApproval === true);
}

export function proposalApprovalWarnings(calls: readonly ProposedCall[]): string[] {
  const warnings = calls
    .map((call) => call.approvalWarning)
    .filter((warning): warning is string => typeof warning === "string" && warning.length > 0);
  return [...new Set(warnings)];
}

export function ruleToolRejectionText(name: string, result: ToolResult): string | null {
  if (!RULE_TOOLS.has(name) || result.ok) return null;
  const issues = result.issues ?? [];
  if (issues.length === 0) return `실패 · ${name} — 커밋 거부: ${result.summary}`;
  const samples = issues
    .filter((issue) => typeof issue.mapId === "string" && typeof issue.x === "number" && typeof issue.y === "number")
    .slice(0, 2)
    .map((issue) => `${issue.mapId} ${issue.x},${issue.y}`);
  const coords = samples.length > 0 ? ` (${samples.join(" / ")}${issues.length > samples.length ? " …" : ""})` : "";
  return `실패 · ${name} — 커밋 거부: 위반 ${issues.length}곳${coords}`;
}

export function approvalWarningFor(name: string, args: Record<string, unknown>): string | undefined {
  if (VOCABULARY_PROPOSAL_TOOLS.has(name)) return VOCABULARY_APPROVAL_WARNING;
  const rule = args.rule;
  if (name !== "set_cluster_rule" || !isRecord(rule)) return undefined;
  return rule.strength === "hard" ? HARD_CLUSTER_RULE_WARNING : undefined;
}
