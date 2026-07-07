import type { PendingBuild, ProposedCall } from "@/ai/assistantSession";
import { runTool, type ToolContext, type ToolResult } from "@/editor/tools";
import type { VocabularyProposalCard } from "@/editor/tools/v3";
import type { Project } from "@/project/types";

export interface SelectedPendingBuild {
  readonly callIndex: number;
  readonly pending: PendingBuild;
}

export function collectPendingBuilds(calls: readonly ProposedCall[], selected?: readonly boolean[]): SelectedPendingBuild[] {
  const out: SelectedPendingBuild[] = [];
  calls.forEach((call, index) => {
    if (selected && selected[index] !== true) return;
    for (const pending of call.pendingBuilds ?? []) out.push({ callIndex: index, pending });
  });
  return out;
}

export function rebindPendingBuildArgs(
  pending: PendingBuild,
  originalCards: readonly VocabularyProposalCard[] | null,
  committedCards: readonly VocabularyProposalCard[] | null
): Record<string, unknown> {
  const args = structuredClone(pending.args);
  const original = originalCards ?? [];
  const committed = committedCards ?? original;
  let target: string | undefined;
  const index = original.findIndex((card) => card.kind === "group" && card.groupId === pending.vocabId);
  if (index >= 0) target = committed[index]?.groupId ?? pending.vocabId;
  else {
    const groups = committed.filter((card) => card.kind === "group" && typeof card.groupId === "string");
    if (groups.length === 1) target = groups[0].groupId;
  }
  if (target !== undefined) args[pending.vocabIdField] = target;
  return args;
}

export interface PendingBuildOutcome {
  readonly pending: PendingBuild;
  readonly result: ToolResult;
}

export function runPendingBuilds(
  project: Project,
  builds: readonly { readonly pending: PendingBuild; readonly args: Record<string, unknown> }[]
): { project: Project; outcomes: PendingBuildOutcome[] } {
  const ctx: ToolContext = { project };
  const outcomes: PendingBuildOutcome[] = [];
  for (const { pending, args } of builds) {
    const result = runTool(ctx, pending.tool, args, { dryRun: false });
    outcomes.push({ pending, result });
  }
  return { project: ctx.project, outcomes };
}

export function proposalAcceptButtonLabel(hasPendingBuild: boolean, selectedCount: number, total: number): string {
  if (hasPendingBuild) return selectedCount === total ? "승인하고 시공" : `선택 ${selectedCount}건 승인하고 시공`;
  return selectedCount === total ? "수락해서 적용" : `선택 ${selectedCount}건 적용`;
}
