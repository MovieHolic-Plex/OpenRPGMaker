import { describe, expect, it, afterEach, vi } from "vitest";
import { setUploadedAssetResolver, uploadedAssetBytes, uploadedAssetMime, uploadedAssetUrl } from "@/project/persistence/assetAccessors";
import type { UploadedAsset, Project, BattleAnimationRecord } from "@/project/types";
import { registerExportAssetBase } from "@/assets/inlineAssetStore";
import { installExportUploadedAssets } from "@/player/exportUploadedAssets";
import { webUploadedAssetPath } from "@/project/webUploadedAssetPath";
import { generatedAssetPromotedPathToUrl, resolveAssetResourceUrl, resolveEasyRpgRuntimeAssetUrl, resolveGeneratedAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { GENERATED_ASSET_PLAN } from "@/assets/oprnGeneratedAssetPlan";
import { createBlankProject } from "@/project/defaults";
import type { GeneratedAssetManifest } from "@/assets/generatedAssetManifest";
import { isolateTimers } from "./mergedTeardown";
import { crc32, deflateRawSync } from "node:zlib";
import { assetPageUrl } from "@/editor/assetBrowser/assetPageAllowlist";
import { lookupPackCatalog, type PackCatalogEntry } from "@/editor/assetBrowser/packCatalog";
import { extractPackImage, listPackImages, suggestPackImage } from "@/editor/assetBrowser/packImages";
import { createHash } from "node:crypto";
import { STORE_ANIMATION_EASYRPG_SOUNDS, storeBattleAnimationSizeProblems, storeProjectId, validateManifest, type StorePackManifest, STORE_PACK_SCHEMA, STORE_ICON_SIZE, storeImageSizeProblem, storeMonsterSheetSizeProblems, type StoreCatalogPage, type StoreItemSummary } from "@/assetStore/format";
import { EASYRPG_SOUND_ASSETS } from "@/assets/easyrpgRtp";
import { applyPackToProject, storeAnimationId, storeAppearanceId, basicTilesetFor, buildPack, encodePackBundle, packBlockedItems, type PackMeta, closeSelection, type ApplyContext, type BuiltPack } from "@/assetStore/pack";
import { pngSize, bytesToBase64 } from "@/assetStore/sniff";
import { battleAnimationChainDurationMs, battleAnimationDurationMs, battleAnimationFrameAtUnits } from "@/battle/animationTiming";
import { captureStoreAdd, removeStoreItem, storeAddKeys, undoStoreAdd, removeStaleStoreAssets, staleStoreAssetIds, storeItemUsages } from "@/editor/assetStore/storeUndo";
import { normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import { collectUsedUploadedAssetIds } from "@/project/webExportAssets";
import { appearancePortraitForEmotion, faceForDialogueEmotion, resolveAppearancePortrait } from "@/project/characterAppearances";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findStoreDeepLinkArg, parseStoreDeepLink } from "@/assetStore/deepLink";
import { AssetStoreClient, bundleUnsupportedStatus } from "../electron/main/assetStoreClient";
import { subsetAudioManifest } from "@/assetStore/storeSoundPick";
import { inferIconElement, planIconAssignments, rankStoreIcons, readStoreIconMeta, projectStoreIcons } from "@/assetStore/storeIconPick";
import { addStoreProfiles } from "@/editor/assetStore/storeProfiles";
import { uploadedMatchesKind } from "@/editor/resourceOptions";
import { DB_TOOLS } from "@/editor/tools/dbTools";
import { STORE_ICON_TOOLS } from "@/editor/tools/storeIconTools";
import { normalizeSkillRecord, normalizeStateRecord } from "@/project/databaseRecordModel";
import { validateProjectReferences } from "@/project/io/references";
import { monsterBattleMotion, pixelEnemyCell, projectPixelEnemySheet } from "@/assets/pixelEnemySheets";
import { isAuthoredMonsterAsset } from "@/editor/tools/enemyPixelSheetTools";
import { parseStoreQuery, searchStoreCatalog } from "@/assetStore/storeQuery";
import { humanStoreError, landedLines, landedSummary } from "@/editor/assetStore/storeText";

describe("assetAccessors", () => {
  isolateTimers();
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
});

describe("assetSourceBrowser", () => {
  isolateTimers();
  describe("pack catalog", () => {
    const entry: PackCatalogEntry = {
      zipSha256: "abc",
      entryName: "Tilemap/city.png",
      tileSize: 32,
      name: "일본 거리",
      pageUrl: "https://guttykreum.itch.io/free-japanese-city-game-assets",
    };

    it("uses a learned zip hash and ignores any other hash", () => {
      expect(lookupPackCatalog("abc", [entry])?.tileSize).toBe(32);
      expect(lookupPackCatalog("other", [entry])).toBeNull();
    });
  });
  describe("asset page allowlist", () => {
    it("allows itch pages and their file host", () => {
      expect(assetPageUrl("https://guttykreum.itch.io/free-japanese-city-game-assets")?.hostname).toBe("guttykreum.itch.io");
      expect(assetPageUrl("https://img.itch.zone/a/original.png")?.hostname).toBe("img.itch.zone");
    });

    it("rejects other origins", () => {
      expect(assetPageUrl("http://guttykreum.itch.io/pack")).toBeNull();
      expect(assetPageUrl("https://evil.com/itch.io")).toBeNull();
      expect(assetPageUrl("https://itch.io.evil.com/pack")).toBeNull();
      expect(assetPageUrl("https://user:pass@itch.io/pack")).toBeNull();
    });
  });
  describe("pack images", () => {
    it("picks the sheet and leaves singles out of the suggestion", async () => {
      const sheet = png(256, 128);
      const single = png(32, 32);
      const bytes = zip([
        { name: "Tilemap/city.png", data: sheet },
        { name: "tiles/lamp.png", data: single },
        { name: "../escape.png", data: sheet },
        { name: "Unity.unitypackage", data: Buffer.from("nope") },
      ]);
      const images = await listPackImages("city.zip", bytes);
      expect(images.map((image) => image.name)).toEqual(["Tilemap/city.png", "tiles/lamp.png"]);
      expect(images.map((image) => image.role)).toEqual(["tilemap", "single"]);
      expect(suggestPackImage(images)?.name).toBe("Tilemap/city.png");
      expect(Buffer.from(await extractPackImage("city.zip", bytes, "Tilemap/city.png"))).toEqual(sheet);
    });
  });
  function png(width: number, height: number): Buffer {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    const type = Buffer.from("IHDR");
    const length = Buffer.alloc(4);
    length.writeUInt32BE(ihdr.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(Buffer.concat([type, ihdr])) >>> 0);
    return Buffer.concat([signature, length, type, ihdr, checksum]);
  }
  function zip(files: readonly { readonly name: string; readonly data: Buffer }[]): Uint8Array {
    const locals: Buffer[] = [];
    const centrals: Buffer[] = [];
    let offset = 0;
    for (const file of files) {
      const name = Buffer.from(file.name);
      const compressed = deflateRawSync(file.data);
      const checksum = crc32(file.data) >>> 0;
      const local = Buffer.concat([
        u32(0x04034b50), u16(20), u16(0), u16(8), u16(0), u16(0),
        u32(checksum), u32(compressed.length), u32(file.data.length),
        u16(name.length), u16(0), name, compressed,
      ]);
      const central = Buffer.concat([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(8), u16(0), u16(0),
        u32(checksum), u32(compressed.length), u32(file.data.length),
        u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name,
      ]);
      offset += local.length;
      locals.push(local);
      centrals.push(central);
    }
    const centralDir = Buffer.concat(centrals);
    const eocd = Buffer.concat([
      u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
      u32(centralDir.length), u32(offset), u16(0),
    ]);
    return new Uint8Array(Buffer.concat([...locals, centralDir, eocd]));
  }
  function u16(value: number): Buffer {
    const bytes = Buffer.alloc(2);
    bytes.writeUInt16LE(value);
    return bytes;
  }
  function u32(value: number): Buffer {
    const bytes = Buffer.alloc(4);
    bytes.writeUInt32LE(value >>> 0);
    return bytes;
  }
});

describe("assetStore", () => {
  isolateTimers();
  // 스토어 전투 애니메이션(content.battleAnimations): 매니페스트 검사 → 넣기(id 바꾸기·덮지 않기·다시 넣기) → 되돌리기 → 웹 내보내기 포함 → 프레임 hold 길이.
  describe("assetStoreBattleAnimations", () => {
    isolateTimers();
    function png(width: number, height: number, salt = 0): Uint8Array {
      const bytes = new Uint8Array(33 + salt);
      bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
      const view = new DataView(bytes.buffer);
      view.setUint32(16, width);
      view.setUint32(20, height);
      return bytes;
    }
    function ogg(salt: number): Uint8Array {
      const bytes = new Uint8Array(40 + salt);
      bytes.set([0x4f, 0x67, 0x67, 0x53]);
      return bytes;
    }
    const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
    const cell = (pattern: number) => ({ pattern, x: 0, y: 0, zoom: 100, opacity: 255, visible: true });
    function pack(patch: (records: BattleAnimationRecord[]) => void = () => {}, sheetBytes = png(384, 192, 1)): { manifest: StorePackManifest; blobs: Map<string, Uint8Array> } {
      const sound = ogg(2);
      const blobs = new Map([[sha(sheetBytes), sheetBytes], [sha(sound), sound]]);
      const records: BattleAnimationRecord[] = [
        {
          id: "fire-burst", name: "Fire burst", resourceId: "fx-sheet", sheet: { frameWidth: 96, frameHeight: 96, columns: 4, assetScale: 2 },
          scope: "singleTarget", position: "center", blendMode: "add",
          frames: [{ cells: [cell(0)] }, { cells: [cell(1)] }, { cells: [cell(2)], hold: 3 }, { cells: [cell(3)] }],
          timings: [{ frameIndex: 2, soundResourceId: "boom", flash: { target: "target", color: { red: 255, green: 160, blue: 64, gray: 0 }, durationFrames: 3 } }],
          followUps: [{ animationId: "smoke", startFrame: 3 }],
        },
        {
          id: "smoke", name: "Smoke", resourceId: "fx-sheet", sheet: { frameWidth: 96, frameHeight: 96, columns: 4 },
          frames: [{ cells: [cell(4)] }, { cells: [cell(5)] }],
          timings: [{ frameIndex: 0, soundResourceId: "cc0-se-osx-gong-01" }],
        },
      ];
      patch(records);
      const manifest: StorePackManifest = {
        schema: "oprn-store-pack/1", title: "Fire FX", summary: "", description: "", tags: [], kind: "animation", license: "CC0", aiGenerated: false, credits: "",
        content: {
          assets: {
            "fx-sheet": { id: "fx-sheet", name: "Fire sheet", kind: "battle", blob: sha(sheetBytes), mime: "image/png", meta: { width: 384, height: 192 } },
            boom: { id: "boom", name: "Boom", kind: "sound", blob: sha(sound), mime: "audio/ogg", meta: {} },
          },
          tilesets: {},
          battleAnimations: records,
        },
        previews: [sha(sheetBytes)],
        blobs: [...blobs].map(([key, bytes]) => ({ sha256: key, mime: key === sha(sound) ? "audio/ogg" as const : "image/png" as const, bytes: bytes.byteLength })),
      };
      return { manifest, blobs };
    }
    const context = (blobs: Map<string, Uint8Array>) => ({ slug: "fire-fx", version: 1, author: "OPRN", storeUrl: "https://store.example", itemUrl: "https://store.example/items/fire-fx", blob: (key: string) => blobs.get(key)! });
    const errorsOf = (m: StorePackManifest): string => { const r = validateManifest(m); return r.ok ? "" : r.errors.join(" | "); };
    describe("store battle animations — manifest", () => {
      it("accepts a valid animation pack", () => {
        expect(errorsOf(pack().manifest)).toBe("");
      });

      it("accepts bundled EasyRPG sound ids exactly", () => {
        expect(errorsOf(pack((r) => { r[0]!.timings![0]!.soundResourceId = "easyrpg-sound-fire1"; }).manifest)).toBe("");
        expect(errorsOf(pack((r) => { r[0]!.timings![0]!.soundResourceId = "easyrpg-sound-wind8"; }).manifest)).toBe("");
      });

      it("keeps the EasyRPG sound list equal to the bundled catalog", () => {
        expect([...STORE_ANIMATION_EASYRPG_SOUNDS].sort()).toEqual(EASYRPG_SOUND_ASSETS.map((asset) => asset.id).sort());
      });

      it("rejects bad shapes and references", () => {
        expect(errorsOf(pack((r) => { r[0]!.resourceId = "boom"; }).manifest)).toContain("resourceId");
        expect(errorsOf(pack((r) => { r[0]!.resourceId = "missing"; }).manifest)).toContain("resourceId");
        expect(errorsOf(pack((r) => { r[0]!.sheet = { frameWidth: 4, frameHeight: 96, columns: 4 }; }).manifest)).toContain("sheet");
        expect(errorsOf(pack((r) => { r[0]!.frames = []; }).manifest)).toContain("프레임");
        expect(errorsOf(pack((r) => { r[0]!.frames![0]!.cells[0]!.zoom = 0; }).manifest)).toContain("셀");
        expect(errorsOf(pack((r) => { r[0]!.frames![0]!.cells[0]!.x = 1.5; }).manifest)).toContain("셀");
        expect(errorsOf(pack((r) => { r[0]!.frames![0]!.hold = 17; }).manifest)).toContain("hold");
        expect(errorsOf(pack((r) => { r[0]!.timings![0]!.frameIndex = 4; }).manifest)).toContain("frameIndex");
        expect(errorsOf(pack((r) => { r[0]!.timings![0]!.soundResourceId = "fx-sheet"; }).manifest)).toContain("소리");
        expect(errorsOf(pack((r) => { r[0]!.timings![0]!.soundResourceId = "easyrpg-sound-fire99"; }).manifest)).toContain("소리");
        expect(errorsOf(pack((r) => { r[0]!.timings![0]!.soundResourceId = "easyrpg-sound-"; }).manifest)).toContain("소리");
        expect(errorsOf(pack((r) => { r[0]!.timings![0]!.soundResourceId = "easyrpg-sound-fire1 "; }).manifest)).toContain("소리");
        expect(errorsOf(pack((r) => { r[0]!.followUps = [{ animationId: "fire-burst", startFrame: 0 }]; }).manifest)).toContain("followUp");
        expect(errorsOf(pack((r) => { r[0]!.followUps = [{ animationId: "nope", startFrame: 0 }]; }).manifest)).toContain("followUp");
        expect(errorsOf(pack((r) => { r[1]!.id = "fire-burst"; }).manifest)).toContain("두 번");
        expect(errorsOf(pack((r) => { r[0]!.scope = "everyone" as never; }).manifest)).toContain("scope");
        expect(errorsOf(pack((r) => { (r[0] as unknown as Record<string, unknown>).script = "x"; }).manifest)).toContain("모르는");
        expect(errorsOf(pack((r) => { for (let i = 0; i < 70; i += 1) r.push({ ...structuredClone(r[1]!), id: `extra-${i}` }); }).manifest)).toContain("64");
      });

      it("checks sheet geometry against the PNG", () => {
        const ok = pack();
        expect(storeBattleAnimationSizeProblems(ok.manifest, (key) => pngSize(ok.blobs.get(key)!))).toEqual([]);
        const narrow = pack(undefined, png(380, 192, 3));
        expect(storeBattleAnimationSizeProblems(narrow.manifest, (key) => pngSize(narrow.blobs.get(key)!)).join()).toContain("384");
        const pattern = pack((r) => { r[1]!.frames![0]!.cells[0]!.pattern = 8; });
        expect(storeBattleAnimationSizeProblems(pattern.manifest, (key) => pngSize(pattern.blobs.get(key)!)).join()).toContain("pattern 8");
        expect(() => applyPackToProject(createBlankProject(), narrow.manifest, context(narrow.blobs))).toThrow("384");
      });
    });
    describe("store battle animations — install", () => {
      it("inserts records with remapped ids and keeps them across reinstall", () => {
        const { manifest, blobs } = pack();
        const project = createBlankProject();
        const before = project.database.battleAnimations.length;
        const result = applyPackToProject(project, manifest, context(blobs));
        const burstId = storeAnimationId("fire-fx", "fire-burst");
        expect(burstId).toBe("store_fire_fx__anim-fire-burst");
        expect(result.addedAnimationIds).toEqual([burstId, storeAnimationId("fire-fx", "smoke")]);
        expect(project.database.battleAnimations).toHaveLength(before + 2);
        const burst = project.database.battleAnimations.find((r) => r.id === burstId)!;
        expect(burst.resourceId).toBe(storeProjectId("fire-fx", "fx-sheet"));
        expect(burst.timings![0]!.soundResourceId).toBe(storeProjectId("fire-fx", "boom"));
        expect(burst.followUps![0]!.animationId).toBe(storeAnimationId("fire-fx", "smoke"));
        expect(project.database.battleAnimations.find((r) => r.id === storeAnimationId("fire-fx", "smoke"))!.timings![0]!.soundResourceId).toBe("cc0-se-osx-gong-01");
        expect(project.assets.uploaded[burst.resourceId!]?.kind).toBe("battle");
        // 넣은 뒤 저자가 고친 이름은 다시 넣어도 그대로 — 레코드는 덮지 않는다.
        burst.name = "My fire";
        const again = applyPackToProject(project, manifest, context(blobs));
        expect(again.addedAnimationIds).toEqual([]);
        expect(again.animationIds).toEqual(result.animationIds);
        expect(project.database.battleAnimations).toHaveLength(before + 2);
        expect(project.database.battleAnimations.find((r) => r.id === burstId)!.name).toBe("My fire");
        // 정규화를 거쳐도 hold 가 남는다(저장·불러오기 경로).
        expect(normalizeBattleAnimationRecord(burst).frames![2]!.hold).toBe(3);
        expect(normalizeBattleAnimationRecord(burst).frames![0]).not.toHaveProperty("hold");
      });

      it("does not touch a pre-existing record with the same id", () => {
        const { manifest, blobs } = pack();
        const project = createBlankProject();
        const id = storeAnimationId("fire-fx", "smoke");
        project.database.battleAnimations.push({ id, name: "Hand made", frames: [] });
        applyPackToProject(project, manifest, context(blobs));
        expect(project.database.battleAnimations.filter((r) => r.id === id)).toEqual([{ id, name: "Hand made", frames: [] }]);
      });

      it("undo and remove take the records out; a skill using one blocks removal", () => {
        const { manifest, blobs } = pack();
        const project = createBlankProject();
        const before = structuredClone(project.database.battleAnimations);
        const snapshot = captureStoreAdd(project, storeAddKeys(manifest, "fire-fx"));
        applyPackToProject(project, manifest, context(blobs));
        expect(undoStoreAdd(project, snapshot)).toEqual({ ok: true });
        expect(project.database.battleAnimations).toEqual(before);
        applyPackToProject(project, manifest, context(blobs));
        const skill = project.database.skills[0]!;
        skill.animationId = storeAnimationId("fire-fx", "fire-burst");
        expect(removeStoreItem(project, "fire-fx")).toMatchObject({ ok: false });
        delete skill.animationId;
        expect(removeStoreItem(project, "fire-fx")).toMatchObject({ ok: true });
        expect(project.database.battleAnimations.some((r) => r.id.startsWith("store_fire_fx__"))).toBe(false);
      });

      it("web export ships the sheet and pack sound once installed", () => {
        const { manifest, blobs } = pack();
        const project: Project = createBlankProject();
        applyPackToProject(project, manifest, context(blobs));
        const used = collectUsedUploadedAssetIds(project);
        expect(used.has(storeProjectId("fire-fx", "fx-sheet"))).toBe(true);
        expect(used.has(storeProjectId("fire-fx", "boom"))).toBe(true);
      });
    });
    describe("battle animation frame hold", () => {
      const base = (holds: (number | undefined)[]): BattleAnimationRecord => ({ id: "a", name: "a", frames: holds.map((hold) => ({ cells: [cell(0)], ...(hold ? { hold } : {}) })) });

      it("leaves records without hold unchanged", () => {
        expect(battleAnimationDurationMs(base([undefined, undefined, undefined]))).toBe(360);
        expect(battleAnimationFrameAtUnits(base([undefined, undefined, undefined]), 0, 2)).toBe(2);
        expect(battleAnimationFrameAtUnits(base([undefined, undefined, undefined]), 1, 1)).toBe(2);
      });

      it("stretches duration, frame lookup and follow-up start", () => {
        const record = base([undefined, 3, undefined]);
        expect(battleAnimationDurationMs(record)).toBe(5 * 120);
        expect([0, 1, 2, 3, 4, 5].map((units) => battleAnimationFrameAtUnits(record, 0, units))).toEqual([0, 1, 1, 1, 2, 3]);
        expect(battleAnimationFrameAtUnits(record, 1, 2)).toBe(1);
        expect(battleAnimationFrameAtUnits(record, 1, 3)).toBe(2);
        const follow = { ...base([undefined]), id: "b" };
        expect(battleAnimationChainDurationMs({ ...record, followUps: [{ animationId: "b", startFrame: 2 }] }, [follow])).toBe(Math.max(600, 4 * 120 + 120));
      });
    });
  });
  describe("assetStoreCharacterPortraits", () => {
    isolateTimers();
    function png(width: number, height: number, salt: number): Uint8Array {
      const bytes = new Uint8Array(33 + salt);
      bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
      const view = new DataView(bytes.buffer);
      view.setUint32(16, width);
      view.setUint32(20, height);
      return bytes;
    }
    const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
    /** A char-gen style pack: one charset sheet, a face, bust/full for base + happy, and one extra expression. */
    function characterPack() {
      const files: Record<string, Uint8Array> = {
        sheet: png(288, 256, 0), face: png(48, 48, 1), bustBase: png(680, 770, 2), bustHappy: png(680, 770, 3),
        fullBase: png(280, 825, 4), fullHappy: png(280, 825, 5), bustThinking: png(680, 770, 6),
      };
      const blobs = new Map(Object.entries(files).map(([, bytes]) => [sha(bytes), bytes]));
      const asset = (id: string, kind: "charset" | "faceset" | "picture", key: string) => ({
        id, name: id, kind, blob: sha(files[key]!), mime: "image/png" as const, meta: { width: 1, height: 1 },
      });
      const manifest: StorePackManifest = {
        schema: STORE_PACK_SCHEMA, title: "약초상 세트", summary: "칩과 초상", description: "", tags: [], kind: "character",
        license: "CC-BY-4.0", aiGenerated: true, credits: "char-gen; base: Scarloxy (CC BY 4.0)",
        content: {
          assets: {
            cg_sheet: asset("cg_sheet", "charset", "sheet"), cg_face: asset("cg_face", "faceset", "face"),
            cg_bb: asset("cg_bb", "picture", "bustBase"), cg_bh: asset("cg_bh", "picture", "bustHappy"),
            cg_fb: asset("cg_fb", "picture", "fullBase"), cg_fh: asset("cg_fh", "picture", "fullHappy"),
            cg_bt: asset("cg_bt", "picture", "bustThinking"),
          },
          tilesets: {},
          characters: [{
            asset: "cg_sheet", characterIndex: 0, label: "약초상", appearance: "보라 머리 약초상",
            portraits: { face: "cg_face", bust: { base: "cg_bb", happy: "cg_bh" }, full: { base: "cg_fb", happy: "cg_fh" }, extra: { thinking: { bust: "cg_bt" } } },
          }],
        },
        // 그림이 든 팩은 미리보기가 1장 이상이어야 한다(src/assetStore/format.ts validateManifest) — 칩 시트를 쓴다.
        previews: [sha(files.sheet!)],
        blobs: [...blobs].map(([hash, bytes]) => ({ sha256: hash, mime: "image/png" as const, bytes: bytes.byteLength })),
      };
      return { manifest, blobs };
    }
    // 되돌리기 검사(storeItemUsages)가 맵을 훑는다 — 빈 맵 목록을 준다.
    const target = () => ({ maps: {}, tilesets: {}, assets: { uploaded: {} }, resourceProfiles: [], database: { characterAppearances: [] } }) as unknown as Project;
    describe("store character packs with paired portraits (char-gen)", () => {
      it("validates the portrait references", () => {
        const { manifest } = characterPack();
        expect(validateManifest(manifest).ok).toBe(true);
        const noBase = structuredClone(manifest);
        delete noBase.content.characters![0]!.portraits!.bust!.base;
        const r1 = validateManifest(noBase);
        expect(r1.ok).toBe(false);
        if (!r1.ok) expect(r1.errors.join()).toContain("기본(base)");
        const wrongKind = structuredClone(manifest);
        wrongKind.content.characters![0]!.portraits!.face = "cg_bb";
        expect(validateManifest(wrongKind).ok).toBe(false);
        const badName = structuredClone(manifest);
        (badName.content.characters![0]!.portraits!.bust as Record<string, string>).grin = "cg_bh";
        expect(validateManifest(badName).ok).toBe(false);
      });

      it("installs an appearance that pairs the chip with face, bust, full and the expression map, and undoes it", () => {
        const { manifest, blobs } = characterPack();
        const project = target();
        const keys = storeAddKeys(manifest, "herbalist");
        const snapshot = captureStoreAdd(project, keys);
        applyPackToProject(project, manifest, {
          slug: "herbalist", version: 1, author: "테스터", storeUrl: "https://store.example", itemUrl: "https://store.example/items/herbalist",
          blob: (hash) => blobs.get(hash)!,
        });
        const id = storeAppearanceId("herbalist", "cg_sheet", 0);
        const record = project.database.characterAppearances!.find((entry) => entry.id === id)!;
        const pid = (x: string) => storeProjectId("herbalist", x);
        expect(record).toMatchObject({
          name: "약초상", charset: { resourceId: pid("cg_sheet"), characterIndex: 0 }, face: { resourceId: pid("cg_face") },
          bust: { resourceId: pid("cg_bb") }, full: { resourceId: pid("cg_fb") },
          portraitExpressions: { bust: { base: pid("cg_bb"), happy: pid("cg_bh") }, full: { base: pid("cg_fb"), happy: pid("cg_fh") } },
        });
        expect(resolveAppearancePortrait(project, id, "full")?.resourceId).toBe(pid("cg_fb"));
        expect(appearancePortraitForEmotion(project, pid("cg_bb"), "happy")).toBe(pid("cg_bh"));
        expect(appearancePortraitForEmotion(project, pid("cg_bh"), "angry")).toBe(pid("cg_bb"));
        expect(appearancePortraitForEmotion(project, pid("cg_fb"), "happy", "bust")).toBe(pid("cg_bh"));
        expect(faceForDialogueEmotion(project, pid("cg_fb"), "happy", undefined)).toBe(pid("cg_fh"));
        expect(faceForDialogueEmotion(project, "not-paired", "happy", undefined)).toBe("not-paired");
        expect(undoStoreAdd(project, snapshot)).toEqual({ ok: true });
        expect(project.database.characterAppearances).toEqual([]);
        expect(project.assets.uploaded).toEqual({});
      });
    });
  });
  describe("assetStoreDeepLink", () => {
    isolateTimers();
    const STORE = "https://store.openrpgmaker.com";
    const link = (query: string, base = "oprn://store/install") => `${base}?${query}`;
    const storeParam = `store=${encodeURIComponent(STORE)}`;
    describe("store deep link parser", () => {
      it("accepts the store website link with and without a version", () => {
        expect(parseStoreDeepLink(link(`${storeParam}&slug=demo-crate-c7964203&version=2`), STORE)).toEqual({ ok: true, slug: "demo-crate-c7964203", version: 2 });
        expect(parseStoreDeepLink(link(`${storeParam}&slug=demo-crate-c7964203`), STORE)).toEqual({ ok: true, slug: "demo-crate-c7964203" });
        expect(parseStoreDeepLink(link(`${storeParam}&slug=demo-crate-c7964203&version=`), STORE)).toEqual({ ok: true, slug: "demo-crate-c7964203" });
      });

      it("accepts the host-less spellings of the same route", () => {
        for (const base of ["oprn:store/install", "oprn:///store/install", "oprn://store/install/", "OPRN://Store/Install"]) {
          expect(parseStoreDeepLink(link(`${storeParam}&slug=forest-pack`, base), STORE)).toEqual({ ok: true, slug: "forest-pack" });
        }
      });

      it("compares the store origin, not the full address", () => {
        expect(parseStoreDeepLink(link(`store=${encodeURIComponent(`${STORE}/items/x`)}&slug=forest-pack`), `${STORE}/`)).toEqual({ ok: true, slug: "forest-pack" });
      });

      it("refuses links that name another store, never installing from the host in the link", () => {
        const reason = "다른 스토어 주소의 링크라 열지 않았습니다.";
        for (const store of ["https://evil.example", "http://store.openrpgmaker.com", "https://store.openrpgmaker.com:8443", "https://store.openrpgmaker.com.evil.example", "file:///etc/passwd", "javascript:alert(1)", ""]) {
          expect(parseStoreDeepLink(link(`store=${encodeURIComponent(store)}&slug=forest-pack`), STORE)).toEqual({ ok: false, reason });
        }
        expect(parseStoreDeepLink(link("slug=forest-pack"), STORE)).toEqual({ ok: false, reason });
        expect(parseStoreDeepLink(link(`${storeParam}&slug=forest-pack`), "not a url")).toEqual({ ok: false, reason });
      });

      it("refuses bad slugs, versions, routes and schemes", () => {
        for (const slug of ["Forest-Pack", "a--b", "-forest", "forest-", "ab", "a".repeat(65), "forest_pack", "../x", "%2e%2e"]) {
          expect(parseStoreDeepLink(link(`${storeParam}&slug=${slug}`), STORE).ok).toBe(false);
        }
        for (const version of ["0", "-1", "1.5", "01", "1e3", "abc", "99999999999999999"]) {
          expect(parseStoreDeepLink(link(`${storeParam}&slug=forest-pack&version=${version}`), STORE).ok).toBe(false);
        }
        expect(parseStoreDeepLink(link(`${storeParam}&slug=forest-pack`, "oprn://store/uninstall"), STORE).ok).toBe(false);
        expect(parseStoreDeepLink(link(`${storeParam}&slug=forest-pack`, "oprn://project/open"), STORE).ok).toBe(false);
        expect(parseStoreDeepLink(link(`${storeParam}&slug=forest-pack`, "https://store/install"), STORE).ok).toBe(false);
        expect(parseStoreDeepLink(link(`${storeParam}&slug=forest-pack&slug=other-pack`), STORE).ok).toBe(false);
        expect(parseStoreDeepLink("oprn://user:pw@store/install?" + `${storeParam}&slug=forest-pack`, STORE).ok).toBe(false);
        expect(parseStoreDeepLink(`oprn://store/install?${storeParam}&slug=forest-pack&pad=${"x".repeat(3000)}`, STORE).ok).toBe(false);
        expect(parseStoreDeepLink("", STORE).ok).toBe(false);
      });

      it("finds the link among process arguments", () => {
        expect(findStoreDeepLinkArg(["/opt/OPRN/oprn", "--no-sandbox", "oprn://store/install?slug=x"])).toBe("oprn://store/install?slug=x");
        expect(findStoreDeepLinkArg(["/opt/OPRN/oprn", "."])).toBeNull();
      });
    });
    describe("store bundle fallback for owner drafts", () => {
      it("treats 404 as an old server only for public items", () => {
        expect(bundleUnsupportedStatus(405, "pending")).toBe(true);
        expect(bundleUnsupportedStatus(501, "visible")).toBe(true);
        expect(bundleUnsupportedStatus(404, "visible")).toBe(true);
        expect(bundleUnsupportedStatus(404, undefined)).toBe(true);
        expect(bundleUnsupportedStatus(404, "pending")).toBe(false);
        expect(bundleUnsupportedStatus(404, "hidden")).toBe(false);
        expect(bundleUnsupportedStatus(200, "visible")).toBe(false);
      });
    });
    function png(width: number, height: number, salt = 0): Uint8Array {
      const bytes = new Uint8Array(33 + salt);
      bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
      const view = new DataView(bytes.buffer);
      view.setUint32(16, width);
      view.setUint32(20, height);
      return bytes;
    }
    const dataUrl = (bytes: Uint8Array) => `data:image/png;base64,${bytesToBase64(bytes)}`;
    const sha256 = async (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
    const readAsset = async (asset: UploadedAsset) => Uint8Array.from(Buffer.from(asset.dataUrl!.split(",")[1]!, "base64"));
    const META: PackMeta = { title: "내 초안 팩", summary: "초안", description: "", tags: [], kind: "tileset", license: "CC-BY-4.0", aiGenerated: false, credits: "" };
    function authorProject(): Project {
      const sheet = png(64, 32);
      return {
        tilesets: { forest: { ...basicTilesetFor("sheet", "숲 칩셋", 64, 32, 16), id: "forest" } },
        assets: { uploaded: { sheet: { id: "sheet", name: "숲 시트", kind: "chipset", dataUrl: dataUrl(sheet), meta: { width: 64, height: 32, tileSize: 16 } } } },
      } as unknown as Project;
    }
    async function draftServer(): Promise<{ bundle: Uint8Array; manifest: unknown; blobs: Map<string, Uint8Array> }> {
      const built = await buildPack(authorProject(), { tilesetIds: ["forest"], assetIds: [] }, META, { readAsset, sha256 });
      const blobs = new Map([...built.blobs].map(([sha, blob]) => [sha, blob.bytes]));
      return { bundle: encodePackBundle(built.manifest, (sha) => blobs.get(sha)!), manifest: built.manifest, blobs };
    }
    async function withFetch<T>(respond: (url: string, init: RequestInit) => Response, work: (requests: { url: string; auth: string | null }[]) => Promise<T>): Promise<T> {
      const original = globalThis.fetch;
      const requests: { url: string; auth: string | null }[] = [];
      globalThis.fetch = (async (url: string | URL, init: RequestInit = {}) => {
        requests.push({ url: String(url), auth: new Headers(init.headers).get("authorization") });
        return respond(String(url), init);
      }) as typeof fetch;
      try { return await work(requests); } finally { globalThis.fetch = original; }
    }
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    const detail = (status: string) => ({ slug: "my-draft-pack", title: "내 초안 팩", kind: "tileset", grade: "single", license: "CC-BY-4.0", aiGenerated: false, author: "나", cover: null, latestVersion: 1, status });
    describe("owner drafts (D2)", () => {
      it("installs the owner's pending item through /bundle with the login token and marks it a draft", async () => {
        const root = mkdtempSync(join(tmpdir(), "oprn-store-draft-"));
        const { bundle } = await draftServer();
        try {
          await withFetch((url, init) => {
            const authed = new Headers(init.headers).get("authorization") === "Bearer owner-token";
            if (url.endsWith("/bundle")) return authed ? new Response(bundle as BodyInit, { status: 200 }) : json({ message: "없음" }, 404);
            if (url.endsWith("/downloads")) return json({});
            return authed ? json(detail("pending")) : json({ message: "없음" }, 404);
          }, async (requests) => {
            const client = new AssetStoreClient(root, { load: () => "owner-token", save: () => undefined, persistent: () => false }, "https://store.example.com");
            const record = await client.install("my-draft-pack", () => undefined);
            expect(record.draft).toBe(true);
            expect(client.installed()[0]!.draft).toBe(true);
            expect(requests.find((request) => request.url.endsWith("/bundle"))!.auth).toBe("Bearer owner-token");
            const pkg = await client.packageFor("my-draft-pack");
            expect(pkg.version).toBe(1);
          });
        } finally { rmSync(root, { recursive: true, force: true }); }
      });

      it("does not turn /bundle off for the whole run when only a pending item 404s, and drops the draft mark once public", async () => {
        const root = mkdtempSync(join(tmpdir(), "oprn-store-draft-"));
        const { bundle, manifest, blobs } = await draftServer();
        let status = "pending";
        try {
          await withFetch((url) => {
            if (url.endsWith("/bundle")) return status === "pending" ? json({ message: "없음" }, 404) : new Response(bundle as BodyInit, { status: 200 });
            if (url.endsWith("/manifest")) return json(manifest);
            if (url.includes("/api/v1/blobs/")) return new Response(blobs.get(url.split("/").pop()!)! as BodyInit, { status: 200 });
            if (url.endsWith("/downloads")) return json({});
            return json(detail(status));
          }, async (requests) => {
            const client = new AssetStoreClient(root, { load: () => "owner-token", save: () => undefined, persistent: () => false }, "https://store.example.com");
            const first = await client.install("my-draft-pack", () => undefined);
            expect(first.draft).toBe(true);
            status = "visible";
            expect(await client.refreshDrafts()).toBe(true);
            expect(client.installed()[0]!.draft).toBeUndefined();
            await client.install("my-draft-pack", () => undefined);
            expect(requests.filter((request) => request.url.endsWith("/bundle"))).toHaveLength(2);
            expect(requests.filter((request) => request.url.endsWith("/manifest"))).toHaveLength(1);
            expect(client.installed()[0]!.draft).toBeUndefined();
          });
        } finally { rmSync(root, { recursive: true, force: true }); }
      });

      it("keeps store origin on an applied draft, so it cannot be re-uploaded or shared", async () => {
        const { manifest, blobs } = await draftServer();
        const target = { tilesets: {}, assets: { uploaded: {} } } as unknown as Project;
        applyPackToProject(target, manifest as Parameters<typeof applyPackToProject>[1], {
          slug: "my-draft-pack", version: 1, author: "나", storeUrl: "https://store.example.com", itemUrl: "https://store.example.com/items/my-draft-pack", blob: (sha) => blobs.get(sha)!,
        });
        const tilesetId = storeProjectId("my-draft-pack", "forest");
        const sheetId = storeProjectId("my-draft-pack", "sheet");
        expect(target.assets.uploaded[sheetId]!.origin).toMatchObject({ itemSlug: "my-draft-pack", store: "https://store.example.com" });
        expect(packBlockedItems(target, { tilesetIds: [tilesetId], assetIds: [] }).map((item) => item.id)).toEqual([sheetId]);
        expect(packBlockedItems(target, { tilesetIds: [], assetIds: [sheetId] }).map((item) => item.id)).toEqual([sheetId]);
      });
    });
  });
  // 스토어 아이콘 팩(kind "icon", 32×32 PNG 한 장씩, meta.oprnIcon): 매니페스트 검사 → 넣기(크기 검사·자료집 목록) → 아이콘 고르기 →
  // upsert 자동 아이콘 → assign_store_icons 일괄 배정 → 스킬·상태 iconResourceId 정규화·참조 검사.
  describe("assetStoreIcons", () => {
    isolateTimers();
    function png(width: number, height: number, salt = 0): Uint8Array {
      const bytes = new Uint8Array(33 + salt);
      bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
      const view = new DataView(bytes.buffer);
      view.setUint32(16, width);
      view.setUint32(20, height);
      return bytes;
    }
    const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
    const ICONS = [
      { id: "sword-iron", nameEn: "Iron sword", nameKo: "철검", category: "weapon", itemType: "weapon", element: "", tags: ["sword", "blade", "검"] },
      { id: "potion-red", nameEn: "Healing potion", nameKo: "회복 물약", category: "consumable", itemType: "medicine", element: "", tags: ["potion", "heal", "hp", "물약", "포션"] },
      { id: "magic-fire-1", nameEn: "Fire", nameKo: "파이어", category: "skill", itemType: "skill", element: "fire", tags: ["magic", "spell", "fire", "불", "마법"] },
      { id: "st-poison", nameEn: "Poison", nameKo: "독", category: "state", itemType: "state", element: "poison", tags: ["poison", "독", "status"] },
      { id: "shield-wood", nameEn: "Wooden shield", nameKo: "나무 방패", category: "armor", itemType: "shield", element: "", tags: ["shield", "방패"] },
    ] as const;
    function iconPack(size = STORE_ICON_SIZE): { manifest: StorePackManifest; blobs: Map<string, Uint8Array> } {
      const blobs = new Map<string, Uint8Array>();
      const assets: StorePackManifest["content"]["assets"] = {};
      ICONS.forEach((icon, index) => {
        const bytes = png(size, size, index);
        blobs.set(sha(bytes), bytes);
        assets[icon.id] = {
          id: icon.id, name: icon.nameEn, kind: "icon", blob: sha(bytes), mime: "image/png",
          meta: { width: size, height: size, oprnIcon: { version: 1, ...icon } } as never,
          generation: { method: "mixed", engine: "test", model: "test-model" },
        };
      });
      const first = [...blobs.keys()][0]!;
      return {
        manifest: {
          schema: "oprn-store-pack/1", title: "Test icons", summary: "", description: "", tags: [], kind: "icon", license: "OPRN-GAME", aiGenerated: true, credits: "AI",
          content: { assets, tilesets: {} }, previews: [first],
          blobs: [...blobs].map(([key, bytes]) => ({ sha256: key, mime: "image/png" as const, bytes: bytes.byteLength })),
        },
        blobs,
      };
    }
    const SLUG = "oprn-icons-test";
    const context = (blobs: Map<string, Uint8Array>) => ({ slug: SLUG, version: 1, author: "OPRN", storeUrl: "https://store.example", itemUrl: "https://store.example/items/x", blob: (key: string) => blobs.get(key)! });
    function projectWithIcons(): Project {
      const project = createBlankProject();
      const { manifest, blobs } = iconPack();
      const result = applyPackToProject(project, manifest, context(blobs));
      addStoreProfiles(project, result.assetIds);
      return project;
    }
    const tool = (name: string) => [...DB_TOOLS, ...STORE_ICON_TOOLS].find((entry) => entry.name === name)!;
    describe("store icon kind", () => {
      it("accepts an icon pack and enforces 32×32", () => {
        expect(validateManifest(iconPack().manifest).ok).toBe(true);
        expect(storeImageSizeProblem("icon", 32, 32)).toBeNull();
        expect(storeImageSizeProblem("icon", 24, 24)).toContain("32×32");
        const { manifest, blobs } = iconPack(48);
        expect(() => applyPackToProject(createBlankProject(), manifest, context(blobs))).toThrow(/32×32/);
      });

      it("installs icons as kind icon with meta, profiles and editor picker visibility", () => {
        const project = projectWithIcons();
        const id = storeProjectId(SLUG, "sword-iron");
        expect(project.assets.uploaded[id]).toMatchObject({ kind: "icon", origin: { itemSlug: SLUG } });
        expect(readStoreIconMeta(project.assets.uploaded[id]!.meta)?.nameKo).toBe("철검");
        expect(project.resourceProfiles.some((profile) => profile.assetId === id && profile.kind === "icon")).toBe(true);
        expect(uploadedMatchesKind("icon", "icon", id)).toBe(true);
        expect(uploadedMatchesKind("image", "icon", id)).toBe(true);
        expect(projectStoreIcons(project)).toHaveLength(ICONS.length);
      });

      it("subsets an icon pack to picked icons", () => {
        const { manifest } = iconPack();
        const subset = subsetAudioManifest(manifest, ["potion-red"]);
        expect(Object.keys(subset.content.assets)).toEqual(["potion-red"]);
        expect(subset.blobs).toHaveLength(1);
      });

      it("ranks by name, item type and element and keeps skills/states apart from items", () => {
        const icons = projectStoreIcons(projectWithIcons());
        expect(rankStoreIcons(icons, { target: "item", name: "회복 물약", itemType: "medicine" })[0]?.id).toBe(storeProjectId(SLUG, "potion-red"));
        expect(rankStoreIcons(icons, { target: "equipment", name: "Bronze sword", itemType: "weapon" })[0]?.id).toBe(storeProjectId(SLUG, "sword-iron"));
        expect(rankStoreIcons(icons, { target: "skill", name: "불꽃", element: "fire" })[0]?.id).toBe(storeProjectId(SLUG, "magic-fire-1"));
        expect(rankStoreIcons(icons, { target: "item", name: "독" }).some((icon) => icon.id === storeProjectId(SLUG, "st-poison"))).toBe(false);
        expect(rankStoreIcons(icons, { target: "state", name: "독 poison" })[0]?.id).toBe(storeProjectId(SLUG, "st-poison"));
      });

      it("reads elements by whole words only (열쇠 is not fire, 돌아가는 is not earth)", () => {
        expect(inferIconElement("낡은 열쇠", "오래된 문을 열 수 있을 것 같은 열쇠입니다.")).toBe("");
        expect(inferIconElement("귀환 주문서", "마을이나 안전 지점으로 돌아가는 아이템입니다.")).toBe("");
        expect(inferIconElement("물약")).toBe("");
        expect(inferIconElement("암석 파쇄", "대지 속성으로 적을 짓누릅니다.")).toBe("earth");
        expect(inferIconElement("성광", "신성 속성으로 적을 정화합니다.")).toBe("light");
        expect(inferIconElement("불의 화살")).toBe("fire");
        expect(inferIconElement("독")).toBe("poison");
      });

      it("upsert_* auto-picks a confident store icon and falls back to the bundled default for the rest", () => {
        const project = projectWithIcons();
        const item = tool("upsert_item").run(project, { item: { id: "item_hp", name: "회복 물약", type: "medicine", price: 50 } });
        expect((item as { data: { iconResourceId?: string } }).data.iconResourceId).toBe(storeProjectId(SLUG, "potion-red"));
        const odd = tool("upsert_item").run(project, { item: { id: "item_odd", name: "Mysterious thing", price: 5 } });
        expect((odd as { data: { iconResourceId?: string } }).data.iconResourceId).toBe("cc0-jetrel-coin-pouch");
        const given = tool("upsert_item").run(project, { item: { id: "item_given", name: "회복 물약", iconResourceId: storeProjectId(SLUG, "sword-iron") } });
        expect((given as { data: { iconResourceId?: string } }).data.iconResourceId).toBe(storeProjectId(SLUG, "sword-iron"));
        const skill = tool("upsert_skill").run(project, { skill: { id: "skill_fire_test", name: "파이어", elementId: "fire" } });
        expect((skill as { data: { iconResourceId?: string } }).data.iconResourceId).toBe(storeProjectId(SLUG, "magic-fire-1"));
        const state = tool("upsert_state").run(project, { state: { id: "state_poison_test", name: "독" } });
        expect((state as { data: { iconResourceId?: string } }).data.iconResourceId).toBe(storeProjectId(SLUG, "st-poison"));
      });

      it("assign_store_icons fills missing icons from installed icons without a store", () => {
        const project = projectWithIcons();
        project.database.equipment.push({ ...project.database.equipment[0]!, id: "equip_t_shield", name: "Wooden shield", slot: "shield", iconResourceId: undefined });
        project.database.items.push({ ...project.database.items[0]!, id: "item_t_potion", name: "Healing potion", type: "medicine", iconResourceId: undefined });
        const plan = planIconAssignments(project, { ids: ["equip_t_shield", "item_t_potion"] });
        expect(plan.assign.map((a) => a.iconResourceId).sort()).toEqual([storeProjectId(SLUG, "potion-red"), storeProjectId(SLUG, "shield-wood")].sort());
        const result = tool("assign_store_icons").run(project, { ids: ["equip_t_shield", "item_t_potion"] }) as { data: { assigned: unknown[] } };
        expect(result.data.assigned).toHaveLength(2);
        expect(project.database.equipment.find((e) => e.id === "equip_t_shield")?.iconResourceId).toBe(storeProjectId(SLUG, "shield-wood"));
      });

      it("keeps skill/state iconResourceId optional and reference-checked", () => {
        expect(normalizeSkillRecord({ id: "s", name: "s" })).not.toHaveProperty("iconResourceId");
        expect(normalizeStateRecord({ id: "t", name: "t" })).not.toHaveProperty("iconResourceId");
        expect(normalizeSkillRecord({ id: "s", name: "s", iconResourceId: "x" }).iconResourceId).toBe("x");
        const project = projectWithIcons();
        project.database.skills[0] = { ...project.database.skills[0]!, iconResourceId: storeProjectId(SLUG, "magic-fire-1") };
        expect(() => validateProjectReferences(project)).not.toThrow();
        project.database.states[0] = { ...project.database.states[0]!, iconResourceId: "missing-icon" };
        expect(() => validateProjectReferences(project)).toThrow(/state .*iconResourceId/);
      });
    });
  });
  // 스토어 몬스터의 전투 도트 시트(meta.pixelEnemySheet): 매니페스트 검사 → 넣기(id 바꾸기·크기 검사) → 전투 조회 → 웹 내보내기 포함.
  describe("assetStoreMonsterMotion", () => {
    isolateTimers();
    function png(width: number, height: number, salt = 0): Uint8Array {
      const bytes = new Uint8Array(33 + salt);
      bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
      const view = new DataView(bytes.buffer);
      view.setUint32(16, width);
      view.setUint32(20, height);
      return bytes;
    }
    const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
    function manifest(options: { sheet?: Uint8Array; portrait?: Uint8Array; patch?: Record<string, unknown> } = {}): { manifest: StorePackManifest; blobs: Map<string, Uint8Array> } {
      const portrait = options.portrait ?? png(64, 64, 1);
      const sheet = options.sheet ?? png(192, 192, 2);
      const blobs = new Map([[sha(portrait), portrait], [sha(sheet), sheet]]);
      const m: StorePackManifest = {
        schema: "oprn-store-pack/1", title: "Drakes", summary: "", description: "", tags: [], kind: "battler", license: "OPRN-GAME", aiGenerated: true, credits: "AI",
        content: {
          assets: {
            drake: {
              id: "drake", name: "Drake", kind: "monster", blob: sha(portrait), mime: "image/png",
              meta: { width: 64, height: 64, pixelEnemySheet: { sheetResourceId: "drake-sheet", cell: 64, motion: "swoop", idleFrameMs: 180, skillCell: true, ...options.patch } as never },
            },
            "drake-sheet": { id: "drake-sheet", name: "Drake sheet", kind: "picture", blob: sha(sheet), mime: "image/png", meta: { width: 192, height: 192, frameWidth: 64, frameHeight: 64, frames: 9 } },
          },
          tilesets: {},
        },
        previews: [sha(portrait)],
        blobs: [...blobs].map(([key, bytes]) => ({ sha256: key, mime: "image/png" as const, bytes: bytes.byteLength })),
      };
      return { manifest: m, blobs };
    }
    const context = (blobs: Map<string, Uint8Array>) => ({ slug: "oprn-drakes", version: 1, author: "OPRN", storeUrl: "https://store.example", itemUrl: "https://store.example/items/oprn-drakes", blob: (key: string) => blobs.get(key)! });
    const empty = () => ({ tilesets: {}, assets: { uploaded: {} }, database: {}, resourceProfiles: [] }) as unknown as Project;
    describe("store monster battle sheet", () => {
      it("accepts a monster with a sibling 3×3 sheet and rejects broken sheet markers", () => {
        expect(validateManifest(manifest().manifest).ok).toBe(true);
        const bad = (patch: Record<string, unknown>) => {
          const result = validateManifest(manifest({ patch }).manifest);
          return result.ok ? [] : result.errors;
        };
        expect(bad({ sheetResourceId: "nope" }).join()).toContain("sheetResourceId");
        expect(bad({ sheetResourceId: "drake" }).join()).toContain("sheetResourceId");
        expect(bad({ cell: 32 }).join()).toContain("cell");
        expect(bad({ motion: "teleport" }).join()).toContain("motion");
        expect(bad({ idleFrameMs: 10 }).join()).toContain("idleFrameMs");
        expect(bad({ skillCell: false }).join()).toContain("skillCell");
        const wrongKind = manifest().manifest;
        wrongKind.content.assets["drake-sheet"]!.kind = "monster";
        expect(validateManifest(wrongKind)).toMatchObject({ ok: false });
        const onPicture = manifest().manifest;
        onPicture.content.assets["drake-sheet"]!.meta.pixelEnemySheet = onPicture.content.assets.drake!.meta.pixelEnemySheet;
        expect(validateManifest(onPicture)).toMatchObject({ ok: false });
      });

      it("checks portrait cell×cell and sheet 3cell×3cell sizes", () => {
        const ok = manifest();
        expect(storeMonsterSheetSizeProblems(ok.manifest, (key) => pngSize(ok.blobs.get(key)!))).toEqual([]);
        const wrong = manifest({ sheet: png(128, 192, 4) });
        expect(storeMonsterSheetSizeProblems(wrong.manifest, (key) => pngSize(wrong.blobs.get(key)!)).join()).toContain("192×192");
        expect(() => applyPackToProject(empty(), wrong.manifest, context(wrong.blobs))).toThrow("192×192");
        const portrait = manifest({ portrait: png(96, 96, 5) });
        expect(() => applyPackToProject(empty(), portrait.manifest, context(portrait.blobs))).toThrow("64×64");
      });

      it("imports with the sheet id rewritten so the battle runtime and web export find it", () => {
        const { manifest: m, blobs } = manifest();
        const target = empty();
        applyPackToProject(target, m, context(blobs));
        const monsterId = storeProjectId("oprn-drakes", "drake");
        const sheetId = storeProjectId("oprn-drakes", "drake-sheet");
        expect(target.assets.uploaded[monsterId]!.meta.pixelEnemySheet).toMatchObject({ sheetResourceId: sheetId, cell: 64, motion: "swoop" });

        const sheet = projectPixelEnemySheet(monsterId, target);
        expect(sheet).toMatchObject({ resourceId: monsterId, motion: "swoop", idleFrameMs: 180, skillCell: true, projectAuthored: true });
        expect(pixelEnemyCell(sheet!)).toBe(64);
        expect(sheet!.url).toBe(`data:image/png;base64,${bytesToBase64(blobs.get(m.content.assets["drake-sheet"]!.blob)!)}`);
        expect(monsterBattleMotion(target, monsterId)).toBe("swoop");
        // 공방이 스토어 몬스터를 자기 저작물로 덮어 그리지 않는다.
        expect(isAuthoredMonsterAsset(target, monsterId)).toBe(false);

        const game = createBlankProject();
        game.assets.uploaded = { ...game.assets.uploaded, ...target.assets.uploaded };
        game.database.enemies = [{ ...game.database.enemies[0]!, id: "enemy_drake", name: "Drake", monsterResourceId: monsterId }];
        const used = collectUsedUploadedAssetIds(game);
        expect(used.has(monsterId)).toBe(true);
        expect(used.has(sheetId)).toBe(true);
      });

      it("leaves still store monsters without battle motion", () => {
        const { manifest: m, blobs } = manifest();
        delete m.content.assets.drake!.meta.pixelEnemySheet;
        const target = empty();
        applyPackToProject(target, m, context(blobs));
        expect(monsterBattleMotion(target, storeProjectId("oprn-drakes", "drake"))).toBeUndefined();
      });

      it("ships the sheet when a monster with a sheet is published", async () => {
        const portrait: UploadedAsset = { id: "boss", name: "Boss", kind: "monster", dataUrl: `data:image/png;base64,${bytesToBase64(png(64, 64, 7))}`, meta: { width: 64, height: 64, pixelEnemySheet: { sheetResourceId: "boss-sheet", cell: 64, motion: "stomp", idleFrameMs: 300 } } };
        const sheet: UploadedAsset = { id: "boss-sheet", name: "Boss sheet", kind: "picture", dataUrl: `data:image/png;base64,${bytesToBase64(png(192, 192, 8))}`, meta: { width: 192, height: 192 } };
        const source = { tilesets: {}, assets: { uploaded: { boss: portrait, "boss-sheet": sheet } } } as unknown as Project;
        expect(closeSelection(source, { tilesetIds: [], assetIds: ["boss"] }).assetIds.sort()).toEqual(["boss", "boss-sheet"]);
        const readAsset = async (asset: UploadedAsset) => Uint8Array.from(Buffer.from(asset.dataUrl!.split(",")[1]!, "base64"));
        const built = await buildPack(source, { tilesetIds: [], assetIds: ["boss"] }, { title: "Boss", summary: "", description: "", tags: [], kind: "battler", license: "OPRN-GAME", aiGenerated: true, credits: "AI" }, { readAsset, sha256: async (bytes) => sha(bytes) });
        expect(validateManifest(built.manifest).ok).toBe(true);
        expect(Object.keys(built.manifest.content.assets).sort()).toEqual(["boss", "boss-sheet"]);
      });
    });
  });
  describe("assetStoreQuery", () => {
    isolateTimers();
    const item = (slug: string, kind: string, words: string[]) => ({ slug, kind, title: slug, words }) as unknown as StoreItemSummary & { words: string[] };
    const CATALOG = [
      item("icons-weapons", "icon", ["무기", "weapon", "아이콘"]),
      item("icons-potions", "icon", ["물약", "소모품", "potion", "consumable", "아이콘"]),
      item("battlers-weapon", "battler", ["무기", "weapon"]),
    ];
    /** 서버처럼 검색어 전체를 한 덩어리로 찾는다. */
    async function fakeCatalog(input: { q?: string; kind?: string }): Promise<StoreCatalogPage> {
      const q = (input.q ?? "").toLowerCase();
      const items = CATALOG.filter((entry) => (!input.kind || entry.kind === input.kind) && (!q || entry.words.some((word) => word.includes(q))));
      return { items, total: items.length, page: 1, pageSize: 24 };
    }
    describe("store query", () => {
      it("종류 낱말은 kind 로 읽고 찾을 낱말에서 뺀다", () => {
        expect(parseStoreQuery("무기 아이콘")).toEqual({ kind: "icon", words: ["무기"] });
        expect(parseStoreQuery("불 효과음")).toEqual({ kind: "sound", words: ["불"] });
        expect(parseStoreQuery("아이콘", "battler")).toEqual({ kind: "battler", words: [] });
        expect(parseStoreQuery("그림자 숲")).toEqual({ kind: "", words: ["그림자", "숲"] });
      });

      it("「무기 아이콘」 처럼 낱말이 여럿이어도 찾는다", async () => {
        expect((await searchStoreCatalog(fakeCatalog, "무기 아이콘")).items.map((entry) => entry.slug)).toEqual(["icons-weapons"]);
        expect((await searchStoreCatalog(fakeCatalog, "물약 소모품")).items.map((entry) => entry.slug)).toEqual(["icons-potions"]);
        expect((await searchStoreCatalog(fakeCatalog, "consumable potion icon")).items.map((entry) => entry.slug)).toEqual(["icons-potions"]);
        expect((await searchStoreCatalog(fakeCatalog, "아이콘")).total).toBe(2);
      });
    });
  });
  describe("assetStoreUndo", () => {
    isolateTimers();
    function png(width: number, height: number, salt = 0): Uint8Array {
      const bytes = new Uint8Array(33 + salt);
      bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
      const view = new DataView(bytes.buffer);
      view.setUint32(16, width);
      view.setUint32(20, height);
      return bytes;
    }
    const dataUrl = (bytes: Uint8Array) => `data:image/png;base64,${bytesToBase64(bytes)}`;
    const io = {
      readAsset: async (asset: UploadedAsset) => Uint8Array.from(Buffer.from(asset.dataUrl!.split(",")[1]!, "base64")),
      sha256: async (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex"),
    };
    const meta = { title: "숲", summary: "", description: "", tags: [], kind: "pack" as const, license: "CC0" as const, aiGenerated: false, credits: "" };
    /** 작가 쪽 프로젝트: 타일셋 하나 + 캐릭터 시트 하나(+ 둘째 판본에서는 그림 하나 뺌). */
    async function pack(withExtra: boolean): Promise<BuiltPack> {
      const author = {
        tilesets: { forest: { ...basicTilesetFor("sheet", "숲", 32, 32, 16), id: "forest" } },
        assets: { uploaded: {
          sheet: { id: "sheet", name: "숲 시트", kind: "chipset", dataUrl: dataUrl(png(32, 32)), meta: { width: 32, height: 32, tileSize: 16 } },
          hero: { id: "hero", name: "용사", kind: "charset", dataUrl: dataUrl(png(288, 256, 1)), meta: { width: 288, height: 256 } },
          ...(withExtra ? { pic: { id: "pic", name: "그림", kind: "picture", dataUrl: dataUrl(png(8, 8, 2)), meta: { width: 8, height: 8 } } } : {}),
        } },
        charsetLabels: [{ textureKey: "hero", characterIndex: 0, label: "용사", origin: "user" }],
      } as unknown as Project;
      return buildPack(author, { tilesetIds: ["forest"], assetIds: ["hero", ...(withExtra ? ["pic"] : [])] }, meta, io);
    }
    function context(built: BuiltPack, version: number): ApplyContext {
      return { slug: "forest-pack", version, author: "작가", storeUrl: "http://127.0.0.1", itemUrl: "http://127.0.0.1/items/forest-pack", blob: (sha) => built.blobs.get(sha)!.bytes };
    }
    function target(): Project {
      return {
        tilesets: {}, assets: { uploaded: {} }, charsetLabels: [], resourceProfiles: [],
        maps: { m1: { id: "m1", name: "시작 마을", tilesetId: "base" } }, database: {}, system: {}, commonEvents: [],
      } as unknown as Project;
    }
    describe("store add undo", () => {
      it("undo deletes everything a first add created and nothing else", async () => {
        const built = await pack(true);
        const project = target();
        project.charsetLabels = [{ textureKey: "other_sheet", characterIndex: 1, label: "남의 이름", origin: "user" }] as Project["charsetLabels"];
        const snapshot = captureStoreAdd(project, storeAddKeys(built.manifest, "forest-pack"));
        applyPackToProject(project, built.manifest, context(built, 1));
        expect(Object.keys(project.assets.uploaded)).toHaveLength(3);
        expect(undoStoreAdd(project, snapshot)).toEqual({ ok: true });
        expect(project.assets.uploaded).toEqual({});
        expect(project.tilesets).toEqual({});
        expect(project.charsetLabels).toEqual([{ textureKey: "other_sheet", characterIndex: 1, label: "남의 이름", origin: "user" }]);
      });

      it("undo of a version upgrade brings the previous version back", async () => {
        const v1 = await pack(true);
        const v2 = await pack(false);
        const project = target();
        applyPackToProject(project, v1.manifest, context(v1, 1));
        const sheetId = storeProjectId("forest-pack", "sheet");
        const snapshot = captureStoreAdd(project, storeAddKeys(v2.manifest, "forest-pack"));
        applyPackToProject(project, v2.manifest, context(v2, 2));
        expect(project.assets.uploaded[sheetId]!.origin!.version).toBe(2);
        expect(undoStoreAdd(project, snapshot)).toEqual({ ok: true });
        expect(project.assets.uploaded[sheetId]!.origin!.version).toBe(1);
      });

      it("refuses to undo when a map started using the added tileset", async () => {
        const built = await pack(false);
        const project = target();
        const snapshot = captureStoreAdd(project, storeAddKeys(built.manifest, "forest-pack"));
        const result = applyPackToProject(project, built.manifest, context(built, 1));
        project.maps.m2 = { ...project.maps.m1!, id: "m2", name: "숲 맵", tilesetId: result.tilesetIds[0]! };
        expect(undoStoreAdd(project, snapshot)).toEqual({ ok: false, usedBy: ["숲 맵"] });
        expect(Object.keys(project.assets.uploaded)).toHaveLength(2);
      });

      it("finds event references to an added sheet", async () => {
        const built = await pack(false);
        const project = target();
        const result = applyPackToProject(project, built.manifest, context(built, 1));
        const hero = result.assetIds.find((id) => id.endsWith("__hero"))!;
        project.maps.m1 = { ...project.maps.m1!, events: [{ pages: [{ graphic: { textureKey: hero } }] }] } as unknown as Project["maps"][string];
        expect(storeItemUsages(project, [hero])).toEqual(["시작 마을"]);
      });
    });
    describe("store item removal and stale cleanup", () => {
      it("removes an item from the project and keeps unrelated assets", async () => {
        const built = await pack(true);
        const project = target();
        project.assets.uploaded.mine = { id: "mine", name: "내 그림", kind: "picture", dataUrl: dataUrl(png(4, 4)), meta: {} };
        applyPackToProject(project, built.manifest, context(built, 1));
        expect(removeStoreItem(project, "forest-pack")).toEqual({ ok: true, removed: 4 });
        expect(Object.keys(project.assets.uploaded)).toEqual(["mine"]);
        expect(project.tilesets).toEqual({});
      });

      it("lists and cleans assets that only the old version had", async () => {
        const v1 = await pack(true);
        const v2 = await pack(false);
        const project = target();
        applyPackToProject(project, v1.manifest, context(v1, 1));
        const result = applyPackToProject(project, v2.manifest, context(v2, 2));
        const stale = staleStoreAssetIds(project, "forest-pack", result.assetIds);
        expect(stale).toEqual([storeProjectId("forest-pack", "pic")]);
        expect(removeStaleStoreAssets(project, stale)).toEqual({ ok: true, removed: 1 });
        expect(Object.keys(project.assets.uploaded).sort()).toEqual(result.assetIds.slice().sort());
      });

      it("counts what landed in plain units", async () => {
        const built = await pack(true);
        const project = target();
        const result = applyPackToProject(project, built.manifest, context(built, 1));
        const summary = landedSummary(project, result.assetIds, result.tilesetIds);
        expect(summary).toEqual({ tiles: 4, characters: 8, pictures: 1, music: 0, sounds: 0 });
        expect(landedLines(summary)).toEqual(["타일 4칸 → 타일 팔레트", "캐릭터 8명 → 캐릭터 그림 목록", "그림 1장 → 리소스 목록"]);
      });
    });
    describe("human store errors", () => {
      it("turns offline relay errors into a retry with the cached fallback", () => {
        const error = humanStoreError({ message: "스토어(http://127.0.0.1:1)에 연결하지 못했습니다. 인터넷 연결이나 스토어 주소를 확인해 주세요.", status: 0, details: ["fetch failed"] });
        expect(error.actions).toEqual(["retry", "cached"]);
        expect(error.title).not.toContain("fetch failed");
      });

      it("offers to open a project when no project folder is open", () => {
        expect(humanStoreError({ message: "열린 프로젝트 폴더가 없습니다", status: 0, details: [] }).actions).toContain("openProject");
      });

      it("never titles a banner with an internal English error", () => {
        const error = humanStoreError({ message: "Cannot read properties of undefined (reading 'type')", status: 0, details: [] });
        expect(error.title).toBe("이 에셋을 넣지 못했어요");
        expect(error.actions).toContain("report");
        expect(error.detail).toContain("Cannot read properties");
      });

      it("asks to sign in again on 401", () => {
        expect(humanStoreError({ message: "로그인이 만료되었습니다. 다시 로그인해 주세요.", status: 401, details: [] }).actions[0]).toBe("login");
      });
    });
  });
});
