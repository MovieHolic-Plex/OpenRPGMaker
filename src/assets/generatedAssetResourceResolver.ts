import { resolveCc0IconAssetUrl } from "./cc0IconAssets";
import { resolveCc0AudioAssetUrl } from "./cc0AudioAssets";
import { resolveFarmingAssetUrl } from "./farmingSprites";
import { resolveScarloxyAssetUrl } from "./scarloxyPack";
import { EASYRPG_RTP_ASSETS } from "@/assets/easyrpgRtp";
import type { GeneratedAssetManifest } from "./generatedAssetManifest";
import type { Project } from "@/project/types";

const BUILTIN_GENERATED_RESOURCE_URLS: Record<string, string> = {
  hero: "/assets/generated/rm2k3/hero-01-battle.png",
  "rpg-zzu-title-bright": "/assets/generated/title/bright-rpg-maker-title-v2.png",
  "rpg-zzu-title-blue": "/assets/generated/title/default-title-blue.png",
  "rpg-zzu-title-field": "/assets/generated/title/rm2k3-title-field.png",
  "rpg-zzu-title-logo-crest": "/assets/generated/title/title-logo-crest.png",
  "generated-actor-hero-01-battle": "/assets/generated/rm2k3/hero-01-battle.png",
  "generated-actor-hero-01-charset": "/assets/generated/rm2k3/hero-01-charset.png",
  "generated-actor-hero-01-face": "/assets/generated/rm2k3/hero-01-face.png",
  "generated-actor-hero-02-battle": "/assets/generated/rm2k3/hero-02-battle.png",
  "generated-actor-hero-02-charset": "/assets/generated/rm2k3/hero-02-charset.png",
  "generated-actor-hero-02-face": "/assets/generated/rm2k3/hero-02-face.png",
  "generated-face-actor1-bust": "/assets/generated/faces/actor1-bust.png",
  "generated-face-actor1-full": "/assets/generated/faces/actor1-bust.png",
  "generated-actor-hero-03-battle": "/assets/generated/rm2k3/hero-03-battle.png",
  "generated-actor-hero-03-face": "/assets/generated/rm2k3/hero-03-face.png",
  "generated-actor-hero-04-battle": "/assets/generated/rm2k3/hero-04-battle.png",
  "generated-enemy-bat-01": "/assets/generated/rm2k3/monster-bat-01.png",
  "generated-enemy-dragon-01": "/assets/generated/rm2k3/monster-dragon-01.png",
  "generated-enemy-golem-01": "/assets/generated/rm2k3/monster-golem-01.png",
  "generated-enemy-ontology-8da61312": "/assets/generated/rm2k3/monster-ontology-8da61312.png",
  "generated-enemy-slime-01": "/assets/generated/rm2k3/monster-slime-01.png",
  "generated-enemy-sylph-hornet": "/assets/generated/rm2k3/sylph-hornet-transparent.png",
  "generated-enemy-zombie-01": "/assets/generated/rm2k3/monster-zombie-01.png",
  "generated-enemy-skeleton-01": "/assets/generated/rm2k3/monster-skeleton-01.png",
  "generated-enemy-orc-01": "/assets/generated/rm2k3/monster-orc-01.png",
  "generated-enemy-ghost-01": "/assets/generated/rm2k3/monster-ghost-01.png",
  "generated-enemy-crab-01": "/assets/generated/rm2k3/monster-crab-01.png",
  "generated-enemy-spider-01": "/assets/generated/rm2k3/monster-spider-01.png",
  "generated-enemy-snake-01": "/assets/generated/rm2k3/monster-snake-01.png",
  "generated-enemy-scorpion-01": "/assets/generated/rm2k3/monster-scorpion-01.png",
  "generated-enemy-wolf-01": "/assets/generated/rm2k3/monster-wolf-01.png",
  "generated-enemy-harpy-01": "/assets/generated/rm2k3/monster-harpy-01.png",
  "generated-enemy-centipede-01": "/assets/generated/rm2k3/monster-centipede-01.png",
  "generated-enemy-plant-01": "/assets/generated/rm2k3/monster-plant-01.png",
  "generated-enemy-horse-01": "/assets/generated/rm2k3/monster-horse-01.png",
  "generated-enemy-unicorn-01": "/assets/generated/rm2k3/monster-unicorn-01.png",
  "generated-enemy-salamander-01": "/assets/generated/rm2k3/monster-salamander-01.png",
  "generated-enemy-carbuncle-01": "/assets/generated/rm2k3/monster-carbuncle-01.png",
  "generated-enemy-cat-01": "/assets/generated/rm2k3/monster-cat-01.png",
  "generated-enemy-kappa-01": "/assets/generated/rm2k3/monster-kappa-01.png",
  "generated-enemy-cockatrice-01": "/assets/generated/rm2k3/monster-cockatrice-01.png",
  "generated-enemy-parasite-01": "/assets/generated/rm2k3/monster-parasite-01.png",
  "generated-enemy-mantis-01": "/assets/generated/rm2k3/monster-mantis-01.png",
  "generated-enemy-jackolantern-01": "/assets/generated/rm2k3/monster-jackolantern-01.png",
  "generated-enemy-fish-01": "/assets/generated/rm2k3/monster-fish-01.png",
  "generated-enemy-spirit-01": "/assets/generated/rm2k3/monster-spirit-01.png",
  "generated-enemy-ghoul-01": "/assets/generated/rm2k3/monster-ghoul-01.png",
  "generated-enemy-specter-01": "/assets/generated/rm2k3/monster-specter-01.png",
  "generated-enemy-lemora-01": "/assets/generated/rm2k3/monster-lemora-01.png",
  "generated-enemy-sylph-01": "/assets/generated/rm2k3/monster-sylph-01.png",
  "generated-enemy-leafling-01": "/assets/generated/rm2k3/monster-leafling-01.png",
  "generated-enemy-sparkit-01": "/assets/generated/rm2k3/monster-sparkit-01.png",
  "generated-enemy-aqualing-01": "/assets/generated/rm2k3/monster-aqualing-01.png",
  "generated-enemy-king-slime-01": "/assets/generated/rm2k3/monster-king-slime-01.png",
  "generated-equipment-bronze-sword-icon": "/assets/generated/rm2k3/bronze-sword-icon.png",
  "generated-equipment-bronze-sword-image": "/assets/generated/rm2k3/bronze-sword-image.png",
  "generated-equipment-oak-shield-icon": "/assets/generated/rm2k3/oak-shield-icon.png",
  "generated-equipment-oak-shield-image": "/assets/generated/rm2k3/oak-shield-image.png",
  "generated-item-ether-blue-icon": "/assets/generated/rm2k3/ether-blue-icon.png",
  "generated-item-ether-blue-image": "/assets/generated/rm2k3/ether-blue-image.png",
  "generated-item-potion-red-icon": "/assets/generated/rm2k3/potion-red-icon.png",
  "generated-item-potion-red-image": "/assets/generated/rm2k3/potion-red-image.png",
  "generated-troop-preview-slime": "/assets/generated/rm2k3/troop-preview-slime.png",
  "battle-skin-pokemon-backdrop": "/assets/generated/battle-skins/pokemon-backdrop.png",
  "battle-skin-rm2003-backdrop": "/assets/generated/battle-skins/rm2003-backdrop.png",
  "battle-skin-rm2000-backdrop": "/assets/generated/battle-skins/rm2000-backdrop.png",
  "battle-skin-octopath-backdrop": "/assets/generated/battle-skins/octopath-backdrop.png",
  "battle-skin-chrono-backdrop": "/assets/generated/battle-skins/chrono-backdrop.png",
  "battle-skin-bravely-backdrop": "/assets/generated/battle-skins/bravely-backdrop.png",
  "battle-skin-dragonquest-backdrop": "/assets/generated/battle-skins/dragonquest-backdrop.png",
  "battle-skin-ff-backdrop": "/assets/generated/battle-skins/ff-backdrop.png",
  "battle-skin-mother-backdrop": "/assets/generated/battle-skins/mother-backdrop.png",
  "battle-skin-goldensun-backdrop": "/assets/generated/battle-skins/goldensun-backdrop.png",
  "battle-skin-demo-battler": "/assets/generated/battle-skins/demo-battler-alpha.png",
  // Side-view battle field art (not EasyRPG sky panoramas).
  "generated-battle-reference-forest": "/generated/battle-reference-forest.png",
  // CSS 9-slice windowskin (EasyRPG System/*.png sheets are icon strips, not windowskins).
  "windowskin-rm2003": "/assets/ui/windowskin-rm2003.png",
};

