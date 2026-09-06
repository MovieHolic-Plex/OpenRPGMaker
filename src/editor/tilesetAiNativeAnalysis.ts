import type { CpenTilesetRequest } from "@/editor/tilesetAiRequest";
import type { TilesetAiReviewProposal, TilesetAiReviewResult } from "@/editor/tilesetAiNativeReviewModel";
import { tileMetaLocked } from "@/project/tilesetPalette";
import { blockedFlag, passableFlag } from "@/project/tilesetPassage";
import { compileTilesetKnowledge, type TilesetKnowledgeTemplate } from "@/project/tilesetKnowledge";
import type { PassFlag, TilesetDef } from "@/project/types";

type AnalysisOptions = {
  readonly feedback?: readonly string[];
  readonly renderImage: (tileset: TilesetDef) => Promise<string>;
  readonly request: (request: CpenTilesetRequest) => Promise<string>;
};

export type TilesetAiKnowledgeAnalysis =
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "success"; readonly rawAnswer: string; readonly review: TilesetAiReviewResult };

export async function analyzeTilesetKnowledge(
  tileset: TilesetDef,
  options: AnalysisOptions,
): Promise<TilesetAiKnowledgeAnalysis> {
  const fingerprint = tilesetKnowledgeFingerprint(tileset);
  const imageDataUrl = await options.renderImage(tileset);
  const prompt = buildTilesetKnowledgePrompt(tileset, options.feedback ?? []);
  const rawAnswer = await options.request({ imageDataUrl, prompt });
  const parsed = parseTilesetKnowledgeAnswer(rawAnswer, tileset, fingerprint);
  return parsed
    ? { kind: "success", rawAnswer, review: parsed }
    : { kind: "error", message: rawAnswer.trim() || "AI returned an empty tileset analysis." };
}

export function tilesetKnowledgeFingerprint(tileset: TilesetDef): string {
  return JSON.stringify({
    count: tileset.count,
    id: tileset.id,
    image: tileset.image,
    passability: tileset.passability,
    priority: tileset.priority,
    tileSize: tileset.tileSize,
    tileGroups: tileset.tileGroups,
    tileMeta: tileset.tileMeta,
    tilesPerRow: tileset.tilesPerRow,
  });
}

function buildTilesetKnowledgePrompt(tileset: TilesetDef, feedback: readonly string[]): string {
  return JSON.stringify({
    humanFeedback: feedback,
    lockedTileIds: (tileset.tileMeta ?? []).flatMap((meta, tile) => tileMetaLocked(meta) ? [tile] : []),
    outputSchemaVersion: 1,
    conversationMode: "ask_when_uncertain",
    tileIdOrder: "strictly_ascending",
    protectedGroups: (tileset.tileGroups ?? [])
      .filter(isHumanGroup)
      .map((group) => ({ id: group.id, name: group.name, tileIds: group.tileIds })),
    task: "analyze_tileset_knowledge",
    tileset: {
      count: tileset.count,
      tileSize: tileset.tileSize,
      tilesPerRow: tileset.tilesPerRow,
    },
    validTemplates: [
      "desk",
      "one-way-path",
      "repeatable-cliff-2x3",
      "tree",
      "water-atlas-9x9",
      "water-autotile-3x3",
    ],
  });
}

function parseTilesetKnowledgeAnswer(
  answer: string,
  tileset: TilesetDef,
  fingerprint: string,
): TilesetAiReviewResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(answer);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const rawProposals = parsed["proposals"];
  if (!Array.isArray(rawProposals)) return null;
  const protectedTiles = humanProtectedTiles(tileset);
  const warnings: string[] = [];
  const proposals = rawProposals.flatMap((value, index) => {
    const proposal = parseProposal(value, index, tileset);
    if (!proposal) {
      warnings.push(`Proposal ${index + 1} was ignored because its shape was invalid.`);
      return [];
    }
    if (proposal.tileIds.some((tile) => protectedTiles.has(tile))) {
      warnings.push(`Proposal ${index + 1} overlaps human-confirmed knowledge and was ignored.`);
      return [];
    }
    return [proposal];
  });
  return {
    fingerprint,
    proposals,
    summary: readString(parsed["summary"]) || `${proposals.length} AI proposals`,
    warnings,
  };
}

function parseProposal(value: unknown, index: number, tileset: TilesetDef): TilesetAiReviewProposal | null {
  if (!isRecord(value)) return null;
  const template = readTemplate(value["template"]);
  const tileIds = readTileIds(value["tileIds"], tileset.count);
  if (!template || !tileIds || tileIds.length === 0) return null;
  const passage = readPassage(value["passage"], template);
  const name = readString(value["name"]) || `AI proposal ${index + 1}`;
  const compiled = compileTilesetKnowledge({
    cellLayers: readCellLayers(value["cellLayers"], tileIds.length) ?? undefined,
    groupId: proposalId(template, tileIds, index),
    name,
    passage,
    template,
    tileCount: tileset.count,
    tileIds,
    tilesPerRow: tileset.tilesPerRow,
  });
  if (compiled.kind === "invalid") return null;
  return {
    cellLayers: readCellLayers(value["cellLayers"], tileIds.length),
    confidence: readConfidence(value["confidence"]),
    description: readString(value["description"]),
    evidence: readString(value["evidence"]) || `${tileIds.length} connected tiles`,
    feedback: "",
    id: proposalId(template, tileIds, index),
    name,
    passage,
    placementRules: readString(value["placementRules"]),
    question: readString(value["question"]) || fallbackQuestion(template, name),
    quickReplies: readQuickReplies(value["quickReplies"], template),
    status: "pending",
    template,
    tileIds,
  };
}

