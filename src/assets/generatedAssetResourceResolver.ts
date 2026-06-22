import { RM2K3_GENERATED_ASSET_PLAN } from "./rm2k3GeneratedAssetPlan";
import { EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";
import type { GeneratedAssetManifest } from "./generatedAssetManifest";
import type { Project } from "@/project/types";

export type AssetResourceResolutionOptions = {
  readonly project?: Pick<Project, "assets">;
  readonly manifest?: GeneratedAssetManifest;
};

export function resolveAssetResourceUrl(resourceId: string | undefined, options: AssetResourceResolutionOptions = {}): string | null {
  if (!hasResourceId(resourceId)) return null;
  const uploadedUrl = options.project?.assets.uploaded[resourceId]?.dataUrl;
  if (uploadedUrl !== undefined) return uploadedUrl;
  return (
    resolveEasyRpgRuntimeAssetUrl(resourceId) ??
    resolveGeneratedAssetResourceUrl(resourceId, options.manifest ?? RM2K3_GENERATED_ASSET_PLAN)
  );
}

export function resolveGeneratedAssetResourceUrl(resourceId: string, manifest: GeneratedAssetManifest = RM2K3_GENERATED_ASSET_PLAN): string | null {
  const entry = manifest.assets.find((asset) => asset.resourceId === resourceId);
  if (entry === undefined) return null;
  if (entry.status !== "promoted") return null;
  return generatedAssetPromotedPathToUrl(entry.promotedPath);
}

export function generatedAssetPromotedPathToUrl(promotedPath: string | null): string | null {
  if (promotedPath === null) return null;
  const normalizedPath = promotedPath.trim().replaceAll("\\", "/");
  const runtimePath = stripPublicPrefix(stripLeadingSlash(normalizedPath));
  if (!isAllowedGeneratedRuntimePath(runtimePath)) return null;
  return `/${runtimePath}`;
}

export function resolveEasyRpgRuntimeAssetUrl(resourceId: string): string | null {
  const entry = EASYRPG_RTP_ASSETS.find(
    (asset) => asset.id === resourceId || ("textureKey" in asset && asset.textureKey === resourceId)
  );
  if (entry === undefined) return null;
  return `/${entry.path}`;
}

function hasResourceId(resourceId: string | undefined): resourceId is string {
  return resourceId !== undefined && resourceId.trim().length > 0;
}

function stripLeadingSlash(path: string): string {
  return path.startsWith("/") ? path.slice(1) : path;
}

function stripPublicPrefix(path: string): string {
  const publicPrefix = "public/";
  return path.startsWith(publicPrefix) ? path.slice(publicPrefix.length) : path;
}

function isAllowedGeneratedRuntimePath(path: string): boolean {
  const normalizedPath = path.toLowerCase();
  return normalizedPath.startsWith("assets/generated/") && normalizedPath.endsWith(".png") && !normalizedPath.includes("assets/easyrpg/");
}
