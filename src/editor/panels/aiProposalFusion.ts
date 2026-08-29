import type { ProposedCall } from "@/ai/assistantSession";
import { applyVocabSoftConfirmApprovals, extractVocabSoftConfirm, type VocabSoftConfirm } from "@/project/tileVocabulary";
import type { Project } from "@/project/types";

export function collectVocabSoftConfirms(calls: readonly ProposedCall[], selected?: readonly boolean[]): VocabSoftConfirm[] {
  const out: VocabSoftConfirm[] = [];
  calls.forEach((call, index) => {
    if (selected && selected[index] !== true) return;
    const soft = extractVocabSoftConfirm(call.result.data);
    if (soft) out.push(soft);
  });
  return out;
}

/** soft-confirm 재료를 origin:user 로 확정(적용 후톡). 기존 origin:user 는 건드리지 않는다. */
export function markSoftVocabApprovalsOnProject(project: Project, calls: readonly ProposedCall[], selected?: readonly boolean[]): number {
  return applyVocabSoftConfirmApprovals(project, collectVocabSoftConfirms(calls, selected));
}
