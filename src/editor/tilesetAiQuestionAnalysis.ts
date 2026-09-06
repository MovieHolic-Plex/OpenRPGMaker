import { analyzeTilesetKnowledge } from "./tilesetAiNativeAnalysis";
import { acceptAiReviewProposalIds, completeAiReview, createAiReviewIdle, editAiReviewProposal, findRefreshedAiReviewProposal, startAiReview, type TilesetAiReviewReady } from "./tilesetAiNativeReviewModel";
import type { TilesetAiConversationTurn } from "./tilesetAiConversationSession";
import type { CpenTilesetRequest } from "./tilesetAiRequest";
import type { TilesetDef } from "@/project/types";
import { assert } from "@/project/io/guards";

/** Native review orchestration over captured values, not singleton sessions or apply. */
export async function analyzeCapturedTilesetReview(tileset: TilesetDef, options: {
  requestId: string;
  previous?: TilesetAiReviewReady;
  feedback: readonly string[];
  imageDataUrl: string;
  request: (request: CpenTilesetRequest) => Promise<string>;
  question?: { proposalId: string; answer: string; turns: readonly TilesetAiConversationTurn[] };
}): Promise<{ review: TilesetAiReviewReady; turns: readonly TilesetAiConversationTurn[] }> {
  let previous = options.previous;
  const question = options.question;
  const active = question ? previous?.proposals.find(p => p.id === question.proposalId && p.status === "pending") : undefined;
  if (question) {
    assert(previous !== undefined && active !== undefined, "Pending review question not found");
    previous = editAiReviewProposal(previous, active.id, { feedback: question.answer.trim() });
  }
  const feedback = [...options.feedback, ...(previous?.proposals ?? []).filter(p => p.feedback.trim()).map(p => `${p.name}: ${p.feedback.trim()}`)];
  const result = await analyzeTilesetKnowledge(tileset, { feedback, renderImage: async () => options.imageDataUrl, request: options.request });
  if (result.kind !== "success") throw new Error(`TILESET_ANALYSIS_INVALID: ${result.message}`);
  let review = completeAiReview(startAiReview(previous ?? createAiReviewIdle(tileset.id, result.review.fingerprint), options.requestId), result.review);
  // Keep human choices and stable IDs across a refreshed analysis. Unreturned accepted/skipped
  // proposals remain visible, rather than being silently erased by the model's new subset.
  const matched = new Set<string>();
  review = { ...review, proposals: review.proposals.map(p => {
    const old = previous ? findRefreshedAiReviewProposal(previous, p) : null;
    if (old) { matched.add(old.id); return { ...p, id: old.id, status: old.status, feedback: old.feedback }; }
    return { ...p, status: p.confidence >= 0.85 ? "accepted" : p.status };
  }).concat((previous?.proposals ?? []).filter(p => !matched.has(p.id) && p.status !== "pending")) };
  let turns: readonly TilesetAiConversationTurn[] = question ? [...question.turns,
    { role: "assistant", text: active!.question, tone: "question" },
    { role: "user", text: question.answer.trim(), tone: "answer" }] : [];
  if (active) {
    const refreshed = findRefreshedAiReviewProposal(review, active);
    if (refreshed) {
      review = acceptAiReviewProposalIds(review, [refreshed.id]);
      turns = [...turns, { role: "assistant", text: `확인했어요. ${refreshed.name}로 기록할게요.`, tone: "confirmation" }];
    }
  }
  return { review, turns };
}
