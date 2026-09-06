import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { persistTilesetKnowledge } from "@/editor/panels/tilesetKnowledgePersistence";
import type { TilesetAiReviewReady } from "@/editor/tilesetAiNativeReviewModel";
import { tilesetKnowledgeFingerprint } from "@/editor/tilesetAiNativeAnalysis";
import { store } from "@/project/store";
import { tileMetaLocked } from "@/project/tilesetPalette";
import { compileTilesetKnowledge, type CompiledTilesetKnowledge } from "@/project/tilesetKnowledge";
import type { TileGroupMetadata, TilesetDef } from "@/project/types";

type ApplyAiReviewInput = {
  readonly mode: "high" | "selected";
  readonly proposalIds?: readonly string[];
  readonly state: TilesetAiReviewReady;
  readonly tilesetId: string;
};

export type ApplyAiReviewResult =
  | { readonly kind: "applied"; readonly appliedIds: readonly string[]; readonly skippedIds: readonly string[] }
  | { readonly kind: "stale" };

export function applyAiReviewProposals(input: ApplyAiReviewInput): ApplyAiReviewResult {
  const current = store.getCurrent().tilesets[input.tilesetId];
  if (!current) return { kind: "stale" };
  const next = structuredClone(current);
  const result = materializeAiReviewProposals(next, input);
  if (result.kind === "stale" || result.appliedIds.length === 0) return result;
  recordProjectSnapshot("AI tileset knowledge review");
  store.update(project => { project.tilesets[input.tilesetId] = next; });
  return result;
}

/** Pure application of reviewed artifact facts onto a detached tileset. */
export function materializeAiReviewProposals(current: TilesetDef, input: ApplyAiReviewInput): ApplyAiReviewResult {
  if (!current || tilesetKnowledgeFingerprint(current) !== input.state.fingerprint) return { kind: "stale" };
  const selectedIds = new Set(input.proposalIds ?? []);
  const candidates = input.state.proposals
    .filter((proposal) => input.mode === "high"
      ? proposal.status === "pending" && proposal.confidence >= 0.85
      : proposal.status !== "skipped" && selectedIds.has(proposal.id))
    .sort((left, right) => right.confidence - left.confidence || left.id.localeCompare(right.id));
  const protectedTiles = humanProtectedTiles(current);
  const claimedTiles = new Set<number>();
  const compiled: { readonly compiled: CompiledTilesetKnowledge; readonly proposal: TilesetAiReviewReady["proposals"][number] }[] = [];
  for (const proposal of candidates) {
    if (proposal.tileIds.some((tile) => protectedTiles.has(tile) || claimedTiles.has(tile))) continue;
    const existingId = matchingGroupId(current, proposal.tileIds);
    const result = compileTilesetKnowledge({
      cellLayers: proposal.cellLayers ?? undefined,
      groupId: existingId ?? proposal.id,
      name: proposal.name,
      passage: proposal.passage,
      template: proposal.template,
      tileCount: current.count,
      tileIds: proposal.tileIds,
      tilesPerRow: current.tilesPerRow,
    });
    if (result.kind === "invalid") continue;
    compiled.push({ compiled: result.value, proposal });
    proposal.tileIds.forEach((tile) => claimedTiles.add(tile));
  }
  const appliedIds = compiled.map((entry) => entry.proposal.id);
  const appliedSet = new Set(appliedIds);
  const skippedIds = candidates.filter((proposal) => !appliedSet.has(proposal.id)).map((proposal) => proposal.id);
  if (compiled.length === 0) return { appliedIds, kind: "applied", skippedIds };
  for (const entry of compiled) {
      persistTilesetKnowledge(current, {
        compiled: entry.compiled,
        description: entry.proposal.description,
        placementRules: entry.proposal.placementRules,
        template: entry.proposal.template,
      });
  }
  return { appliedIds, kind: "applied", skippedIds };
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

function matchingGroupId(tileset: TilesetDef, tileIds: readonly number[]): string | null {
  const key = tileKey(tileIds);
  return tileset.tileGroups?.find((group) => !isHumanGroup(group) && tileKey(group.tileIds) === key)?.id ?? null;
}

function tileKey(tileIds: readonly number[]): string {
  return [...tileIds].sort((left, right) => left - right).join(",");
}

function isHumanGroup(group: TileGroupMetadata): boolean {
  return group.origin === "user" || group.source === "user";
}
