// ai/approvalPolicy.ts — deny-by-default single approval boundary
import type { ChangeSummary } from "@/project/types";
import type { ProposedCall } from "./assistantSession";

export const DESTRUCTIVE_TOOLS: ReadonlySet<string> = new Set(["remove_event", "remove_map", "delete_database_record", "delete_resource", "clear_region", "reset_project"]);

/**
 * 파괴적 재시공을 옵트인으로 요청하는 인자 — 켜져 있으면 이름과 무관하게 파괴 툴이다.
 * (방 하네스 세션/파이프라인의 `replaceExisting`)
 */
const REPLACE_EXISTING_ARG = "replaceExisting";

/**
 * **결과 기반 파괴성 판정** (2026-08-29 modify 진단 근본원인 9).
 *
 * 기존 판정은 툴 **이름 목록**(`DESTRUCTIVE_TOOLS`)뿐이었다. 그래서 "지우고 제대로 다시 놓는다"
 * (`remove_event` 포함)는 체크박스 재승인 벽에 걸리고, "새 맵을 만들어 거기 짓는다"
 * (`run_interior_room_pipeline` — 실제로는 기존 맵을 통째로 교체하던 툴)는 마찰 0으로 즉시 적용됐다.
 * 승인 마찰이 정직한 수정에만 걸린 셈이다.
 *
 * 이름 목록은 유지하되, diff 가 소실을 보고하면(맵 제거·이벤트 제거) 이름과 무관하게 파괴로 본다.
 * 타일 대량 소실은 `ChangeSummary` 가 칠하기/지우기를 구분하지 않아 여기서 판정할 수 없다 —
 * 그 경로는 `replaceExisting` 옵트인과 방 하네스의 `map-exists` 가드가 막는다.
 */
export function isDestructiveOutcome(
  name: string,
  args: Record<string, unknown> | undefined,
  diff: ChangeSummary | undefined,
): boolean {
  if (DESTRUCTIVE_TOOLS.has(name)) return true;
  if (args?.[REPLACE_EXISTING_ARG] === true) return true;
  if (!diff) return false;
  return diff.mapsRemoved > 0 || diff.eventsRemoved > 0;
}
export const METADATA_ONLY_TOOLS: ReadonlySet<string> = new Set([
  "set_tile_metadata",
  "set_tile_rules",
  "upsert_tile_group",
  "set_tile_passability",
]);
export const VOCABULARY_TOOLS: ReadonlySet<string> = new Set(["propose_tile_vocabulary"]);
export const RULE_TOOLS_APPROVAL: ReadonlySet<string> = new Set(["set_cluster_rule", "set_group_junction", "set_group_overlay"]);

export type ApprovalDecision = "auto" | "require_approval" | "metadata_commit";

export interface ApprovalVerdict {
  readonly decision: ApprovalDecision;
  readonly reason: string;
  readonly requiresUserConfirm: boolean;
  readonly warnings: string[];
}

function isDestructive(call: ProposedCall): boolean {
  return call.destructive || DESTRUCTIVE_TOOLS.has(call.name);
}

function isVocab(call: ProposedCall): boolean {
  return !!call.requiresApproval || VOCABULARY_TOOLS.has(call.name) || call.approvalWarning?.includes("재료 합의") === true;
}

function isRule(call: ProposedCall): boolean {
  return RULE_TOOLS_APPROVAL.has(call.name);
}

export function classifyApproval(calls: readonly ProposedCall[], opts: { autoApproveEnabled: boolean }): ApprovalVerdict {
  const warnings: string[] = [];
  const hasDestructive = calls.some(isDestructive);
  const hasVocab = calls.some(isVocab);
  const hasRule = calls.some(isRule);
  const hasRequiresApproval = calls.some((c) => c.requiresApproval === true);

  if (hasDestructive) {
    return {
      decision: "require_approval",
      reason: "파괴적 변경(remove/clear/기존 맵 교체)이 포함되어 있어 명시적 승인이 필요합니다.",
      requiresUserConfirm: true,
      warnings: ["파괴적 작업 포함 — 체크박스 확인 후 재승인이 필요합니다."],
    };
  }
  if (hasVocab || hasRequiresApproval || hasRule) {
    return {
      decision: "require_approval",
      reason: "어휘/규칙 합의 또는 requiresApproval 플래그로 수동 승인이 필요합니다.",
      requiresUserConfirm: false,
      warnings: hasVocab ? ["어휘 합의 — 승인 시 영구 합의(origin:user)로 기록됩니다."] : [],
    };
  }
  if (!opts.autoApproveEnabled) {
    return { decision: "require_approval", reason: "자동 승인이 꺼져 있어 수동 승인이 필요합니다.", requiresUserConfirm: false, warnings };
  }
  return { decision: "auto", reason: "자동 승인 조건 충족", requiresUserConfirm: false, warnings };
}

export type ProposalApplyMode = "apply-now" | "review";

export interface ProposalApplyModeInput {
  /** 이 턴이 만든 쓰기 툼콜 수. 0 이면 적용할 것이 없다. */
  readonly callCount: number;
  /** agentMode === "auto" 또는 autoApprove === true. 기본값은 켜진 상태다. */
  readonly autoApplyEnabled: boolean;
  readonly approvalDecision: ApprovalDecision;
  readonly turnErrored: boolean;
}

/**
 * 제안을 바로 맵에 넣을지(apply-now), 사용자 결정 카드로 보낼지(review) 한 자리에서 정한다.
 *
 * 안전 분류(`classifyProposalSafety`)와 완성도 린트 경고는 **이 입력에 없다** — 일부러 버렸다.
 * 되돌리기 한 번으로 원복되는 변경을 승인 카드로 받아내면 마찰만 남고(사용자는 항상
 * 수락한다), 경고는 카드가 아니라 로그로 전달하면 된다. 복구 경로는 좌하단 되돌리기
 * (oprn-tool-undo → undoMapEdit) 와 자동 적용 카드의 되돌리기다.
 *
 * 단 `require_approval`은 그대로 검토로 보낸다: 파괴적/재료합의 변경은 acceptProposal 안에서
 * 확인 단계를 거치기 때문에, 자동 적용 카드를 먼저 붙이면 "적용됨" 이 거짓이 된다.
 */
export function resolveProposalApplyMode(input: ProposalApplyModeInput): ProposalApplyMode {
  if (input.callCount <= 0) return "review";
  if (input.turnErrored) return "review";
  if (!input.autoApplyEnabled) return "review";
  return input.approvalDecision === "auto" ? "apply-now" : "review";
}

export function isSilencedSuccess(calls: readonly ProposedCall[], assistantText: string): { silenced: boolean; kind: string; message: string } | null {
  if (calls.length === 0) {
    const clipped = assistantText.trim().slice(0, 120);
    return { silenced: true, kind: "empty_proposal", message: `변경 없이 종료됨 — "${clipped || "설명 없음"}" — 재시도/되묻기 필요` };
  }
  const autoExpanded = calls.some((c) => c.approvalWarning?.includes("auto-expanded") || c.summary.includes("자동 확장"));
  if (autoExpanded) return { silenced: true, kind: "auto_expanded", message: "스펙 밖 영역을 자동 확장으로 채웠습니다 — 위치를 확인하세요." };
  return null;
}
