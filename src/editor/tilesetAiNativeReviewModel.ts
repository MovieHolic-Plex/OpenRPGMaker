import type { PassFlag } from "@/project/types";
import type { TilesetKnowledgeTemplate } from "@/project/tilesetKnowledge";

export type TilesetAiReviewProposalStatus = "accepted" | "pending" | "skipped";

export type TilesetAiReviewProposal = {
  readonly cellLayers: readonly ("lower" | "upper")[] | null;
  readonly confidence: number;
  readonly description: string;
  readonly evidence: string;
  readonly feedback: string;
  readonly id: string;
  readonly name: string;
  readonly passage: PassFlag;
  readonly placementRules: string;
  readonly question: string;
  readonly quickReplies: readonly string[];
  readonly status: TilesetAiReviewProposalStatus;
  readonly template: TilesetKnowledgeTemplate;
  readonly tileIds: readonly number[];
};
type ReviewSource = {
  readonly fingerprint: string;
  readonly tilesetId: string;
};
export type TilesetAiReviewIdle = ReviewSource & {
  readonly status: "idle";
};
export type TilesetAiReviewAnalyzing = ReviewSource & {
  readonly previousProposals: readonly TilesetAiReviewProposal[];
  readonly previousSummary: string;
  readonly requestId: string;
  readonly status: "analyzing";
};
export type TilesetAiReviewReady = ReviewSource & {
  readonly proposals: readonly TilesetAiReviewProposal[];
  readonly status: "partial" | "ready" | "stale";
  readonly summary: string;
  readonly warnings: readonly string[];
};
export type TilesetAiReviewFailure = ReviewSource & {
  readonly message: string;
  readonly previousProposals: readonly TilesetAiReviewProposal[];
  readonly previousSummary: string;
  readonly status: "error" | "offline";
};
export type TilesetAiReviewSaving = ReviewSource & {
  readonly proposals: readonly TilesetAiReviewProposal[];
  readonly status: "saving";
  readonly summary: string;
  readonly warnings: readonly string[];
};
export type TilesetAiReviewSaved = ReviewSource & {
  readonly message: string;
  readonly proposals: readonly TilesetAiReviewProposal[];
  readonly status: "saved";
  readonly summary: string;
  readonly warnings: readonly string[];
};

export type TilesetAiReviewState =
  | TilesetAiReviewAnalyzing
  | TilesetAiReviewFailure
  | TilesetAiReviewIdle
  | TilesetAiReviewReady
  | TilesetAiReviewSaved
  | TilesetAiReviewSaving;

export type TilesetAiReviewResult = {
  readonly fingerprint: string;
  readonly proposals: readonly TilesetAiReviewProposal[];
  readonly summary: string;
  readonly warnings: readonly string[];
};

export type TilesetAiReviewBuckets = {
  readonly high: readonly TilesetAiReviewProposal[];
  readonly low: readonly TilesetAiReviewProposal[];
  readonly uncertain: readonly TilesetAiReviewProposal[];
};

const HIGH_CONFIDENCE = 0.85;
const UNCERTAIN_CONFIDENCE = 0.5;

export function createAiReviewIdle(tilesetId: string, fingerprint: string): TilesetAiReviewIdle {
  return { fingerprint, status: "idle", tilesetId };
}

export function startAiReview(state: TilesetAiReviewState, requestId: string): TilesetAiReviewAnalyzing {
  return {
    fingerprint: state.fingerprint,
    previousProposals: proposalsOf(state),
    previousSummary: summaryOf(state),
    requestId,
    status: "analyzing",
    tilesetId: state.tilesetId,
  };
}

export function completeAiReview(
  state: TilesetAiReviewAnalyzing,
  result: TilesetAiReviewResult,
): TilesetAiReviewReady {
  return {
    fingerprint: result.fingerprint,
    proposals: result.proposals.map(copyProposal),
    status: result.warnings.length > 0 ? "partial" : "ready",
    summary: result.summary,
    tilesetId: state.tilesetId,
    warnings: [...result.warnings],
  };
}

export function failAiReview(state: TilesetAiReviewAnalyzing, message: string): TilesetAiReviewFailure {
  return failureState(state, message, "error");
}

export function markAiReviewOffline(state: TilesetAiReviewAnalyzing, message: string): TilesetAiReviewFailure {
  return failureState(state, message, "offline");
}

export function markAiReviewSaving(state: TilesetAiReviewReady): TilesetAiReviewSaving {
  return { ...state, status: "saving" };
}

