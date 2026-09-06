import { assert, requireArray, requireBoolean, requireNumber, requireRecord, requireString } from "@/project/io/guards";
import { enumValue, parseAssistantPayload, type AssistantJobPayload } from "./assistantPayload";
import type { BlobRef } from "./contracts";
import type { AiSetupChoice } from "@/editor/panels/tilesetAiSetupMapping";
import type { TilesetAiReviewReady, TilesetAiReviewProposal } from "@/editor/tilesetAiNativeReviewModel";
import type { TilesetAiConversationTurn } from "@/editor/tilesetAiConversationSession";

export const TILESET_JOB_OPERATIONS = ["cluster-edit", "range-classify", "unclassified-analysis", "knowledge-analysis", "proposal-draft", "question-followup", "structure-kit-metadata"] as const;
export type TilesetJobOperation = typeof TILESET_JOB_OPERATIONS[number];
type Base = Pick<AssistantJobPayload, "config" | "context"> & { tilesetId: string; sourceJobId?: string };
type Cluster = { instruction?: string; priorTranscript?: string };
export type TilesetJobPayload = Base & (
  | (Cluster & { operation: "cluster-edit"; groupId: string })
  | (Cluster & { operation: "range-classify"; rect: { x: number; y: number; w: number; h: number }; tileIds: readonly number[] })
  | (Cluster & { operation: "unclassified-analysis"; sampleTiles: readonly number[]; total: number })
  | { operation: "knowledge-analysis"; atlas: BlobRef; feedback: readonly string[]; review?: TilesetAiReviewReady }
  | { operation: "proposal-draft"; selectedTiles: readonly number[]; setupChoice: AiSetupChoice; snapshot: { image: BlobRef; summary: string }; lockedAnswer: string }
  | { operation: "question-followup"; atlas: BlobRef; review: TilesetAiReviewReady; proposalId: string; answer: string; turns: readonly TilesetAiConversationTurn[] }
  | { operation: "structure-kit-metadata"; kitId: string }
);
export type ClusterTilesetPayload = Extract<TilesetJobPayload, { operation: "cluster-edit" | "range-classify" | "unclassified-analysis" }>;
export const text = (value: unknown): string => requireString("text", value);
export const strings = (value: unknown): string[] => requireArray("strings", value).map(text);
export function integer(value: unknown, min = 0): number {
  const n = requireNumber("integer", value); assert(Number.isSafeInteger(n) && n >= min, "Invalid integer"); return n;
}
export function tileIds(value: unknown): number[] {
  const ids = requireArray("tile IDs", value).map(v => integer(v));
  assert(ids.length > 0 && new Set(ids).size === ids.length, "Tile IDs must be nonempty and unique"); return ids;
}
export function tilesetBlobRef(value: unknown, image = false): BlobRef {
  const r = requireRecord("artifact reference", value);
  const sha256 = text(r.sha256), byteLength = integer(r.byteLength), mediaType = text(r.mediaType);
  assert(/^[a-f0-9]{64}$/.test(sha256), "Invalid artifact hash");
  assert(image ? ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mediaType) : mediaType === "application/json", "Invalid artifact media type");
  return { sha256, byteLength, mediaType };
}
export function parseTilesetReview(value: unknown): TilesetAiReviewReady {
  const r = requireRecord("review", value);
  const proposals = requireArray("proposals", r.proposals).map((value): TilesetAiReviewProposal => {
    const p = requireRecord("proposal", value), passage = requireRecord("passage", p.passage);
    const ids = tileIds(p.tileIds), confidence = requireNumber("confidence", p.confidence);
    assert(confidence >= 0 && confidence <= 1, "Invalid confidence");
    const cellLayers = p.cellLayers === null ? null : requireArray("cellLayers", p.cellLayers).map(v => enumValue(v, ["lower", "upper"]));
    assert(cellLayers === null || cellLayers.length === ids.length, "Invalid cell layers");
    return { id: text(p.id), name: text(p.name), tileIds: ids, confidence, cellLayers,
      template: enumValue(p.template, ["desk", "one-way-path", "repeatable-cliff-2x3", "tree", "water-atlas-9x9", "water-autotile-3x3"]),
      status: enumValue(p.status, ["accepted", "pending", "skipped"]), feedback: text(p.feedback), description: text(p.description), evidence: text(p.evidence),
      question: text(p.question), quickReplies: strings(p.quickReplies), placementRules: text(p.placementRules),
      passage: { down: requireBoolean("down", passage.down), up: requireBoolean("up", passage.up), left: requireBoolean("left", passage.left), right: requireBoolean("right", passage.right) } };
  });
  assert(new Set(proposals.map(p => p.id)).size === proposals.length, "Duplicate review IDs");
  return { tilesetId: text(r.tilesetId), fingerprint: text(r.fingerprint), status: enumValue(r.status, ["ready", "partial", "stale"]), summary: text(r.summary), warnings: strings(r.warnings), proposals };
}
export function parseTilesetPayload(value: unknown): TilesetJobPayload {
  const p = requireRecord("tileset payload", value);
  const operation = enumValue(p.operation, TILESET_JOB_OPERATIONS);
  const settings = parseAssistantPayload({ instruction: "Tileset job", domain: "tile", config: p.config, context: p.context });
  const base = { config: settings.config, context: settings.context, tilesetId: text(p.tilesetId), sourceJobId: p.sourceJobId === undefined ? undefined : text(p.sourceJobId) };
  const cluster = () => ({ instruction: p.instruction === undefined ? undefined : text(p.instruction), priorTranscript: p.priorTranscript === undefined ? undefined : text(p.priorTranscript) });
  switch (operation) {
    case "cluster-edit": return { ...base, ...cluster(), operation, groupId: text(p.groupId) };
    case "range-classify": {
      const r = requireRecord("range", p.rect);
      return { ...base, ...cluster(), operation, rect: { x: integer(r.x), y: integer(r.y), w: integer(r.w, 1), h: integer(r.h, 1) }, tileIds: tileIds(p.tileIds) };
    }
    case "unclassified-analysis": return { ...base, ...cluster(), operation, sampleTiles: tileIds(p.sampleTiles), total: integer(p.total, 1) };
    case "knowledge-analysis": return { ...base, operation, atlas: tilesetBlobRef(p.atlas, true), feedback: strings(p.feedback), review: p.review === undefined ? undefined : parseTilesetReview(p.review) };
    case "question-followup": {
      const answer = text(p.answer); assert(answer.trim().length > 0, "Question answer required");
      return { ...base, operation, atlas: tilesetBlobRef(p.atlas, true), review: parseTilesetReview(p.review), proposalId: text(p.proposalId), answer,
        turns: requireArray("turns", p.turns).map(value => { const t = requireRecord("turn", value); return { role: enumValue(t.role, ["assistant", "user"]), tone: enumValue(t.tone, ["answer", "question", "confirmation"]), text: text(t.text) }; }) };
    }
    case "proposal-draft": {
      const s = requireRecord("snapshot", p.snapshot), c = requireRecord("setupChoice", p.setupChoice);
      return { ...base, operation, selectedTiles: tileIds(p.selectedTiles), lockedAnswer: text(p.lockedAnswer), snapshot: { image: tilesetBlobRef(s.image, true), summary: text(s.summary) }, setupChoice: {
        intent: enumValue(c.intent, ["autoTerrain", "buildingHouse", "linearPath", "objectDetail", "pathAutotile", "unsure", "wallCliff", "waterAutotile"]),
        repeatability: enumValue(c.repeatability, ["allRepeat", "auto", "centerOnly", "edgesAndCenter", "noRepeat"]),
        scope: enumValue(c.scope, ["labels", "preview", "rules", "terrainTags"]), structure: enumValue(c.structure, ["animation", "horizontal", "mixed", "nineSlice", "single", "threeByThree", "vertical"]),
      } };
    }
    case "structure-kit-metadata": return { ...base, operation, kitId: text(p.kitId) };
  }
}