const LEGACY_PACKAGED_RESOURCE_URLS: Record<string, string> = {
  sample_title: "/assets/easyrpg/title/Title1.png",
};

export type AssetResourceResolutionOptions = {
  readonly project?: Pick<Project, "assets">;
  readonly manifest?: GeneratedAssetManifest;
};

export function resolveAssetResourceUrl(resourceId: string | undefined, options: AssetResourceResolutionOptions = {}): string | null {
  if (!hasResourceId(resourceId)) return null;
  const packagedUrl =
    LEGACY_PACKAGED_RESOURCE_URLS[resourceId] ??
    resolveEasyRpgRuntimeAssetUrl(resourceId) ??
    resolveScarloxyAssetUrl(resourceId) ??
    resolveFarmingAssetUrl(resourceId) ??
    resolveCc0IconAssetUrl(resourceId) ??
    resolveCc0AudioAssetUrl(resourceId);
  if (packagedUrl !== null) return packagedUrl;
  const uploadedUrl = options.project?.assets.uploaded[resourceId]?.dataUrl;
  if (uploadedUrl !== undefined) return safeUploadedResourceUrl(uploadedUrl);
  if (options.manifest !== undefined) return resolveGeneratedAssetResourceUrl(resourceId, options.manifest);
  return resolveGeneratedAssetResourceUrl(resourceId);
}

