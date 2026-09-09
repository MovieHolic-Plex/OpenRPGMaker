import {
  applyStagedReviewProposals,
  runTilesetAiReview,
  skipOneReviewProposal,
  hydrateTilesetAiReview,
  stageOneReviewProposal,
  tilesetAiReviewState,
  tilesetSourceJobId,
  updateReviewProposalFeedback,
} from "@/editor/tilesetAiNativeReviewSession";
import { JobSubmitError } from "@/editor/aiJobs/jobSubmitError";
import { bindJobView, readJobResult } from "@/editor/aiJobs/jobViewBinding";
import { parseTilesetReview } from "@/ai/jobs/tilesetPayload";
import {
  aiReviewBuckets,
  findRefreshedAiReviewProposal,
  proposalsForAiReview,
  type TilesetAiReviewProposal,
  type TilesetAiReviewState,
} from "@/editor/tilesetAiNativeReviewModel";
import type { TilesetDef } from "@/project/types";
import { renderTilesetAtlasImage } from "@/editor/panels/tilesetAiTempMapImage";
import { submitTilesetJob } from "@/editor/aiJobs/submitTilesetJob";

export type TilesetAiConversationTurn = {
  readonly role: "assistant" | "user";
  readonly text: string;
  readonly tone: "answer" | "confirmation" | "question";
};

export type TilesetAiConversationSnapshot = {
  readonly confirmed: readonly TilesetAiReviewProposal[];
  readonly current: TilesetAiReviewProposal | null;
  readonly next: TilesetAiReviewProposal | null;
  readonly state: TilesetAiReviewState;
  readonly turns: readonly TilesetAiConversationTurn[];
};

type ConversationSession = {
  activeProposalId: string | null;
  turns: readonly TilesetAiConversationTurn[];
};

const conversations = new Map<string, ConversationSession>();

export function resetTilesetAiConversation(): void {
  conversations.clear();
}

export function conversationSnapshot(tileset: TilesetDef): TilesetAiConversationSnapshot {
  const state = tilesetAiReviewState(tileset);
  const session = conversationFor(tileset.id);
  const proposals = proposalsForAiReview(state);
  const pending = orderedPending(state);
  const current = pending.find((proposal) => proposal.id === session.activeProposalId) ?? pending[0] ?? null;
  session.activeProposalId = current?.id ?? null;
  return {
    confirmed: proposals.filter((proposal) => proposal.status === "accepted"),
    current,
    next: pending.find((proposal) => proposal.id !== current?.id) ?? null,
    state,
    turns: session.turns,
  };
}

export function selectTilesetAiQuestion(tileset: TilesetDef, proposalId: string): void {
  const proposal = proposalsForAiReview(tilesetAiReviewState(tileset))
    .find((candidate) => candidate.id === proposalId && candidate.status === "pending");
  if (proposal) conversationFor(tileset.id).activeProposalId = proposal.id;
}

export function skipTilesetAiQuestion(tileset: TilesetDef): void {
  const snapshot = conversationSnapshot(tileset);
  if (!snapshot.current) return;
  skipOneReviewProposal(tileset, snapshot.current.id);
  conversationFor(tileset.id).activeProposalId = null;
}

export async function answerTilesetAiQuestion(
  tileset: TilesetDef,
  answer: string,
  rerender: () => void,
): Promise<void> {
  const trimmed = answer.trim();
  const snapshot = conversationSnapshot(tileset);
  if (!trimmed || !snapshot.current) return;
  const previous = snapshot.current;
  const session = conversationFor(tileset.id);
  session.turns = [
    ...session.turns,
    { role: "assistant", text: previous.question, tone: "question" },
    { role: "user", text: trimmed, tone: "answer" },
  ];
  updateReviewProposalFeedback(tileset, previous.id, trimmed);
  const review = tilesetAiReviewState(tileset);
  const sourceJobId = tilesetSourceJobId(tileset.id);
  if (sourceJobId && (review.status === "ready" || review.status === "stale" || review.status === "partial")) {
    const atlasDataUrl = await renderTilesetAtlasImage(tileset);
    const receipt = await submitTilesetJob({
      operation: "question-followup",
      tilesetId: tileset.id,
      atlasDataUrl,
      review,
      proposalId: previous.id,
      answer: trimmed,
      turns: session.turns,
      sourceJobId,
    }, { owner: session });
    const unbind = bindJobView(receipt.job.id, job => {
      if (job.generation === "succeeded") {
        unbind();
        void readJobResult(job).then(result => {
          if (!result) return;
          const nextReview = parseTilesetReview(result.payload.review ?? result.payload);
          hydrateTilesetAiReview(tileset, nextReview);
          const refreshed = findRefreshedAiReviewProposal(nextReview, previous);
          if (refreshed) {
            stageOneReviewProposal(tileset, refreshed.id);
            session.turns = [
              ...session.turns,
              { role: "assistant", text: `확인했어요. ${refreshed.name}로 기록할게요.`, tone: "confirmation" },
            ];
          }
          session.activeProposalId = null;
          rerender();
        });
      } else if (job.generation === "failed" || job.generation === "cancelled") {
        unbind();
        session.activeProposalId = null;
        rerender();
      }
    });
  } else {
    if (!sourceJobId && (review.status === "ready" || review.status === "stale" || review.status === "partial")) {
      await runTilesetAiReview(tileset, rerender);
      const refreshed = findRefreshedAiReviewProposal(tilesetAiReviewState(tileset), previous);
      if (refreshed) {
        stageOneReviewProposal(tileset, refreshed.id);
        session.turns = [
          ...session.turns,
          { role: "assistant", text: `확인했어요. ${refreshed.name}로 기록할게요.`, tone: "confirmation" },
        ];
      }
    } else {
      throw new JobSubmitError("not-ready", "분석 작업이 없습니다.");
    }
    session.activeProposalId = null;
    rerender();
  }
}

export function applyConfirmedTilesetAiKnowledge(tileset: TilesetDef): number {
  return applyStagedReviewProposals(tileset);
}

function orderedPending(state: TilesetAiReviewState): readonly TilesetAiReviewProposal[] {
  const buckets = aiReviewBuckets(state);
  return [...buckets.uncertain, ...buckets.low, ...buckets.high];
}

function conversationFor(tilesetId: string): ConversationSession {
  const existing = conversations.get(tilesetId);
  if (existing) return existing;
  const created: ConversationSession = { activeProposalId: null, turns: [] };
  conversations.set(tilesetId, created);
  return created;
}
