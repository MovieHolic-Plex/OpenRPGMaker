import { hasTilesetAiAccess } from "@/editor/panels/tilesetAiClient";
import { loadKnowledgeProposal } from "@/editor/panels/tilesetKnowledgeWorkspaceState";
import { applyAiReviewProposals } from "@/editor/tilesetAiNativeReviewApply";
import { analyzeTilesetKnowledge, tilesetKnowledgeFingerprint, type TilesetAiKnowledgeAnalysis } from "@/editor/tilesetAiNativeAnalysis";
import {
  acceptAiReviewProposalIds,
  completeAiReview,
  createAiReviewIdle,
  editAiReviewProposal,
  failAiReview,
  markAiReviewOffline,
  markAiReviewSaved,
  markAiReviewSaving,
  markAiReviewStale,
  proposalsForAiReview,
  skipAiReviewProposal,
  startAiReview,
  type TilesetAiReviewReady,
  type TilesetAiReviewState,
} from "@/editor/tilesetAiNativeReviewModel";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";

export type TilesetAiReviewAnalyzer = (
  tileset: TilesetDef,
  feedback: readonly string[],
) => Promise<TilesetAiKnowledgeAnalysis>;

type ReviewSession = {
  manualOpen: boolean;
  manualProposalId: string | null;
  state: TilesetAiReviewState;
};

const sessions = new Map<string, ReviewSession>();
let analyzer: TilesetAiReviewAnalyzer | null = null;
let requestSequence = 0;

export function setTilesetAiReviewAnalyzer(next: TilesetAiReviewAnalyzer | null): void {
  analyzer = next;
}

export function resetTilesetAiReviewSessions(): void {
  sessions.clear();
  requestSequence = 0;
}

export function activateTilesetAiReview(tileset: TilesetDef): TilesetAiReviewState {
  const fingerprint = tilesetKnowledgeFingerprint(tileset);
  const existing = sessions.get(tileset.id);
  if (!existing) {
    const state = createAiReviewIdle(tileset.id, fingerprint);
    sessions.set(tileset.id, { manualOpen: false, manualProposalId: null, state });
    return state;
  }
  if (existing.state.fingerprint === fingerprint || existing.state.status === "analyzing") return existing.state;
  const ready = asReady(existing.state);
  existing.state = ready ? markAiReviewStale(ready) : createAiReviewIdle(tileset.id, fingerprint);
  return existing.state;
}

export async function runTilesetAiReview(tileset: TilesetDef, rerender: () => void): Promise<void> {
  const session = sessionFor(tileset);
  const requestId = `tileset-review-${requestSequence += 1}`;
  session.state = startAiReview(session.state, requestId);
  rerender();
  if (!analyzer && !hasTilesetAiAccess()) {
    session.state = markAiReviewOffline(session.state, "AI 연결이 필요합니다. 설정 후 다시 분석할 수 있습니다.");
    rerender();
    return;
  }
  const feedback = proposalsForAiReview(session.state)
    .filter((proposal) => proposal.feedback.trim())
    .map((proposal) => `${proposal.name}: ${proposal.feedback.trim()}`);
  try {
    const result = await (analyzer ?? defaultAnalyzer)(tileset, feedback);
    if (session.state.status !== "analyzing" || session.state.requestId !== requestId) return;
    session.state = result.kind === "success"
      ? stageHighConfidence(completeAiReview(session.state, result.review))
      : failAiReview(session.state, result.message);
  } catch (error) {
    if (session.state.status !== "analyzing" || session.state.requestId !== requestId) return;
    session.state = failAiReview(session.state, error instanceof Error ? error.message : "AI 분석에 실패했습니다.");
  }
  rerender();
}

export function acceptHighConfidenceReview(tileset: TilesetDef): number {
  return acceptReview(tileset, "high", []);
}

export function acceptOneReviewProposal(tileset: TilesetDef, proposalId: string): number {
  return acceptReview(tileset, "selected", [proposalId]);
}

export function tilesetAiReviewState(tileset: TilesetDef): TilesetAiReviewState {
  return activateTilesetAiReview(tileset);
}

export function stageOneReviewProposal(tileset: TilesetDef, proposalId: string): void {
  const session = sessionFor(tileset);
  const ready = asReady(session.state);
  if (ready) session.state = acceptAiReviewProposalIds(ready, [proposalId]);
}