export function builtinGeneratedResourceIds(): string[] {
  return Object.keys(BUILTIN_GENERATED_RESOURCE_URLS);
}

export function resolveGeneratedAssetResourceUrl(resourceId: string, manifest?: GeneratedAssetManifest): string | null {
  if (manifest === undefined) return BUILTIN_GENERATED_RESOURCE_URLS[resourceId] ?? null;
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
  return (
    normalizedPath.startsWith("assets/generated/") &&
    normalizedPath.endsWith(".png") &&
    !normalizedPath.includes("assets/easyrpg/") &&
    !hasUnsafePathSegment(normalizedPath)
  );
}

function safeUploadedResourceUrl(dataUrl: string): string | null {
  const normalizedUrl = dataUrl.trim().toLowerCase();
  if (normalizedUrl.startsWith("data:image/png;")) return dataUrl;
  if (normalizedUrl.startsWith("data:image/jpeg;")) return dataUrl;
  if (normalizedUrl.startsWith("data:image/webp;")) return dataUrl;
  if (normalizedUrl.startsWith("data:image/gif;")) return dataUrl;
  if (normalizedUrl.startsWith("data:audio/mpeg;")) return dataUrl;
  if (normalizedUrl.startsWith("data:audio/wav;")) return dataUrl;
  if (normalizedUrl.startsWith("data:audio/ogg;")) return dataUrl;
  return null;
}

function hasUnsafePathSegment(path: string): boolean {
  if (path.includes("%2e") || path.includes("%2f") || path.includes("%5c")) return true;
  return path.split("/").some((segment) => segment === "." || segment === "..");
}