function humanProtectedTiles(tileset: TilesetDef): ReadonlySet<number> {
  const protectedTiles = new Set<number>();
  for (const [tile, meta] of (tileset.tileMeta ?? []).entries()) {
    if (tileMetaLocked(meta)) protectedTiles.add(tile);
  }
  for (const group of tileset.tileGroups ?? []) {
    if (isHumanGroup(group)) group.tileIds.forEach((tile) => protectedTiles.add(tile));
  }
  return protectedTiles;
}

function isHumanGroup(group: NonNullable<TilesetDef["tileGroups"]>[number]): boolean {
  return group.origin === "user" || group.source === "user";
}

function readTemplate(value: unknown): TilesetKnowledgeTemplate | null {
  if (
    value === "desk" || value === "one-way-path" || value === "repeatable-cliff-2x3"
    || value === "tree" || value === "water-atlas-9x9" || value === "water-autotile-3x3"
  ) return value;
  return null;
}

function readTileIds(value: unknown, tileCount: number): readonly number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const tileIds: number[] = [];
  const seen = new Set<number>();
  for (const tile of value) {
    if (typeof tile !== "number" || !Number.isInteger(tile) || tile < 0 || tile >= tileCount || seen.has(tile)) return null;
    if (tileIds.length > 0 && tile <= (tileIds[tileIds.length - 1] ?? -1)) return null;
    seen.add(tile);
    tileIds.push(tile);
  }
  return tileIds;
}

function readCellLayers(value: unknown, length: number): readonly ("lower" | "upper")[] | null {
  if (!Array.isArray(value) || value.length !== length) return null;
  if (!value.every((layer) => layer === "lower" || layer === "upper")) return null;
  return value;
}

function readPassage(value: unknown, template: TilesetKnowledgeTemplate): PassFlag {
  const fallback = template === "one-way-path" ? passableFlag() : blockedFlag();
  if (!isRecord(value)) return fallback;
  return {
    down: readBoolean(value["down"], fallback.down),
    left: readBoolean(value["left"], fallback.left),
    right: readBoolean(value["right"], fallback.right),
    up: readBoolean(value["up"], fallback.up),
  };
}

function readConfidence(value: unknown): number {
  if (value === "high") return 0.9;
  if (value === "medium") return 0.65;
  if (value === "low") return 0.3;
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
}

function readQuickReplies(value: unknown, template: TilesetKnowledgeTemplate): readonly string[] {
  if (Array.isArray(value)) {
    const replies = value
      .filter((reply): reply is string => typeof reply === "string")
      .map((reply) => reply.trim().slice(0, 60))
      .filter(Boolean)
      .slice(0, 3);
    if (replies.length > 0) return replies;
  }
  return FALLBACK_REPLIES[template];
}

function fallbackQuestion(template: TilesetKnowledgeTemplate, name: string): string {
  return `${name} 영역을 ${FALLBACK_QUESTION_SUFFIX[template]}`;
}

const FALLBACK_QUESTION_SUFFIX = {
  desk: "하나의 가구로 묶으면 될까요?",
  "one-way-path": "어느 방향으로 통행할 수 있나요?",
  "repeatable-cliff-2x3": "가로와 세로 중 어느 방향으로 반복하나요?",
  tree: "윗부분은 상위 레이어인가요?",
  "water-atlas-9x9": "9×9 물 아틀라스로 사용하나요?",
  "water-autotile-3x3": "3×3 물 오토타일로 사용하나요?",
} as const satisfies Record<TilesetKnowledgeTemplate, string>;

const FALLBACK_REPLIES = {
  desk: ["맞아", "아니야", "직접 설명"],
  "one-way-path": ["위로만", "아래로만", "직접 설명"],
  "repeatable-cliff-2x3": ["가로로만 반복", "가로·세로 모두 반복", "반복 안 함"],
  tree: ["맞아", "아니야", "직접 설명"],
  "water-atlas-9x9": ["맞아", "아니야", "직접 설명"],
  "water-autotile-3x3": ["맞아", "아니야", "직접 설명"],
} as const satisfies Record<TilesetKnowledgeTemplate, readonly string[]>;

function proposalId(template: TilesetKnowledgeTemplate, tileIds: readonly number[], index: number): string {
  return `ai-review-${template}-${tileIds[0] ?? 0}-${tileIds.length}-${index + 1}`;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
