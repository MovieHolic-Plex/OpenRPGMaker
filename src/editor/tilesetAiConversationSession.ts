import {
  applyStagedReviewProposals,
  runTilesetAiReview,
  skipOneReviewProposal,
  stageOneReviewProposal,
  tilesetAiReviewState,
  updateReviewProposalFeedback,
} from "@/editor/tilesetAiNativeReviewSession";
import {
  aiReviewBuckets,
  proposalsForAiReview,
  type TilesetAiReviewProposal,
  type TilesetAiReviewState,
} from "@/editor/tilesetAiNativeReviewModel";
import type { TilesetDef } from "@/project/types";

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
  await runTilesetAiReview(tileset, rerender);
  const refreshed = findRefreshedProposal(tilesetAiReviewState(tileset), previous);
  if (refreshed) {
    stageOneReviewProposal(tileset, refreshed.id);
    session.turns = [
      ...session.turns,
      { role: "assistant", text: `확인했어요. ${refreshed.name}로 기록할게요.`, tone: "confirmation" },
    ];
  }
  session.activeProposalId = null;
  rerender();
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

function findRefreshedProposal(
  state: TilesetAiReviewState,
  previous: TilesetAiReviewProposal,
): TilesetAiReviewProposal | null {
  const key = tileKey(previous.tileIds);
  return proposalsForAiReview(state).find((proposal) => proposal.id === previous.id || tileKey(proposal.tileIds) === key) ?? null;
}

function tileKey(tileIds: readonly number[]): string {
  return tileIds.join(",");
}
