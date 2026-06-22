import { describe, expect, it } from "vitest";
import {
  resolveAssetResourceUrl,
  resolveEasyRpgRuntimeAssetUrl,
  resolveGeneratedAssetResourceUrl,
} from "@/assets/generatedAssetResourceResolver";
import { createBlankProject } from "@/project/defaults";
import type { GeneratedAssetManifest } from "@/assets/generatedAssetManifest";

const PROMOTED_MANIFEST = {
  version: 1,
  assets: [
    {
      id: "hero-01-face",
      target: "actorFace",
      resourceKind: "faceset",
      expectedDimensions: { width: 192, height: 192 },
      prompt: "Original face set",
      negativePrompt: "watermarks",
      status: "promoted",
      rawPath: ".omo/evidence/rm2k3-generated-assets-execution/raw/hero-01-face-12345678.png",
      promotedPath: "public/assets/generated/rm2k3/hero-01-face.png",
      resourceId: "generated-actor-hero-01-face",
      sha256: "a".repeat(64),
      provenance: {
        generator: "agy",
        mode: "fake",
        promptVersion: "test",
        createdAt: "2026-06-22T00:00:00.000Z",
      },
    },
  ],
} satisfies GeneratedAssetManifest;

const EASYRPG_MANIFEST = {
  version: 1,
  assets: [
    {
      id: "bad-easyrpg",
      target: "enemyMonster",
      resourceKind: "monster",
      expectedDimensions: { width: 96, height: 96 },
      prompt: "Original monster",
      negativePrompt: "watermarks",
      status: "promoted",
      rawPath: ".omo/evidence/rm2k3-generated-assets-execution/raw/bad-easyrpg-12345678.png",
      promotedPath: "public/assets/easyrpg/monster/bad-easyrpg.png",
      resourceId: "generated-enemy-bad-easyrpg",
      sha256: "b".repeat(64),
      provenance: {
        generator: "agy",
        mode: "fake",
        promptVersion: "test",
        createdAt: "2026-06-22T00:00:00.000Z",
      },
    },
  ],
} satisfies GeneratedAssetManifest;

const PLANNED_MANIFEST = {
  version: 1,
  assets: [{ ...PROMOTED_MANIFEST.assets[0], status: "planned", promotedPath: null, sha256: null }],
} satisfies GeneratedAssetManifest;

const STALE_STATUS_MANIFEST = {
  version: 1,
  assets: [{ ...PROMOTED_MANIFEST.assets[0], status: "validated" }],
} satisfies GeneratedAssetManifest;

describe("generatedAssetResourceResolver", () => {
  it("resolves promoted generated resource ids to browser-usable public asset URLs", () => {
    // Given: a promoted manifest entry with a public/ runtime path.
    // When: the generated resource id is resolved.
    const url = resolveGeneratedAssetResourceUrl("generated-actor-hero-01-face", PROMOTED_MANIFEST);

    // Then: the URL is rooted for the browser and does not include the public/ filesystem prefix.
    expect(url).toBe("/assets/generated/rm2k3/hero-01-face.png");
  });

  it("resolves uploaded resources from the supplied project before generated manifest lookup", () => {
    // Given: a project upload using the same resource id as a promoted generated asset.
    const project = createBlankProject();
    project.assets.uploaded["generated-actor-hero-01-face"] = {
      id: "generated-actor-hero-01-face",
      name: "Uploaded override",
      kind: "faceset",
      dataUrl: "data:image/png;base64,uploaded",
      meta: { width: 192, height: 192 },
    };

    // When: the general resource resolver receives the project and manifest.
    const url = resolveAssetResourceUrl("generated-actor-hero-01-face", { project, manifest: PROMOTED_MANIFEST });

    // Then: existing uploaded dataUrl resolution is preserved.
    expect(url).toBe("data:image/png;base64,uploaded");
  });

  it("resolves EasyRPG runtime package ids and texture keys to public asset URLs", () => {
    // Given: a vendored EasyRPG RTP replacement asset id and its Phaser texture key.
    // When/Then: both identifiers resolve to the same browser-readable package asset.
    expect(resolveEasyRpgRuntimeAssetUrl("easyrpg-faceset-actor1")).toBe("/assets/easyrpg/faceset/Actor1.png");
    expect(resolveAssetResourceUrl("easyrpg-charset-actor1")).toBe("/assets/easyrpg/charset/Actor1.png");
    expect(resolveAssetResourceUrl("tex_easyrpg_charset_actor1")).toBe("/assets/easyrpg/charset/Actor1.png");
  });

  it("returns null for unknown or planned generated resource ids", () => {
    // Given: an unknown id and an unpromoted generated asset plan.
    // When/Then: both unresolved cases return null instead of inventing a URL.
    expect(resolveGeneratedAssetResourceUrl("missing-generated-resource", PROMOTED_MANIFEST)).toBeNull();
    expect(resolveGeneratedAssetResourceUrl("generated-actor-hero-01-face", PLANNED_MANIFEST)).toBeNull();
    expect(resolveGeneratedAssetResourceUrl("generated-actor-hero-01-face", STALE_STATUS_MANIFEST)).toBeNull();
  });

  it("returns null when a promoted manifest path points into EasyRPG assets", () => {
    // Given: a promoted generated entry with a forbidden EasyRPG runtime path.
    // When: the generated resource id is resolved.
    const url = resolveGeneratedAssetResourceUrl("generated-enemy-bad-easyrpg", EASYRPG_MANIFEST);

    // Then: the resolver rejects the path instead of exposing it to previews.
    expect(url).toBeNull();
  });
});
