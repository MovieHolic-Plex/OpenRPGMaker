import { validateResourceDimensions } from "@/project/resourceProfiles";
import type { ResourceKind } from "@/project/types";
import {
  BANNED_PROMPT_TERMS,
  GENERATED_ASSET_TARGETS,
  GENERATION_STATUSES,
  IMAGE_RESOURCE_KINDS,
  UNSAFE_GENERATED_FILE_NAMES,
} from "./generatedAssetConstants";

export { GENERATED_ASSET_TARGETS, GENERATION_STATUSES } from "./generatedAssetConstants";

export type GeneratedAssetTarget = (typeof GENERATED_ASSET_TARGETS)[number];
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

export type GeneratedAssetDimensions = {
  readonly width: number;
  readonly height: number;
};

export type GeneratedAssetProvenance = {
  // "grok" = Grok CLI 의 image_gen(2026-08-29 추가). 마젠타 배경 1024px 을 받아
  // scripts/asset-gen/spriteProcess.mjs 로 크로마키한다. 출처를 뭉개면 어느 백엔드가
  // 만든 그림인지 추적이 끊기므로 "imagegen" 으로 뭉치지 않고 별도 값으로 둔다.
  // native-pixel: editable final-grid drawing; rawPath is the native pose sheet.
  readonly generator: "agy" | "imagegen" | "grok" | "native-pixel";
  readonly mode: "dry-run" | "fake" | "live";
  readonly promptVersion: string;
  readonly createdAt: string;
};

export type GeneratedAssetManifestEntry = {
  readonly id: string;
  readonly target: GeneratedAssetTarget;
  readonly resourceKind: ResourceKind;
  readonly expectedDimensions: GeneratedAssetDimensions;
  readonly prompt: string;
  readonly negativePrompt: string;
  readonly status: GenerationStatus;
  readonly rawPath: string | null;
  readonly promotedPath: string | null;
  readonly resourceId: string;
  readonly sha256: string | null;
  readonly provenance: GeneratedAssetProvenance;
};

export type GeneratedAssetManifest = {
  readonly version: 1;
  readonly assets: readonly GeneratedAssetManifestEntry[];
};

export type GeneratedAssetManifestEntryInput = {
  readonly id?: string;
  readonly target?: string;
  readonly resourceKind?: string;
  readonly expectedDimensions?: {
    readonly width?: number;
    readonly height?: number;
  };
  readonly prompt?: string;
  readonly negativePrompt?: string;
  readonly status?: string;
  readonly rawPath?: string | null;
  readonly promotedPath?: string | null;
  readonly resourceId?: string;
  readonly sha256?: string | null;
  readonly provenance?: {
    readonly generator?: string;
    readonly mode?: string;
    readonly promptVersion?: string;
    readonly createdAt?: string;
  };
};

export type GeneratedAssetManifestInput = {
  readonly version?: number;
  readonly assets?: readonly GeneratedAssetManifestEntryInput[];
};

export type ManifestIssue = {
  readonly entryId: string | null;
  readonly field: string;
  readonly message: string;
};

export type ManifestValidationResult =
  | { readonly ok: true; readonly manifest: GeneratedAssetManifest }
  | { readonly ok: false; readonly issues: readonly ManifestIssue[] };

export function validateGeneratedAssetManifest(input: GeneratedAssetManifestInput): ManifestValidationResult {
  const issues: ManifestIssue[] = [];
  const entries: GeneratedAssetManifestEntry[] = [];
  if (input.version !== 1) issues.push(issue(null, "version", "manifest version must be 1"));
  if (input.assets === undefined || input.assets.length === 0) issues.push(issue(null, "assets", "manifest must include at least one asset"));
  for (const entry of input.assets ?? []) {
    const entryId = validText(entry.id) ? entry.id : null;
    issues.push(...validateEntryFields(entry, entryId));
    const parsed = parseEntry(entry);
    if (parsed.ok) entries.push(parsed.entry);
  }
  const targetSet = new Set(entries.map((entry) => entry.target));
  for (const target of GENERATED_ASSET_TARGETS) {
    if (!targetSet.has(target)) issues.push(issue(null, "assets", `manifest must include ${target}`));
  }
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, manifest: { version: 1, assets: entries } };
}

