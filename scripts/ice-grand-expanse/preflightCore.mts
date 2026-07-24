import { createHash } from "node:crypto";
import path from "node:path";

export const TARGET_PROJECT_ID = "rpg-zzu-dungeon-theme-gallery";
export const CANONICAL_MAP_ID = "map_g_ice_grand";
export const ADVENTURE_MAP_ID = "map_g_ice_grand_adventure";
export const DERIVED_MAP_ID = "map_g_ice_grand_expanse";

export type PreflightErrorCode =
  | "ARGUMENT_INVALID"
  | "CONFIG_MISSING"
  | "DIRTY_OVERLAP"
  | "OUTPUT_EXISTS"
  | "PROJECT_NOT_FOUND"
  | "PROTECTED_MAP_MISSING"
  | "TREE_DUPLICATE"
  | "TARGET_IDENTITY_MISMATCH"
  | "REMOTE_READ_FAILED";

export class PreflightError extends Error {
  constructor(readonly code: PreflightErrorCode, message: string) {
    super(message);
    this.name = "PreflightError";
  }
}

export type PreflightArgs = { readonly out: string; readonly projectId: string };
export type TreeLike = { readonly children: readonly TreeLike[]; readonly mapId: string };
export type TreeLocation = { readonly childIndexes: readonly number[]; readonly mapIds: readonly string[] };
export type SourceManifestInput = {
  readonly gitHeadOrNull: string | null;
  readonly runId: string;
  readonly startedAt: string;
  readonly supabaseOriginSha256: string;
  readonly targetProjectId: string;
  readonly trackedDiffSha256: string;
  readonly untrackedInventorySha256: string;
};
export type SourceManifest = SourceManifestInput & { readonly sourceManifestSha256: string };

export function parsePreflightArgs(argv: readonly string[]): PreflightArgs {
  let projectId = "";
  let out = "";
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key || !value || (key !== "--project-id" && key !== "--out")) {
      throw new PreflightError("ARGUMENT_INVALID", "Expected --project-id and --out pairs");
    }
    if (key === "--project-id") projectId = value.trim();
    if (key === "--out") out = value.trim();
  }
  const normalized = out.replaceAll("\\", "/");
  if (!projectId || !normalized || path.isAbsolute(out) || normalized.includes("../")) {
    throw new PreflightError("ARGUMENT_INVALID", "Project id and repository-relative output are required");
  }
  if (!normalized.startsWith("output/evidence/ice-grand-expanse/") || !normalized.includes("/task-1")) {
    throw new PreflightError("ARGUMENT_INVALID", "Output must be scoped to an ice-grand-expanse task-1 run");
  }
  return { out: normalized, projectId };
}

export function normalizeSupabaseOrigin(value: string): string {
  try {
    return new URL(value).origin.toLowerCase();
  } catch (error) {
    if (error instanceof TypeError) throw new PreflightError("CONFIG_MISSING", "Supabase URL is invalid");
    throw error;
  }
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function sha256Bytes(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashValue(value: unknown): string {
  return sha256Bytes(stableJson(value));
}

export function assertNoDirtyOverlap(paths: readonly string[]): void {
  if (paths.length > 0) {
    throw new PreflightError("DIRTY_OVERLAP", `Dirty paths changed during preflight: ${paths.slice(0, 20).join(", ")}`);
  }
}

export async function buildSourceManifest(input: SourceManifestInput): Promise<SourceManifest> {
  return { ...input, sourceManifestSha256: hashValue(input) };
}

export function collectTreeLocations(tree: TreeLike, target: string): readonly TreeLocation[] {
  const locations: TreeLocation[] = [];
  const visit = (node: TreeLike, indexes: readonly number[], ids: readonly string[]): void => {
    const nextIds = [...ids, node.mapId];
    if (node.mapId === target) locations.push({ childIndexes: indexes, mapIds: nextIds });
    node.children.forEach((child, index) => visit(child, [...indexes, index], nextIds));
  };
  visit(tree, [], []);
  return locations;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function recordAt(value: Record<string, unknown>, key: string): Record<string, unknown> {
  const nested = value[key];
  if (!isRecord(nested)) throw new PreflightError("PROTECTED_MAP_MISSING", `Required record is missing: ${key}`);
  return nested;
}

export function treeAt(value: unknown): TreeLike {
  if (!isRecord(value) || typeof value.mapId !== "string" || !Array.isArray(value.children)) {
    throw new PreflightError("TREE_DUPLICATE", "Map tree shape is invalid");
  }
  return { children: value.children.map(treeAt), mapId: value.mapId };
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
}
