import { describe, expect, it } from "vitest";
import {
  generatedAssetPromotedPathToUrl,
  resolveAssetResourceUrl,
  resolveEasyRpgRuntimeAssetUrl,
  resolveGeneratedAssetResourceUrl,
} from "@/assets/generatedAssetResourceResolver";
import { GENERATED_ASSET_PLAN } from "@/assets/oprnGeneratedAssetPlan";
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
      rawPath: ".omo/evidence/oprn-generated-assets-execution/raw/hero-01-face-12345678.png",
      promotedPath: "public/assets/generated/starter/hero-01-face.png",
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
      rawPath: ".omo/evidence/oprn-generated-assets-execution/raw/bad-easyrpg-12345678.png",
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
    expect(url).toBe("/assets/generated/starter/hero-01-face.png");
  });

  it("resolves the generated dragon monster registered in the runtime manifest", () => {
    // Given: the project runtime manifest includes the generated dragon enemy art.
    // When: the dragon resource id is resolved through the generated asset resolver.
    const url = resolveGeneratedAssetResourceUrl("generated-enemy-dragon-01", GENERATED_ASSET_PLAN);

    // Then: battle previews can load the promoted monster PNG from public assets.
    expect(url).toBe("/assets/generated/starter/monster-dragon-01.png");
  });

  it("resolves the horror mystery title art shipped with the prototype", () => {
    expect(resolveGeneratedAssetResourceUrl("horror-mystery-blue-gallery")).toBe(
      "/assets/generated/title/horror-mystery-blue-gallery.png",
    );
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

  it("rejects uploaded resource URLs that are not local data URLs", () => {
    // Given: a project upload crafted to load an external URL.
    const project = createBlankProject();
    project.assets.uploaded["remote-title"] = {
      id: "remote-title",
      name: "Remote title",
      kind: "picture",
      dataUrl: "https://example.invalid/title.png",
      meta: { width: 320, height: 240 },
    };

    // When: the upload is resolved for a runtime surface.
    const url = resolveAssetResourceUrl("remote-title", { project });

    // Then: no external URL is exposed to CSS, img, audio, or canvas call sites.
    expect(url).toBeNull();
  });

  it("resolves EasyRPG runtime package ids and texture keys to public asset URLs", () => {
    // Given: a vendored EasyRPG RTP replacement asset id and its Phaser texture key.
    // When/Then: both identifiers resolve to the same browser-readable package asset.
    expect(resolveEasyRpgRuntimeAssetUrl("easyrpg-faceset-actor1")).toBe("/assets/easyrpg/faceset/Actor1.png");
    expect(resolveEasyRpgRuntimeAssetUrl("easyrpg-chipset-exterior")).toBe("/assets/easyrpg/chipset/Exterior.png");
    expect(resolveAssetResourceUrl("easyrpg-charset-actor1")).toBe("/assets/easyrpg/charset/Actor1.png");
    expect(resolveAssetResourceUrl("tex_easyrpg_charset_actor1")).toBe("/assets/easyrpg/charset/Actor1.png");
  });

  it("keeps packaged EasyRPG resources from being shadowed by project uploads", () => {
    const project = createBlankProject();
    project.assets.uploaded["easyrpg-title-title1"] = {
      id: "easyrpg-title-title1",
      name: "Stale uploaded placeholder",
      kind: "picture",
      dataUrl: "data:image/png;base64,uploaded",
      meta: { width: 1, height: 1 },
    };

    const url = resolveAssetResourceUrl("easyrpg-title-title1", { project });

    expect(url).toBe("/assets/easyrpg/title/Title1.png");
  });

  it("maps the legacy sample title placeholder to the packaged EasyRPG title image", () => {
    const project = createBlankProject();
    project.assets.uploaded.sample_title = {
      id: "sample_title",
      name: "Legacy sample title placeholder",
      kind: "title",
      dataUrl: "data:image/png;base64,uploaded",
      meta: { width: 1, height: 1 },
    };

    const url = resolveAssetResourceUrl("sample_title", { project });

    expect(url).toBe("/assets/easyrpg/title/Title1.png");
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

  it("rejects promoted generated paths with traversal segments", () => {
    // Given/When/Then: generated runtime URLs stay inside public/assets/generated.
    expect(generatedAssetPromotedPathToUrl("public/assets/generated/starter/title.png")).toBe("/assets/generated/starter/title.png");
    expect(generatedAssetPromotedPathToUrl("public/assets/generated/../../x.png")).toBeNull();
    expect(generatedAssetPromotedPathToUrl("public/assets/generated/%2e%2e/x.png")).toBeNull();
  });
});