export function isGeneratedAssetPathAllowed(path: string): boolean {
  const normalized = path.replaceAll("\\", "/").toLowerCase();
  return !normalized.includes("public/assets/easyrpg/");
}

export function isSafeGeneratedPngPath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/").toLowerCase();
  const fileName = normalized.split("/").at(-1) ?? "";
  return normalized.endsWith(".png") && !UNSAFE_GENERATED_FILE_NAMES.some((unsafe) => unsafe === fileName) && isGeneratedAssetPathAllowed(path);
}

export function expectedKindForTarget(target: GeneratedAssetTarget): ResourceKind {
  switch (target) {
    case "actorFace":
      return "faceset";
    case "actorCharset":
      return "charset";
    case "actorBattleCharset":
      return "battleCharset";
    case "enemyMonster":
      return "monster";
    case "itemImage":
    case "itemIcon":
    case "equipmentImage":
    case "equipmentIcon":
      return "picture";
    case "troopPreview":
      return "monster";
    default:
      return assertNever(target);
  }
}

function validateEntryFields(entry: GeneratedAssetManifestEntryInput, entryId: string | null): readonly ManifestIssue[] {
  const issues: ManifestIssue[] = [];
  if (!validText(entry.id) || !/^[a-z0-9-]+$/.test(entry.id)) issues.push(issue(entryId, "id", "id must be kebab-case text"));
  if (!isGeneratedAssetTarget(entry.target)) issues.push(issue(entryId, "target", "target is not supported"));
  if (!isImageResourceKind(entry.resourceKind)) issues.push(issue(entryId, "resourceKind", "resource kind must be an image kind"));
  if (isGeneratedAssetTarget(entry.target) && isImageResourceKind(entry.resourceKind) && expectedKindForTarget(entry.target) !== entry.resourceKind) {
    issues.push(issue(entryId, "resourceKind", `${entry.target} must use ${expectedKindForTarget(entry.target)}`));
  }
  issues.push(...validateDimensions(entry, entryId));
  if (!validText(entry.prompt)) issues.push(issue(entryId, "prompt", "prompt is required"));
  if (!validText(entry.negativePrompt)) issues.push(issue(entryId, "negativePrompt", "negative prompt is required"));
  if (!isGenerationStatus(entry.status)) issues.push(issue(entryId, "status", "status is not supported"));
  if (!validText(entry.resourceId)) issues.push(issue(entryId, "resourceId", "resource id is required"));
  issues.push(...validatePromptTerms(entry, entryId));
  issues.push(...validatePaths(entry, entryId));
  issues.push(...validateProvenance(entry, entryId));
  return issues;
}

function validateDimensions(entry: GeneratedAssetManifestEntryInput, entryId: string | null): readonly ManifestIssue[] {
  const dimensions = entry.expectedDimensions;
  if (dimensions === undefined) return [issue(entryId, "expectedDimensions", "expected dimensions are required")];
  if (!validPositiveInt(dimensions.width) || !validPositiveInt(dimensions.height)) {
    return [issue(entryId, "expectedDimensions", "expected dimensions must be positive integers")];
  }
  if (!isImageResourceKind(entry.resourceKind)) return [];
  const result = validateResourceDimensions(entry.resourceKind, dimensions.width, dimensions.height);
  return result.ok ? [] : [issue(entryId, "expectedDimensions", result.message)];
}

function validatePromptTerms(entry: GeneratedAssetManifestEntryInput, entryId: string | null): readonly ManifestIssue[] {
  const combined = `${entry.prompt ?? ""} ${entry.negativePrompt ?? ""}`.toLowerCase();
  return BANNED_PROMPT_TERMS.flatMap((term) => (combined.includes(term) ? [issue(entryId, "prompt", `prompt cannot reference ${term}`)] : []));
}