export function markAiReviewSaved(
  state: TilesetAiReviewSaving,
  message: string,
  fingerprint = state.fingerprint,
): TilesetAiReviewSaved {
  return { ...state, fingerprint, message, status: "saved" };
}

export function markAiReviewStale(state: TilesetAiReviewReady): TilesetAiReviewReady {
  return { ...state, status: "stale" };
}

export function editAiReviewProposal(
  state: TilesetAiReviewReady,
  proposalId: string,
  patch: Partial<Pick<TilesetAiReviewProposal, "feedback" | "status">>,
): TilesetAiReviewReady {
  return {
    ...state,
    proposals: state.proposals.map((proposal) => proposal.id === proposalId ? { ...proposal, ...patch } : proposal),
  };
}

export function skipAiReviewProposal(state: TilesetAiReviewReady, proposalId: string): TilesetAiReviewReady {
  return editAiReviewProposal(state, proposalId, { status: "skipped" });
}

export function acceptAiReviewProposalIds(
  state: TilesetAiReviewReady,
  proposalIds: readonly string[],
): TilesetAiReviewReady {
  const accepted = new Set(proposalIds);
  return {
    ...state,
    proposals: state.proposals.map((proposal) => accepted.has(proposal.id)
      ? { ...proposal, status: "accepted" }
      : proposal),
  };
}

export function proposalsForAiReview(state: TilesetAiReviewState): readonly TilesetAiReviewProposal[] {
  return proposalsOf(state);
}

export function summaryForAiReview(state: TilesetAiReviewState): string {
  return summaryOf(state);
}

export function aiReviewBuckets(state: TilesetAiReviewState): TilesetAiReviewBuckets {
  const pending = proposalsOf(state).filter((proposal) => proposal.status === "pending").sort(compareProposal);
  return {
    high: pending.filter((proposal) => proposal.confidence >= HIGH_CONFIDENCE),
    low: pending.filter((proposal) => proposal.confidence < UNCERTAIN_CONFIDENCE),
    uncertain: pending.filter(
      (proposal) => proposal.confidence >= UNCERTAIN_CONFIDENCE && proposal.confidence < HIGH_CONFIDENCE,
    ),
  };
}

export function isAiReviewStale(state: TilesetAiReviewState, currentFingerprint: string): boolean {
  return state.fingerprint !== currentFingerprint;
}

function failureState(
  state: TilesetAiReviewAnalyzing,
  message: string,
  status: TilesetAiReviewFailure["status"],
): TilesetAiReviewFailure {
  return {
    fingerprint: state.fingerprint,
    message,
    previousProposals: state.previousProposals.map(copyProposal),
    previousSummary: state.previousSummary,
    status,
    tilesetId: state.tilesetId,
  };
}

function proposalsOf(state: TilesetAiReviewState): readonly TilesetAiReviewProposal[] {
  switch (state.status) {
    case "analyzing":
    case "error":
    case "offline":
      return state.previousProposals;
    case "partial":
    case "ready":
    case "saved":
    case "saving":
    case "stale":
      return state.proposals;
    case "idle":
      return [];
  }
}

function summaryOf(state: TilesetAiReviewState): string {
  switch (state.status) {
    case "analyzing":
    case "error":
    case "offline":
      return state.previousSummary;
    case "partial":
    case "ready":
    case "saved":
    case "saving":
    case "stale":
      return state.summary;
    case "idle":
      return "";
  }
}

function copyProposal(proposal: TilesetAiReviewProposal): TilesetAiReviewProposal {
  return {
    ...proposal,
    cellLayers: proposal.cellLayers ? [...proposal.cellLayers] : null,
    passage: { ...proposal.passage },
    quickReplies: [...proposal.quickReplies],
    tileIds: [...proposal.tileIds],
  };
}

function compareProposal(left: TilesetAiReviewProposal, right: TilesetAiReviewProposal): number {
  const confidence = right.confidence - left.confidence;
  if (confidence !== 0) return confidence;
  const firstTile = (left.tileIds[0] ?? 0) - (right.tileIds[0] ?? 0);
  return firstTile !== 0 ? firstTile : left.id.localeCompare(right.id);
}

export function findRefreshedAiReviewProposal(
  state: TilesetAiReviewState,
  previous: TilesetAiReviewProposal,
): TilesetAiReviewProposal | null {
  const key = tileKey(previous.tileIds);
  return proposalsForAiReview(state).find((proposal) => proposal.id === previous.id || tileKey(proposal.tileIds) === key) ?? null;
}

function tileKey(tileIds: readonly number[]): string {
  return tileIds.join(",");
}
