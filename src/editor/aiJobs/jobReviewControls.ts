import type { AiJob, AiJobResult, BlobRef } from "@/ai/jobs/contracts";
import type { EventCommandsJobProposal } from "@/ai/jobs/executors/eventCommandsJob";
import { diffCommandLists } from "@/editor/panels/eventEditor/commandDiff";
import { renderStagedDiff } from "@/editor/panels/eventEditor/stagedDiffView";
import { renderCapturedTilesetProposal } from "@/editor/panels/tilesetAiNativeReviewInbox";
import type { TilesetAiReviewProposal } from "@/editor/tilesetAiNativeReviewModel";
import { el } from "@/util/dom";
import type { JobClient } from "./jobClient";
import type { JobReview } from "./materializeJobResult";

interface ReviewSelection { excluded: Set<string>; proposals: Set<string>; initialized: boolean }
// Local choices survive report close/reopen, but can never leak into a different result.
const selections = new Map<string, ReviewSelection>();
export async function createJobReview(client: JobClient, job: AiJob): Promise<{ element: HTMLElement; review: () => JobReview }> {
  const key = `${job.id}:${job.resultRef?.sha256}`;
  let selection = selections.get(key);
  if (!selection) { selection = { excluded: new Set(), proposals: new Set(), initialized: false }; selections.set(key, selection); }
  const state = selection;
  const element = el("section", { class: "ai-jobs-review", dataset: { testid: "ai-job-review", result: job.resultRef?.sha256 ?? "" } });
  const review = (): JobReview => ({ approved: true, excludedRowIds: [...state.excluded], ...(state.initialized ? { proposalIds: [...state.proposals] } : {}) });
  if (!job.resultRef) return { element, review };
  const result = await client.artifacts.json<AiJobResult>(job.id, job.resultRef);
  if (job.family === "event-commands") {
    const proposal = await client.artifacts.json<EventCommandsJobProposal>(job.id, result.payload.proposalRef as unknown as BlobRef);
    const rows = diffCommandLists(proposal.baseCommands, proposal.finalCommands);
    const render = (): void => {
      const focused = element.querySelector<HTMLElement>(":focus")?.closest<HTMLElement>("[data-staged-id]")?.dataset.stagedId;
      element.replaceChildren(el("h3", { text: "명령 검토 · 제외할 변경 선택" }), renderStagedDiff({ rows, excluded: state.excluded, onToggle: id => { if (state.excluded.has(id)) state.excluded.delete(id); else state.excluded.add(id); render(); } }));
      if (focused) [...element.querySelectorAll<HTMLElement>("[data-staged-id]")].find(row => row.dataset.stagedId === focused)?.querySelector<HTMLButtonElement>("button")?.focus();
    }; render();
  } else if (job.family === "tileset" && result.payload.proposalRef) {
    const proposal = await client.artifacts.json<{ review?: { proposals: TilesetAiReviewProposal[] } }>(job.id, result.payload.proposalRef as unknown as BlobRef);
    if (proposal.review) {
      if (!state.initialized) { for (const item of proposal.review.proposals) if (item.status === "accepted") state.proposals.add(item.id); state.initialized = true; }
      element.append(el("h3", { text: "타일 지식 검토 · 반영할 제안 선택" }), ...proposal.review.proposals.map(item => renderCapturedTilesetProposal(item, state.proposals.has(item.id), selected => { if (selected) state.proposals.add(item.id); else state.proposals.delete(item.id); })));
    }
  }
  return { element, review };
}
