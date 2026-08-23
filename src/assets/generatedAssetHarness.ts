import {
  isSafeGeneratedPngPath,
  validateGeneratedAssetManifest,
  type GeneratedAssetManifest,
  type GeneratedAssetManifestEntry,
  type GeneratedAssetManifestInput,
} from "./generatedAssetManifest";
import { createFakePngBytes } from "./pngFake";
import { inspectPngBytes, type PngInspection } from "./pngInspection";
import { sha256HexBytes } from "../util/sha256";

export type HarnessPathPlan = {
  readonly entryId: string;
  readonly rawPath: string;
};

export type GeneratedAssetValidation = {
  readonly entryId: string;
  readonly path: string;
  readonly ok: boolean;
  readonly inspection: PngInspection | null;
  readonly sha256: string | null;
  readonly issues: readonly string[];
};

export type PromotionMetadata = {
  readonly entryId: string;
  readonly resourceId: string;
  readonly rawPath: string;
  readonly promotedPath: string;
  readonly sha256: string;
  readonly status: "promoted";
};

export type ContactSheetMetadata = {
  readonly columns: number;
  readonly rows: number;
  readonly cells: readonly ContactSheetCell[];
};

export type ContactSheetCell = {
  readonly entryId: string;
  readonly target: string;
  readonly label: string;
  readonly path: string;
  readonly width: number;
  readonly height: number;
};

type ValidationRequest = {
  readonly entry: GeneratedAssetManifestEntry;
  readonly path: string;
  readonly bytes: Uint8Array | null;
};

export function buildDryRunPathPlan(manifest: GeneratedAssetManifest, rawRoot: string): readonly HarnessPathPlan[] {
  return manifest.assets.map((entry) => ({
    entryId: entry.id,
    rawPath: `${trimTrailingSlash(rawRoot)}/${entry.id}-${stableEightHex(entry.id)}.png`,
  }));
}

export function buildLiveAgyCommand(entry: GeneratedAssetManifestEntry, absoluteOutputPath: string): readonly string[] {
  const prompt = [
    `Create a new ${entry.expectedDimensions.width}x${entry.expectedDimensions.height} PNG image file at ${absoluteOutputPath}.`,
    `Subject: ${entry.prompt}.`,
    "Style: original retro 2D JRPG pixel art, crisp pixel edges, transparent or simple background as appropriate.",
    `Avoid: ${entry.negativePrompt}.`,
    "After creating it, reply with only the file path and image format.",
  ].join(" ");
  return ["agy", "--dangerously-skip-permissions", "--print-timeout", "180s", "--print", prompt];
}

export function createFakeGeneratedAsset(entry: GeneratedAssetManifestEntry): Uint8Array {
  return createFakePngBytes(entry.expectedDimensions);
}

export async function validateGeneratedAssetBytes(request: ValidationRequest): Promise<GeneratedAssetValidation> {
  const baseIssues = validatePathAndBytes(request.path, request.bytes);
  if (request.bytes === null) {
    return emptyValidation(request.entry.id, request.path, baseIssues);
  }
  const inspection = await inspectPngBytes(request.bytes);
  if (!inspection.ok) return emptyValidation(request.entry.id, request.path, [...baseIssues, inspection.reason]);
  const issues = [
    ...baseIssues,
    ...dimensionIssues(request.entry, inspection.inspection),
    ...(inspection.inspection.nonblank ? [] : ["PNG appears blank"]),
  ];
  const sha256 = await sha256Hex(request.bytes);
  return {
    entryId: request.entry.id,
    path: request.path,
    ok: issues.length === 0,
    inspection: inspection.inspection,
    sha256,
    issues,
  };
}

export function buildPromotionMetadata(entry: GeneratedAssetManifestEntry, validation: GeneratedAssetValidation): PromotionMetadata | null {
  if (!validation.ok || validation.sha256 === null) return null;
  return {
    entryId: entry.id,
    resourceId: entry.resourceId,
    rawPath: validation.path,
    promotedPath: `public/assets/generated/starter/${entry.id}.png`,
    sha256: validation.sha256,
    status: "promoted",
  };
}

export function buildContactSheetMetadata(manifest: GeneratedAssetManifest): ContactSheetMetadata {
  const cells = manifest.assets.map((entry) => ({
    entryId: entry.id,
    target: entry.target,
    label: `${entry.target}: ${entry.resourceId}`,
    path: entry.promotedPath ?? entry.rawPath ?? "",
    width: entry.expectedDimensions.width,
    height: entry.expectedDimensions.height,
  }));
  return { columns: 4, rows: Math.ceil(cells.length / 4), cells };
}

export function parseHarnessManifest(input: GeneratedAssetManifestInput): GeneratedAssetManifest {
  const result = validateGeneratedAssetManifest(input);
  if (result.ok) return result.manifest;
  const message = result.issues.map((issue) => `${issue.entryId ?? "manifest"}:${issue.field}:${issue.message}`).join("\n");
  throw new GeneratedAssetManifestError(message);
}

export class GeneratedAssetManifestError extends Error {
  readonly name = "GeneratedAssetManifestError";
}

function validatePathAndBytes(path: string, bytes: Uint8Array | null): readonly string[] {
  const issues: string[] = [];
  if (!isSafeGeneratedPngPath(path)) issues.push("output path must be a unique generated PNG outside public/assets/easyrpg");
  if (bytes === null) issues.push("file is missing");
  return issues;
}

function dimensionIssues(entry: GeneratedAssetManifestEntry, inspection: PngInspection): readonly string[] {
  const expected = entry.expectedDimensions;
  if (inspection.width !== expected.width || inspection.height !== expected.height) {
    return [`PNG dimensions ${inspection.width}x${inspection.height} do not match ${expected.width}x${expected.height}`];
  }
  return [];
}

function emptyValidation(entryId: string, path: string, issues: readonly string[]): GeneratedAssetValidation {
  return { entryId, path, ok: false, inspection: null, sha256: null, issues };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return sha256HexBytes(bytes);
}

function stableEightHex(value: string): string {
  let hash = 0x811c9dc5;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 8);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/[\\/]+$/, "");
}
