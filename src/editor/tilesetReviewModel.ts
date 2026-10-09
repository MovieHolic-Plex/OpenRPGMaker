import { tileMetaConfidence, tileMetaOrigin } from "@/project/tilesetPalette";
import type { TileAiMetadata, TilesetDef } from "@/project/types";

export interface TilesetReviewCandidate {
  readonly meta: TileAiMetadata;
  readonly tile: number;
}

export interface TilesetReviewItem {
  readonly candidate?: TilesetReviewCandidate;
  readonly confidence: number;
  readonly meta: TileAiMetadata;
  readonly origin: "ai" | "user";
  readonly tile: number;
}

export interface TilesetReviewState {
  readonly queue: readonly TilesetReviewItem[];
  readonly skipped: readonly number[];
}

type QueueAction = "confirm" | "skip";

export function reviewConfidence(meta: TileAiMetadata | undefined): number {
  return tileMetaConfidence(meta) ?? 0;
}

export function buildTilesetReviewQueue(
  tileset: TilesetDef,
  candidates: readonly TilesetReviewCandidate[] = []
): readonly TilesetReviewItem[] {
  const candidateByTile = new Map(candidates.map((candidate) => [candidate.tile, candidate]));
  const tileIds = candidateByTile.size > 0
    ? [...candidateByTile.keys()]
    : (tileset.tileMeta ?? []).map((_meta, tile) => tile).filter((tile) => tileset.tileMeta?.[tile] !== undefined);
  return tileIds
    .filter((tile) => tile >= 0 && tile < tileset.count)
    .map((tile) => {
      const candidate = candidateByTile.get(tile);
      const meta = candidate?.meta ?? tileset.tileMeta?.[tile];
      if (!meta) return null;
      const confidence = reviewConfidence(meta);
      if (confidence >= 1) return null;
      return {
        ...(candidate ? { candidate } : {}),
        confidence,
        meta,
        origin: tileMetaOrigin(meta) ?? "ai",
        tile,
      } satisfies TilesetReviewItem;
    })
    .filter((item): item is TilesetReviewItem => item !== null)
    .sort((a, b) => a.confidence - b.confidence || a.tile - b.tile);
}

export function lowConfidenceReviewCount(queue: readonly TilesetReviewItem[], threshold = 0.5): number {
  return queue.filter((item) => item.confidence < threshold).length;
}

export function transitionTilesetReviewQueue(
  state: TilesetReviewState,
  action: QueueAction,
  tile: number
): TilesetReviewState {
  return {
    queue: state.queue.filter((item) => item.tile !== tile),
    skipped: action === "skip" ? [...state.skipped, tile] : state.skipped,
  };
}
