import type { ProposedCall } from "@/ai/assistantSession";
import { applyVocabSoftConfirmApprovals, extractVocabSoftConfirm, type VocabSoftConfirm } from "@/project/tileVocabulary";
import type { Project } from "@/project/types";

export function proposalAcceptButtonLabel(selectedCount: number, total: number): string {
  return selectedCount === total ? "맵만 적용" : `선택 ${selectedCount}건 맵만 적용`;
}

export function proposalAcceptWithMaterialButtonLabel(selectedCount: number, total: number): string {
  return selectedCount === total ? "맵 적용 + 재료 합의" : `선택 ${selectedCount}건 맵+재료 합의`;
}

export function collectVocabSoftConfirms(calls: readonly ProposedCall[], selected?: readonly boolean[]): VocabSoftConfirm[] {
  const out: VocabSoftConfirm[] = [];
  calls.forEach((call, index) => {
    if (selected && selected[index] !== true) return;
    const soft = extractVocabSoftConfirm(call.result.data);
    if (soft) out.push(soft);
  });
  return out;
}

/** soft-confirm 재료를 origin:user 로 확정(수락 훅). */
export function markSoftVocabApprovalsOnProject(project: Project, calls: readonly ProposedCall[], selected?: readonly boolean[]): number {
  return applyVocabSoftConfirmApprovals(project, collectVocabSoftConfirms(calls, selected));
}