export function applyStagedReviewProposals(tileset: TilesetDef): number {
  const state = tilesetAiReviewState(tileset);
  const proposalIds = proposalsForAiReview(state)
    .filter((proposal) => proposal.status === "accepted")
    .map((proposal) => proposal.id);
  return acceptReview(tileset, "selected", proposalIds);
}

export function skipOneReviewProposal(tileset: TilesetDef, proposalId: string): void {
  const session = sessionFor(tileset);
  const ready = asReady(session.state);
  if (ready) session.state = skipAiReviewProposal(ready, proposalId);
}

export function updateReviewProposalFeedback(tileset: TilesetDef, proposalId: string, feedback: string): void {
  const session = sessionFor(tileset);
  const ready = asReady(session.state);
  if (ready) session.state = editAiReviewProposal(ready, proposalId, { feedback });
}

export function openReviewProposalCorrection(tileset: TilesetDef, proposalId: string): void {
  const session = sessionFor(tileset);
  const proposal = proposalsForAiReview(session.state).find((candidate) => candidate.id === proposalId);
  if (!proposal) return;
  loadKnowledgeProposal(proposal);
  session.manualOpen = true;
  session.manualProposalId = proposalId;
}

export function openTilesetManualCorrection(tileset: TilesetDef): void {
  const session = sessionFor(tileset);
  session.manualOpen = true;
  session.manualProposalId = null;
}

export function closeTilesetManualCorrection(tilesetId: string): void {
  const session = sessions.get(tilesetId);
  if (!session) return;
  session.manualOpen = false;
  session.manualProposalId = null;
}

export function finishTilesetManualCorrection(tileset: TilesetDef): void {
  const session = sessions.get(tileset.id);
  if (!session) return;
  const ready = asReady(session.state);
  if (ready && session.manualProposalId) {
    const accepted = acceptAiReviewProposalIds(ready, [session.manualProposalId]);
    const current = store.getCurrent().tilesets[tileset.id];
    session.state = { ...accepted, fingerprint: current ? tilesetKnowledgeFingerprint(current) : ready.fingerprint };
  }
  session.manualOpen = false;
  session.manualProposalId = null;
}

export function isTilesetManualCorrectionOpen(tilesetId: string): boolean {
  return sessions.get(tilesetId)?.manualOpen ?? false;
}

function acceptReview(tileset: TilesetDef, mode: "high" | "selected", proposalIds: readonly string[]): number {
  const session = sessionFor(tileset);
  const ready = asReady(session.state);
  if (!ready || ready.status === "stale") return 0;
  session.state = markAiReviewSaving(ready);
  const result = applyAiReviewProposals({ mode, proposalIds, state: ready, tilesetId: tileset.id });
  if (result.kind === "stale") {
    session.state = markAiReviewStale(ready);
    return 0;
  }
  const accepted = acceptAiReviewProposalIds(ready, result.appliedIds);
  const saving = markAiReviewSaving(accepted);
  const current = store.getCurrent().tilesets[tileset.id];
  const fingerprint = current ? tilesetKnowledgeFingerprint(current) : ready.fingerprint;
  session.state = markAiReviewSaved(saving, `${result.appliedIds.length}개 제안을 적용했습니다.`, fingerprint);
  return result.appliedIds.length;
}

function sessionFor(tileset: TilesetDef): ReviewSession {
  activateTilesetAiReview(tileset);
  const session = sessions.get(tileset.id);
  if (!session) throw new Error("tileset AI review session was not initialized");
  return session;
}

function asReady(state: TilesetAiReviewState): TilesetAiReviewReady | null {
  switch (state.status) {
    case "partial":
    case "ready":
    case "stale":
      return state;
    case "saved":
    case "saving":
      return { ...state, status: "ready" };
    case "analyzing":
    case "error":
    case "idle":
    case "offline":
      return null;
  }
}

function stageHighConfidence(state: TilesetAiReviewReady): TilesetAiReviewReady {
  const ids = state.proposals
    .filter((proposal) => proposal.confidence >= 0.85)
    .map((proposal) => proposal.id);
  return acceptAiReviewProposalIds(state, ids);
}

function defaultAnalyzer(tileset: TilesetDef, feedback: readonly string[]): Promise<TilesetAiKnowledgeAnalysis> {
  return analyzeTilesetKnowledge(tileset, { feedback });
}
