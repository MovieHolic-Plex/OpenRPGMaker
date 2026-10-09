import { normalizeAiTileMetadata } from "@/editor/panels/tilesetAiMetadataNormalizer";
import type { TilesetReviewCandidate } from "@/editor/tilesetReviewModel";
import { confidenceScore, tileMetaConfidence, tileMetaLocked } from "@/project/tilesetPalette";
import { store } from "@/project/store";
import type { Project, TileAiMetadata, TilesetDef } from "@/project/types";

export interface TilesetVisionTile {
  readonly confidence?: number | "high" | "low" | "medium";
  readonly description?: string;
  readonly label?: string;
  readonly passage?: "passable" | "solid" | "star" | boolean;
  readonly role?: string;
  readonly tags?: readonly string[];
  readonly tile: number;
}

export interface TilesetVisionRequest {
  readonly tileIds: readonly number[];
  readonly tileset: TilesetDef;
}

export interface TilesetVisionResponse {
  readonly tiles?: readonly TilesetVisionTile[];
}

export interface TilesetVisionClient {
  classifyTiles(request: TilesetVisionRequest): Promise<TilesetVisionResponse | readonly TilesetVisionTile[] | string>
    | TilesetVisionResponse
    | readonly TilesetVisionTile[]
    | string;
}

export interface ReauditTilesetOptions {
  readonly confidenceThreshold?: number;
  readonly mode?: "all" | "lowConfidence";
  readonly project?: Project;
  readonly tileIds?: readonly number[];
}

export interface ReauditTilesetResult {
  readonly candidates: readonly TilesetReviewCandidate[];
  readonly preservedLockedCount: number;
  readonly requestedTileIds: readonly number[];
  readonly summary: string;
  readonly tilesetId: string;
  readonly warnings: readonly string[];
}

export async function reauditTileset(
  tilesetId: string,
  visionClient: TilesetVisionClient,
  opts: ReauditTilesetOptions = {}
): Promise<ReauditTilesetResult> {
  const project = opts.project ?? store.getCurrent();
  const tileset = project.tilesets[tilesetId];
  if (!tileset) {
    return {
      candidates: [],
      preservedLockedCount: 0,
      requestedTileIds: [],
      summary: `타일셋을 찾을 수 없습니다: ${tilesetId}`,
      tilesetId,
      warnings: [],
    };
  }
  const targets = targetTiles(tileset, opts);
  const lockedTiles = targets.filter((tile) => tileMetaLocked(tileset.tileMeta?.[tile]));
  const requestedTileIds = targets.filter((tile) => !tileMetaLocked(tileset.tileMeta?.[tile]));
  const response = requestedTileIds.length > 0
    ? await visionClient.classifyTiles({ tileIds: requestedTileIds, tileset })
    : { tiles: [] };
  const candidates = normalizeVisionResponse(response, tileset)
    .filter((candidate) => requestedTileIds.includes(candidate.tile))
    .filter((candidate) => !tileMetaLocked(tileset.tileMeta?.[candidate.tile]));
  const warnings = lockedTiles.length > 0 ? [`잠긴 항목 ${lockedTiles.length}개 보존됨`] : [];
  return {
    candidates,
    preservedLockedCount: lockedTiles.length,
    requestedTileIds,
    summary: `AI 재감사 후보 ${candidates.length}칸${lockedTiles.length > 0 ? ` · 잠긴 항목 ${lockedTiles.length}개 보존됨` : ""}`,
    tilesetId,
    warnings,
  };
}

function targetTiles(tileset: TilesetDef, opts: ReauditTilesetOptions): number[] {
  const base = opts.tileIds
    ? [...opts.tileIds]
    : Array.from({ length: tileset.count }, (_unused, tile) => tile);
  const valid = base.filter((tile) => Number.isInteger(tile) && tile >= 0 && tile < tileset.count);
  if (opts.mode === "all") return [...new Set(valid)];
  const threshold = opts.confidenceThreshold ?? 1;
  return [...new Set(valid)].filter((tile) => (tileMetaConfidence(tileset.tileMeta?.[tile]) ?? 0.5) < threshold);
}

function normalizeVisionResponse(
  response: TilesetVisionResponse | readonly TilesetVisionTile[] | string,
  tileset: TilesetDef
): TilesetReviewCandidate[] {
  const parsed = parseVisionResponse(response);
  return parsed
    .map((tile) => visionTileToCandidate(tileset, tile))
    .filter((candidate): candidate is TilesetReviewCandidate => candidate !== null);
}

function parseVisionResponse(response: TilesetVisionResponse | readonly TilesetVisionTile[] | string): readonly TilesetVisionTile[] {
  if (typeof response === "string") return parseVisionJson(response);
  if (Array.isArray(response)) return response as readonly TilesetVisionTile[];
  return "tiles" in response ? response.tiles ?? [] : [];
}

function parseVisionJson(text: string): readonly TilesetVisionTile[] {
  try {
    const normalized = normalizeAiTileMetadata(text);
    const parsed: unknown = JSON.parse(normalized);
    if (Array.isArray(parsed)) return parsed.filter(isVisionTile);
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { tiles?: unknown }).tiles)) {
      return (parsed as { tiles: unknown[] }).tiles.filter(isVisionTile);
    }
    return [];
  } catch {
    return [];
  }
}

function visionTileToCandidate(tileset: TilesetDef, tile: TilesetVisionTile): TilesetReviewCandidate | null {
  if (!Number.isInteger(tile.tile) || tile.tile < 0 || tile.tile >= tileset.count) return null;
  const existing = tileset.tileMeta?.[tile.tile] ?? { label: "", description: "" };
  return {
    tile: tile.tile,
    meta: {
      ...existing,
      ...(typeof tile.label === "string" ? { label: tile.label } : {}),
      ...(typeof tile.description === "string" ? { description: tile.description } : {}),
      ...(typeof tile.role === "string" ? { role: tile.role } : {}),
      ...(Array.isArray(tile.tags) ? { tags: tile.tags.filter((tag): tag is string => typeof tag === "string") } : {}),
      ...(normalizePassage(tile.passage) ? { passage: normalizePassage(tile.passage) } : {}),
      confidence: normalizeConfidence(tile.confidence),
      origin: "ai",
      source: "ai",
    },
  };
}

function normalizeConfidence(value: TilesetVisionTile["confidence"]): number {
  const score = confidenceScore(value);
  return score ?? 0.5;
}

function normalizePassage(value: TilesetVisionTile["passage"]): TileAiMetadata["passage"] | undefined {
  if (value === true) return "passable";
  if (value === false) return "solid";
  if (value === "passable" || value === "solid" || value === "star") return value;
  return undefined;
}

function isVisionTile(value: unknown): value is TilesetVisionTile {
  return Boolean(value && typeof value === "object" && Number.isInteger((value as { tile?: unknown }).tile));
}
