import { describe, expect, it, vi } from "vitest";
import { EASYRPG_MONSTER_ASSETS } from "@/assets/easyrpgRtp";
import { builtinGeneratedResourceIds } from "@/assets/generatedAssetResourceResolver";
import { GENERATED_ASSET_PLAN } from "@/assets/oprnGeneratedAssetPlan";
import { SCARLOXY_MONSTER_ASSETS } from "@/assets/scarloxyPack";
import { getMonsterResource, listMonsterResources, type MonsterResourceProject } from "@/assets/monsterResourceCatalog";
import { searchResources } from "@/assets/resourceSearch";

// A catalog data fixture exercises membership precedence without pretending the
// foundation's empty shipped catalog contains visually reviewed observations.
vi.mock("@/assets/monsterCatalog", () => ({ MONSTER_CATALOG: {
  "generated-enemy-slime-01": { name: "CATALOG", tags: ["CATALOG_TAG"], description: "CATALOG_DESC" },
} }));
const project: MonsterResourceProject = { resourceProfiles: [], assets: { uploaded: {} } };
const id = "generated-enemy-slime-01";

describe("monster resource authority", () => {
  it("enumerates the canonical raw-ID set exactly once when no project resources exist", () => {
    // Given
    const expected = new Set([
      ...GENERATED_ASSET_PLAN.assets.filter(asset => asset.status === "promoted" && asset.resourceKind === "monster").map(asset => asset.resourceId),
      ...builtinGeneratedResourceIds().filter(resourceId => resourceId.startsWith("generated-enemy-")),
      ...EASYRPG_MONSTER_ASSETS.map(asset => asset.id),
      ...SCARLOXY_MONSTER_ASSETS.map(asset => asset.id),
    ]);
    // When
    const resources = listMonsterResources(project);
    // Then
    expect(new Set(resources.map(resource => resource.resourceId))).toEqual(expected);
    expect(resources).toHaveLength(expected.size);
    expect(resources.some(resource => resource.resourceId === "generated-troop-preview-slime")).toBe(true);
  });

  it("inherits catalog fields independently when an explicit project description clears the default", () => {
    // Given
    const source = { ...project, monsterMetadata: { [id]: { description: "" } } };
    // When
    const resource = getMonsterResource(source, id);
    // Then
    expect(resource).toEqual({ resourceId: id, name: "CATALOG", tags: ["CATALOG_TAG"], description: "", origin: "bundled", reviewStatus: "reviewed", sources: { name: "catalog", tags: "catalog", description: "project" } });
  });

  it("does not inherit catalog review or appearance when an upload replaces a bundled ID", () => {
    // Given
    const source: MonsterResourceProject = { ...project, assets: { uploaded: { [id]: { kind: "monster", name: "UPLOAD" } } } };
    // When
    const resource = getMonsterResource(source, id);
    // Then
    expect(resource).toEqual({ resourceId: id, name: "UPLOAD", tags: [], description: "", origin: "uploaded", reviewStatus: "unreviewed", sources: { name: "fallback", tags: "fallback", description: "fallback" } });
  });

  it("keeps missing catalog resources unreviewed when returning fallback metadata", () => {
    // Given
    const fallbackId = "generated-enemy-bat-01";
    // When
    const resource = getMonsterResource(project, fallbackId);
    // Then
    expect(resource).toMatchObject({ resourceId: fallbackId, description: "", reviewStatus: "unreviewed", sources: { name: "fallback", tags: "fallback", description: "fallback" } });
  });

  it("registers only explicit monster profiles when metadata contains orphan or inherited-looking IDs", () => {
    // Given
    const source: MonsterResourceProject = {
      resourceProfiles: [{ kind: "monster", assetId: "profile", name: "PROFILE" }, { kind: "picture", assetId: "generated-enemy-misleading", name: "PICTURE" }],
      assets: { uploaded: {} }, monsterMetadata: { orphan: { name: "ORPHAN" } },
    };
    // When
    const resources = listMonsterResources(source);
    // Then
    expect(resources.find(resource => resource.resourceId === "profile")).toMatchObject({ origin: "profile", name: "PROFILE", reviewStatus: "unreviewed" });
    expect(resources.some(resource => resource.resourceId === "orphan" || resource.resourceId === "generated-enemy-misleading")).toBe(false);
    expect(getMonsterResource(source, "constructor")).toBeUndefined();
    expect(getMonsterResource(source, "monster:" + id)).toBeUndefined();
  });

  it("keeps generic monster search identical to authority membership when an upload kind contradicts its ID", () => {
    // Given
    const source: MonsterResourceProject = { resourceProfiles: [{ kind: "monster", name: "MISLEADING", assetId: id }], assets: { uploaded: { [id]: { kind: "picture", name: "PICTURE" } } } };
    // When
    const found = searchResources("monster", "*", { monsterProject: source });
    // Then
    expect(found.map(resource => resource.id)).toEqual(listMonsterResources(source).map(resource => resource.resourceId));
    expect(found.some(resource => resource.id === id)).toBe(false);
  });
});
