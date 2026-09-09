import type { MonsterMetadata, MonsterMetadataOverrides, ResourceProfile, UploadedAsset } from "@/project/types";
import { EASYRPG_MONSTER_ASSETS } from "./easyrpgRtp";
import { builtinGeneratedResourceIds } from "./generatedAssetResourceResolver";
import { MONSTER_CATALOG } from "./monsterCatalog";
import { koreanMonsterTags } from "./monsterResourceSemantics";
import { GENERATED_ASSET_PLAN } from "./oprnGeneratedAssetPlan";
import { SCARLOXY_MONSTER_ASSETS } from "./scarloxyPack";

export type MonsterResourceProject = {
  readonly monsterMetadata?: MonsterMetadataOverrides;
  readonly resourceProfiles: readonly Pick<ResourceProfile, "kind" | "name" | "assetId">[];
  readonly assets: { readonly uploaded: Readonly<Record<string, Pick<UploadedAsset, "kind" | "name">>> };
};
export type MonsterMetadataSource = "project" | "catalog" | "fallback";
export type MonsterResource = MonsterMetadata & {
  readonly resourceId: string;
  readonly origin: "bundled" | "uploaded" | "profile";
  readonly reviewStatus: "reviewed" | "unreviewed";
  readonly sources: Readonly<Record<keyof MonsterMetadata, MonsterMetadataSource>>;
};

/** One raw-ID authority for editor/AI selection; metadata never registers resources. */
export function listMonsterResources(project: MonsterResourceProject): readonly MonsterResource[] {
  // Local accumulator preserves canonical source order and deduplicates raw IDs.
  const resources = new Map<string, { readonly name: string; readonly origin: MonsterResource["origin"] }>();
  const add = (resourceId: string, name: string, origin: MonsterResource["origin"]): void => {
    if (!resourceId || resources.has(resourceId)) return;
    if (origin !== "uploaded" && Object.hasOwn(project.assets.uploaded, resourceId)) return;
    resources.set(resourceId, { name: name || resourceId, origin });
  };
  for (const asset of GENERATED_ASSET_PLAN.assets) {
    if (asset.status === "promoted" && asset.resourceKind === "monster") {
      add(asset.resourceId, asset.id.replace(/-/g, " "), "bundled");
    }
  }
  for (const id of builtinGeneratedResourceIds()) {
    if (id.startsWith("generated-enemy-")) add(id, id.replace(/^generated-enemy-/, "").replace(/-/g, " "), "bundled");
  }
  for (const asset of EASYRPG_MONSTER_ASSETS) add(asset.id, asset.name, "bundled");
  for (const asset of SCARLOXY_MONSTER_ASSETS) add(asset.id, asset.name, "bundled");
  for (const profile of project.resourceProfiles) {
    if (profile.kind === "monster" && profile.assetId) add(profile.assetId, profile.name, "profile");
  }
  for (const [id, upload] of Object.entries(project.assets.uploaded)) {
    if (upload.kind === "monster") add(id, upload.name, "uploaded");
  }
  return [...resources].map(([resourceId, resource]): MonsterResource => {
    const catalog = resource.origin === "bundled" && Object.hasOwn(MONSTER_CATALOG, resourceId)
      ? MONSTER_CATALOG[resourceId] : undefined;
    const override = project.monsterMetadata && Object.hasOwn(project.monsterMetadata, resourceId)
      ? project.monsterMetadata[resourceId] : undefined;
    const fallbackTags = resource.origin === "bundled"
      ? ["monster", "enemy", "몬스터", "적", resourceId, ...resourceId.split(/[-_]+/), ...koreanMonsterTags(resourceId, resource.name)]
      : [];
    const defaultSource = catalog ? "catalog" : "fallback";
    return {
      resourceId,
      name: override?.name ?? catalog?.name ?? resource.name,
      tags: override?.tags ?? catalog?.tags ?? fallbackTags,
      description: override?.description ?? catalog?.description ?? "",
      origin: resource.origin,
      reviewStatus: catalog ? "reviewed" : "unreviewed",
      sources: {
        name: override?.name !== undefined ? "project" : defaultSource,
        tags: override?.tags !== undefined ? "project" : defaultSource,
        description: override?.description !== undefined ? "project" : defaultSource,
      },
    };
  });
}

export function getMonsterResource(project: MonsterResourceProject, resourceId: string): MonsterResource | undefined {
  return listMonsterResources(project).find(resource => resource.resourceId === resourceId);
}