function validatePaths(entry: GeneratedAssetManifestEntryInput, entryId: string | null): readonly ManifestIssue[] {
  const paths = [entry.rawPath, entry.promotedPath].filter(validText);
  const issues = paths.flatMap((path) => (isSafeGeneratedPngPath(path) ? [] : [issue(entryId, "path", `${path} is not an allowed generated PNG path`)]));
  if (entry.status === "promoted" && !validText(entry.promotedPath)) return [...issues, issue(entryId, "promotedPath", "promoted assets require a promoted path")];
  if ((entry.status === "generated" || entry.status === "validated" || entry.status === "promoted") && !validText(entry.rawPath)) {
    return [...issues, issue(entryId, "rawPath", `${entry.status} assets require a raw path`)];
  }
  if (entry.status === "promoted" && !validText(entry.sha256)) return [...issues, issue(entryId, "sha256", "promoted assets require a hash")];
  return issues;
}

function validateProvenance(entry: GeneratedAssetManifestEntryInput, entryId: string | null): readonly ManifestIssue[] {
  const provenance = entry.provenance;
  if (provenance === undefined) return [issue(entryId, "provenance", "provenance is required")];
  const issues: ManifestIssue[] = [];
  if (!isProvenanceGenerator(provenance.generator)) {
    issues.push(issue(entryId, "provenance.generator", "generator must be agy, imagegen, grok or native-pixel"));
  }
  if (provenance.mode !== "dry-run" && provenance.mode !== "fake" && provenance.mode !== "live") {
    issues.push(issue(entryId, "provenance.mode", "mode must be dry-run, fake, or live"));
  }
  if (!validText(provenance.promptVersion)) issues.push(issue(entryId, "provenance.promptVersion", "prompt version is required"));
  if (!validText(provenance.createdAt)) issues.push(issue(entryId, "provenance.createdAt", "creation timestamp is required"));
  return issues;
}

function parseEntry(entry: GeneratedAssetManifestEntryInput): { readonly ok: true; readonly entry: GeneratedAssetManifestEntry } | { readonly ok: false } {
  const dimensions = entry.expectedDimensions;
  const provenance = entry.provenance;
  if (
    !validText(entry.id) ||
    !isGeneratedAssetTarget(entry.target) ||
    !isImageResourceKind(entry.resourceKind) ||
    dimensions === undefined ||
    !validPositiveInt(dimensions.width) ||
    !validPositiveInt(dimensions.height) ||
    !validText(entry.prompt) ||
    !validText(entry.negativePrompt) ||
    !isGenerationStatus(entry.status) ||
    !validText(entry.resourceId) ||
    !isProvenanceGenerator(provenance?.generator) ||
    !isProvenanceMode(provenance.mode) ||
    !validText(provenance.promptVersion) ||
    !validText(provenance.createdAt)
  ) {
    return { ok: false };
  }
  return {
    ok: true,
    entry: {
      id: entry.id,
      target: entry.target,
      resourceKind: entry.resourceKind,
      expectedDimensions: { width: dimensions.width, height: dimensions.height },
      prompt: entry.prompt,
      negativePrompt: entry.negativePrompt,
      status: entry.status,
      rawPath: entry.rawPath ?? null,
      promotedPath: entry.promotedPath ?? null,
      resourceId: entry.resourceId,
      sha256: entry.sha256 ?? null,
      provenance: {
        generator: provenance.generator,
        mode: provenance.mode,
        promptVersion: provenance.promptVersion,
        createdAt: provenance.createdAt,
      },
    },
  };
}

function isGeneratedAssetTarget(value: string | undefined): value is GeneratedAssetTarget {
  return value !== undefined && GENERATED_ASSET_TARGETS.some((target) => target === value);
}

function isProvenanceGenerator(value: string | undefined): value is GeneratedAssetProvenance["generator"] {
  return value === "agy" || value === "imagegen" || value === "grok" || value === "native-pixel";
}

function isGenerationStatus(value: string | undefined): value is GenerationStatus {
  return value !== undefined && GENERATION_STATUSES.some((status) => status === value);
}

function isImageResourceKind(value: string | undefined): value is ResourceKind {
  return value !== undefined && IMAGE_RESOURCE_KINDS.some((kind) => kind === value);
}

function isProvenanceMode(value: string | undefined): value is GeneratedAssetProvenance["mode"] {
  return value === "dry-run" || value === "fake" || value === "live";
}

function validText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validPositiveInt(value: number | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function issue(entryId: string | null, field: string, message: string): ManifestIssue {
  return { entryId, field, message };
}

function assertNever(value: never): never {
  throw new Error(`Unexpected generated asset target: ${value}`);
}
