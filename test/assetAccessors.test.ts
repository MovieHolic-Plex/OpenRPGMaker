import { describe, expect, it, afterEach, vi } from "vitest";
import { setUploadedAssetResolver, uploadedAssetBytes, uploadedAssetMime, uploadedAssetUrl } from "@/project/persistence/assetAccessors";
import type { UploadedAsset, Project } from "@/project/types";
import { registerExportAssetBase } from "@/assets/inlineAssetStore";
import { installExportUploadedAssets } from "@/player/exportUploadedAssets";
import { webUploadedAssetPath } from "@/project/webUploadedAssetPath";
import { generatedAssetPromotedPathToUrl, resolveAssetResourceUrl, resolveEasyRpgRuntimeAssetUrl, resolveGeneratedAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { GENERATED_ASSET_PLAN } from "@/assets/oprnGeneratedAssetPlan";
import { createBlankProject } from "@/project/defaults";
import type { GeneratedAssetManifest } from "@/assets/generatedAssetManifest";
import { isolateTimers } from "./mergedTeardown";

describe("assetAccessors", () => {
  isolateTimers();
  const REF_ONLY: UploadedAsset = {
    id: "asset-ref-only",
    name: "참조만 있는 자산",
    kind: "sprite",
    ref: { sha256: "a".repeat(64), mime: "image/png", bytes: 3, extension: "png" },
  };
  const LEGACY: UploadedAsset = {
    id: "asset-legacy",
    name: " dataUrl 자산",
    kind: "sprite",
    dataUrl: "data:image/gif;base64,R0lGOD",
  };
  describe("uploadedAsset accessors", () => {
    it("ref 만 있는 자산은 어댑터가 준 url·mime·바이트를 돌려준다", async () => {
      setUploadedAssetResolver({
        url: (ref) => `oprn-asset://project/${ref.sha256}`,
        bytes: async (ref) => new TextEncoder().encode(`bytes:${ref.extension}`),
      });

      expect(uploadedAssetUrl(REF_ONLY)).toBe(`oprn-asset://project/${"a".repeat(64)}`);
      expect(uploadedAssetMime(REF_ONLY)).toBe("image/png");
      await expect(uploadedAssetBytes(REF_ONLY)).resolves.toEqual(new TextEncoder().encode("bytes:png"));
    });

    it("옛 dataUrl 자산은 접근자가 그대로 돌려주고 mime 을 헤더에서 읽는다", async () => {
      setUploadedAssetResolver(null);

      expect(uploadedAssetUrl(LEGACY)).toBe(LEGACY.dataUrl);
      expect(uploadedAssetMime(LEGACY)).toBe("image/gif");
    });

    it("해석기가 없으면 ref 자산의 url 은 빈 문자열이고 mime 은 ref 에서 온다", () => {
      setUploadedAssetResolver(null);

      expect(uploadedAssetUrl(REF_ONLY)).toBe("");
      expect(uploadedAssetMime(REF_ONLY)).toBe("image/png");
    });
  });
});

describe("exportUploadedAssets", () => {
  isolateTimers();
  const media: UploadedAsset = { id: '회중 시계/그림', name: '시계', kind: 'picture', meta: { width: 1, height: 1 },
    ref: { sha256: 'a'.repeat(64), mime: 'image/webp', bytes: 3, extension: 'webp' } };
  const project = (uploaded: Record<string, UploadedAsset>) => ({ assets: { uploaded } }) as Project;
  afterEach(() => { setUploadedAssetResolver(null); registerExportAssetBase(null); vi.unstubAllGlobals(); });
  describe('exported SQLite media', () => {
    it('resolves refs to the exact packaged path under the game directory', async () => {
      registerExportAssetBase(new URL('https://games.example/game/'));
      installExportUploadedAssets(project({ [media.id]: media }));
      const expected = new URL(webUploadedAssetPath(media), 'https://games.example/game/').href;
      expect(uploadedAssetUrl(media)).toBe(expected);
      const fetchBytes = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
      vi.stubGlobal('fetch', fetchBytes);
      expect(await uploadedAssetBytes(media)).toEqual(new Uint8Array([1, 2, 3]));
      expect(fetchBytes).toHaveBeenCalledWith(expected);
    });
    it('reports a missing packaged file instead of accepting error bytes', async () => {
      installExportUploadedAssets(project({ [media.id]: media }));
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
      await expect(uploadedAssetBytes(media)).rejects.toThrow('404');
    });
    it('opening an inline game clears the previous game ref resolver', () => {
      installExportUploadedAssets(project({ [media.id]: media }));
      const inline = { ...media, ref: undefined, dataUrl: 'data:image/png;base64,AQID' };
      installExportUploadedAssets(project({ [inline.id]: inline }));
      expect(uploadedAssetUrl(inline)).toBe(inline.dataUrl);
      expect(uploadedAssetUrl(media)).toBe('');
    });
  });
});

describe("generatedAssetResourceResolver", () => {
  isolateTimers();
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
    it("refuses retired starter art even when an old manifest says it was promoted", () => {
      expect(resolveGeneratedAssetResourceUrl("generated-actor-hero-01-face", PROMOTED_MANIFEST)).toBeNull();
    });

    it("resolves the generated dragon monster registered in the runtime manifest", () => {
      // Given: the project runtime manifest includes the generated dragon enemy art.
      // When: the dragon resource id is resolved through the generated asset resolver.
      const url = resolveGeneratedAssetResourceUrl("generated-enemy-dragon-01", GENERATED_ASSET_PLAN);

      // Then: battle previews can load the promoted monster PNG from public assets.
      expect(url).toBe("/assets/generated/pixel-enemy-portraits/dragon.png");
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
      // EasyRPG 칩셋 그림은 2026-10-07 저작권 정리로 지웠다 — 지운 그림을 경로로 해석하지 않는다(retiredAssets.ts).
      expect(resolveEasyRpgRuntimeAssetUrl("easyrpg-chipset-exterior")).toBeNull();
      expect(resolveAssetResourceUrl("easyrpg-charset-actor1")).toBe("/assets/easyrpg/charset/Actor1.png");
      expect(resolveAssetResourceUrl("tex_easyrpg_charset_actor1")).toBe("/assets/easyrpg/charset/Actor1.png");
    });

    it("keeps packaged EasyRPG resources from being shadowed by project uploads", () => {
      // 타이틀 그림(easyrpg-title-*)은 2026-10-07 저작권 정리로 지웠다 — 남아 있는 번들 캐릭터 그림으로 잰다.
      const project = createBlankProject();
      project.assets.uploaded["easyrpg-charset-actor1"] = {
        id: "easyrpg-charset-actor1",
        name: "Stale uploaded placeholder",
        kind: "picture",
        dataUrl: "data:image/png;base64,uploaded",
        meta: { width: 1, height: 1 },
      };

      const url = resolveAssetResourceUrl("easyrpg-charset-actor1", { project });

      expect(url).toBe("/assets/easyrpg/charset/Actor1.png");
    });

    // 옛 「sample_title → EasyRPG Title1」 대체 경로는 Title1 그림과 함께 2026-10-07 저작권 정리로 지웠다(generatedAssetResourceResolver.ts).

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
      expect(generatedAssetPromotedPathToUrl("public/assets/generated/starter/title.png")).toBeNull();
      expect(generatedAssetPromotedPathToUrl("public/assets/generated/title/title.png")).toBe("/assets/generated/title/title.png");
      expect(generatedAssetPromotedPathToUrl("public/assets/generated/../../x.png")).toBeNull();
      expect(generatedAssetPromotedPathToUrl("public/assets/generated/%2e%2e/x.png")).toBeNull();
    });
  });
  describe("retired numbered enemy art", () => {
    it("preserves species for named legacy IDs and refuses unidentifiable numbers", () => {
      expect(resolveGeneratedAssetResourceUrl("generated-enemy-slime-01-enemy_extra_06")).toBe("/assets/generated/pixel-enemy-portraits/slime.png");
      expect(resolveGeneratedAssetResourceUrl("generated-enemy-zombie-01-enemy_extra_016")).toBe("/assets/generated/pixel-enemy-portraits/zombie-01.png");
      expect(resolveGeneratedAssetResourceUrl("enemy_extra_6")).toBeNull();
      expect(resolveGeneratedAssetResourceUrl("legacy-enemy_extra_105")).toBeNull();
      expect(resolveGeneratedAssetResourceUrl("generated-enemy-unknown-slime")).toBeNull();
      expect(generatedAssetPromotedPathToUrl("public/assets/generated/monsters/enemy-art-006.png")).toBeNull();
      expect(generatedAssetPromotedPathToUrl("public/assets/generated/starter/monster-slime-01.png")).toBe("/assets/generated/pixel-enemy-portraits/slime.png");
    });
  });
  afterEach(() => setUploadedAssetResolver(null));
  describe("persisted uploaded resource references", () => {
    it.each(["monster", "picture", "music"] as const)("resolves ref-only %s after SQLite reopen", kind => {
      const project = createBlankProject();
      const ref = { sha256: "a".repeat(64), mime: "image/png", bytes: 100, extension: "png" };
      project.assets.uploaded.persisted = { id: "persisted", name: "persisted", kind, ref, meta: {} };
      setUploadedAssetResolver({ url: () => "/__oprn/assets/persisted.png", bytes: async () => new Uint8Array() });
      expect(resolveAssetResourceUrl("persisted", { project })).toBe("/__oprn/assets/persisted.png");
      setUploadedAssetResolver(null);
      expect(resolveAssetResourceUrl("persisted", { project })).toBeNull();
    });
  });
});
