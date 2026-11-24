import { describe, expect, it, afterEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { STORE_ANIMATION_EASYRPG_SOUNDS, storeBattleAnimationSizeProblems, storeProjectId, validateManifest, type StorePackManifest, STORE_PACK_SCHEMA, STORE_ICON_SIZE, storeImageSizeProblem, storeMonsterSheetSizeProblems, REFMAP_CREDIT, STORE_BLOB_PREFIX, STORE_SLUG, slugify, storeThirdPartyName, packGrade, type StoreCatalogPage, type StoreItemSummary } from "@/assetStore/format";
import { EASYRPG_SOUND_ASSETS } from "@/assets/easyrpgRtp";
import { applyPackToProject, storeAnimationId, storeAppearanceId, basicTilesetFor, buildPack, encodePackBundle, packBlockedItems, type PackMeta, closeSelection, aiMadeAssets, aiMaker, decodePackBundle, storeCredits, storeItemsInProject, StorePackBlockedError, type ApplyContext, type BuiltPack } from "@/assetStore/pack";
import { pngSize, bytesToBase64, sniffMime } from "@/assetStore/sniff";
import { battleAnimationChainDurationMs, battleAnimationDurationMs, battleAnimationFrameAtUnits } from "@/battle/animationTiming";
import { captureStoreAdd, removeStoreItem, storeAddKeys, undoStoreAdd, removeStaleStoreAssets, staleStoreAssetIds, storeItemUsages } from "@/editor/assetStore/storeUndo";
import { normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import { createBlankProject } from "@/project/defaults";
import { collectUsedUploadedAssetIds } from "@/project/webExportAssets";
import type { BattleAnimationRecord, Project, UploadedAsset, TilesetDef } from "@/project/types";
import { appearancePortraitForEmotion, faceForDialogueEmotion, resolveAppearancePortrait } from "@/project/characterAppearances";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { AssetStoreClient, isPrivateHost, sameOriginUrl, StoreError, bundleUnsupportedStatus } from "../electron/main/assetStoreClient";
import { findStoreDeepLinkArg, parseStoreDeepLink } from "@/assetStore/deepLink";
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
import { uploadBlockReason } from "@/editor/assetStore/storeUpload";
import { parseStoreQuery, searchStoreCatalog } from "@/assetStore/storeQuery";
import { humanStoreError, landedLines, landedSummary } from "@/editor/assetStore/storeText";
import { isolateTimers } from "./mergedTeardown";

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

describe("assetStoreClient", () => {
  isolateTimers();
  describe("asset store client address rules", () => {
    it("allows plain http only for private hosts", () => {
      for (const host of ["localhost", "127.0.0.1", "[::1]", "10.0.0.5", "192.168.1.2", "172.20.0.1", "100.73.251.77", "mdc-server"]) expect(isPrivateHost(host), host).toBe(true);
      for (const host of ["10.evil.com", "192.168.1.2.evil.com", "100.73.251.77.nip.io", "store.openrpgmaker.com", "100.128.0.1", "172.32.0.1", "8.8.8.8"]) expect(isPrivateHost(host), host).toBe(false);
    });

    it("opens only same-origin login pages", () => {
      expect(sameOriginUrl("https://store.openrpgmaker.com/device?code=AB", "https://store.openrpgmaker.com")).toBe("https://store.openrpgmaker.com/device?code=AB");
      expect(sameOriginUrl("file:///etc/passwd", "https://store.openrpgmaker.com")).toBeNull();
      expect(sameOriginUrl("https://evil.example/device", "https://store.openrpgmaker.com")).toBeNull();
      expect(sameOriginUrl("not a url", "https://store.openrpgmaker.com")).toBeNull();
    });
  });
  describe("asset store client concept feed", () => {
    const SHA_FULL = "a".repeat(64);
    const SHA_CARD = "b".repeat(64);
    const card = (slug: string, extra: Record<string, unknown> = {}) => ({
      slug,
      title: "몸이 뒤바뀐 악역영애",
      hook: "처형 3일 전, 눈을 떠 보니 그 아이의 몸이었다.",
      description: "왕립 아카데미 무도회에서 시작하는 이야기.",
      tags: ["웹소설", "연애"],
      presetId: "story-cutscene",
      protagonist: "평민 소녀",
      stage: "왕립 아카데미",
      firstScene: "무도회장 거울 앞",
      brief: { experience: "처형을 피한다", activity: "대화·조사", progression: "3일 카운트다운", detail: "거울·무도회", scope: "첫날 밤까지" },
      thumb: { full: SHA_FULL, card: SHA_CARD },
      source: "official",
      madeCount: 3,
      aiGenerated: true,
      ...extra,
    });
    const roots: string[] = [];
    const requests: { url: string; method: string }[] = [];

    function client(respond: (url: string, init: RequestInit) => Response): AssetStoreClient {
      const root = mkdtempSync(join(tmpdir(), "oprn-store-client-"));
      roots.push(root);
      vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
        requests.push({ url: String(url), method: init.method ?? "GET" });
        return respond(String(url), init);
      }));
      return new AssetStoreClient(root, { load: () => null, save: () => undefined, persistent: () => false }, "https://store.example.com");
    }
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

    afterEach(() => {
      vi.unstubAllGlobals();
      requests.length = 0;
      for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
    });

    it("normalizes a page of concepts and forwards the filters", async () => {
      const store = client(() => json({ items: [card("body-swap-villainess", { title: "  몸이 뒤바뀐 악역영애  ", aiGenerated: false })], nextCursor: "1000:24" }));
      const page = await store.concepts({ tag: "웹소설", cursor: "1000:0", q: "" });
      expect(page.nextCursor).toBe("1000:24");
      expect(page.items).toHaveLength(1);
      expect(page.items[0]!.title).toBe("몸이 뒤바뀐 악역영애");
      expect(page.items[0]!.aiGenerated).toBe(true);
      expect(page.items[0]!.madeCount).toBe(3);
      const url = new URL(requests[0]!.url);
      expect(url.pathname).toBe("/api/v1/concepts");
      expect(url.searchParams.get("tag")).toBe("웹소설");
      expect(url.searchParams.get("cursor")).toBe("1000:0");
      expect(url.searchParams.has("q")).toBe(false);
    });

    it("rejects malformed concepts from the server (unknown preset, non-sha thumbnail)", async () => {
      const badPreset = client(() => json({ concept: card("bad-preset", { presetId: "rts" }), similar: [] }));
      await expect(badPreset.concept({ slug: "bad-preset" })).rejects.toBeInstanceOf(StoreError);
      const badThumb = client(() => json({ items: [card("bad-thumb", { thumb: { full: "https://evil.example/x.png", card: SHA_CARD } })], nextCursor: null }));
      await expect(badThumb.concepts({})).rejects.toBeInstanceOf(StoreError);
      const ok = client(() => json({ concept: card("good-one"), similar: [card("good-two")] }));
      const detail = await ok.concept({ slug: "good-one" });
      expect(detail.similar.map((item) => item.slug)).toEqual(["good-two"]);
    });

    it("reports made as a boolean and never throws", async () => {
      const ok = client(() => new Response(null, { status: 204 }));
      await expect(ok.conceptMade({ slug: "good-one" })).resolves.toBe(true);
      expect(requests.at(-1)).toEqual({ url: "https://store.example.com/api/v1/concepts/good-one/made", method: "POST" });
      const missing = client(() => json({ error: "not_found", message: "컨셉을 찾을 수 없습니다." }, 404));
      await expect(missing.conceptMade({ slug: "gone-one" })).resolves.toBe(false);
      const offline = client(() => { throw new TypeError("fetch failed"); });
      await expect(offline.conceptMade({ slug: "good-one" })).resolves.toBe(false);
    });

    it("refuses a pack bundle larger than manifest + pack limits before reading it", async () => {
      const store = client((url) => url.endsWith("/bundle")
        ? new Response(new Uint8Array(8), { status: 200, headers: { "content-length": String(200 * 1024 * 1024) } })
        : json({ slug: "big-pack", latestVersion: 1 }));
      await expect(store.install("big-pack", () => undefined)).rejects.toThrow("스토어 응답이 너무 큽니다.");
      expect(requests.some((request) => request.url.endsWith("/manifest"))).toBe(false);
    });

    it("refuses a gzip bundle that inflates past the limit", async () => {
      const bomb = gzipSync(Buffer.alloc(190 * 1024 * 1024));
      const store = client((url) => url.endsWith("/bundle") ? new Response(bomb, { status: 200 }) : json({ slug: "bomb", latestVersion: 1 }));
      await expect(store.install("bomb", () => undefined)).rejects.toThrow("스토어 응답이 너무 큽니다.");
    });

    it("asks a store without /bundle only once per address", async () => {
      const store = client((url) => url.endsWith("/bundle") ? json({ message: "없는 주소입니다." }, 404)
        : url.endsWith("/manifest") ? json({ message: "점검 중" }, 503) : json({ slug: "old-server", latestVersion: 1 }));
      await expect(store.install("old-server", () => undefined)).rejects.toBeInstanceOf(StoreError);
      await expect(store.install("old-server", () => undefined)).rejects.toBeInstanceOf(StoreError);
      expect(requests.filter((request) => request.url.endsWith("/bundle"))).toHaveLength(1);
    });

    it("re-downloads a cached blob whose bytes no longer match its sha256", async () => {
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
      const sha = createHash("sha256").update(png).digest("hex");
      const store = client(() => new Response(png, { status: 200 }));
      const shard = join(roots.at(-1)!, "blobs", sha.slice(0, 2));
      mkdirSync(shard, { recursive: true });
      writeFileSync(join(shard, sha), "tampered");
      expect(await store.blob(sha)).toEqual(png);
      expect(requests.map((request) => request.url)).toEqual([`https://store.example.com/api/v1/blobs/${sha}`]);
    });

    it("reports an item through the store API", async () => {
      const store = client(() => json({ hidden: false }));
      await expect(store.report("some-item", "copyright", "원본 출처가 다릅니다")).resolves.toEqual({ hidden: false });
      expect(requests).toEqual([{ url: "https://store.example.com/api/v1/items/some-item/reports", method: "POST" }]);
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

describe("assetStorePack", () => {
  isolateTimers();
  function png(width: number, height: number, salt = 0): Uint8Array {
    const bytes = new Uint8Array(33 + salt);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, width);
    view.setUint32(20, height);
    return bytes;
  }
  const dataUrl = (bytes: Uint8Array, mime = "image/png") => `data:${mime};base64,${bytesToBase64(bytes)}`;
  const sha256 = async (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  const readAsset = async (asset: UploadedAsset) => Uint8Array.from(Buffer.from(asset.dataUrl!.split(",")[1]!, "base64"));
  function project(): Project {
    const sheet = png(64, 32);
    const extra = png(16, 16, 3);
    const tileset: TilesetDef = {
      ...basicTilesetFor("sheet", "숲 칩셋", 64, 32, 16),
      id: "forest",
      tileGrafts: [{ targetTile: 0, sourceChipset: "extra", sourceTile: 1 }, { targetTile: 1, sourceChipset: "tex_bundled_town", sourceTile: 2 }],
      referenceDocuments: [{
        id: "cat", name: "숲 깔기", description: "", documents: [{ id: "d1", name: "규칙", markdown: "# 숲" }],
        images: [{ id: "i1", name: "예시", caption: "정상", dataUrl: dataUrl(png(8, 8, 9)) }],
      }],
    };
    return {
      tilesets: { forest: tileset, other: { ...basicTilesetFor("sheet", "다른", 64, 32, 16), id: "other" } },
      assets: {
        uploaded: {
          sheet: { id: "sheet", name: "숲 시트", kind: "chipset", dataUrl: dataUrl(sheet), meta: { width: 64, height: 32, tileSize: 16 } },
          extra: { id: "extra", name: "이식 원본", kind: "chipset", dataUrl: dataUrl(extra), meta: { width: 16, height: 16 } },
          song: { id: "song", name: "노래", kind: "music", dataUrl: `data:audio/ogg;base64,${bytesToBase64(new TextEncoder().encode("OggS-fake"))}`, meta: {} },
        },
      },
    } as unknown as Project;
  }
  const META: PackMeta = { title: "숲 마을 팩", summary: "숲", description: "", tags: ["숲"], kind: "tileset", license: "CC-BY-4.0", aiGenerated: true, credits: "그림: 테스터" };
  describe("asset store pack", () => {
    it("sniffs real signatures, not declared types", () => {
      expect(sniffMime(png(1, 1))).toBe("image/png");
      expect(pngSize(png(48, 32))).toEqual({ width: 48, height: 32 });
      expect(sniffMime(new TextEncoder().encode("<html>"))).toBeNull();
      expect(sniffMime(new TextEncoder().encode("OggS...."))).toBe("audio/ogg");
    });

    it("closes a tileset selection over image, grafts and leaves bundled grafts out", () => {
      const closed = closeSelection(project(), { tilesetIds: ["forest"], assetIds: [] });
      expect(closed.tilesetIds).toEqual(["forest"]);
      expect(closed.assetIds.sort()).toEqual(["extra", "sheet"]);
      expect(closed.missing).toEqual([]);
    });

    it("builds a manifest with no data URLs left and validates it", async () => {
      const built = await buildPack(project(), { tilesetIds: ["forest"], assetIds: ["song"] }, META, { readAsset, sha256 });
      const json = JSON.stringify(built.manifest.content);
      expect(json).not.toContain("data:");
      expect(json).toContain(STORE_BLOB_PREFIX);
      expect(built.manifest.blobs).toHaveLength(4);
      expect(built.manifest.previews).toHaveLength(1);
      expect(packGrade(built.manifest.content)).toBe("pack");
      const result = validateManifest(built.manifest);
      expect(result).toEqual({ ok: true, value: built.manifest });
    });

    it("rejects smuggled blobs, missing images and leftover data URLs", async () => {
      const built = await buildPack(project(), { tilesetIds: ["forest"], assetIds: [] }, META, { readAsset, sha256 });
      const smuggled = structuredClone(built.manifest);
      smuggled.blobs.push({ sha256: "a".repeat(64), mime: "image/png", bytes: 10 });
      expect(validateManifest(smuggled)).toMatchObject({ ok: false });
      const broken = structuredClone(built.manifest);
      broken.content.tilesets.forest!.image = { type: "uploaded", id: "nope" };
      const brokenResult = validateManifest(broken);
      expect(brokenResult.ok).toBe(false);
      if (!brokenResult.ok) expect(brokenResult.errors.join()).toContain("팩에 없습니다");
      const leaked = structuredClone(built.manifest);
      leaked.content.tilesets.forest!.name = "data:image/png;base64,AAAA";
      expect(validateManifest(leaked).ok).toBe(false);
      expect(validateManifest({ ...built.manifest, license: "All rights reserved" }).ok).toBe(false);
      expect(validateManifest({ ...built.manifest, license: "REFMAP-MODIFIED", credits: "누군가" }).ok).toBe(false);
      expect(validateManifest({ ...built.manifest, license: "REFMAP-MODIFIED", credits: `OPRN · ${REFMAP_CREDIT}` }).ok).toBe(true);
    });

    it("rejects prototype ids, cell counts that disagree with passability, and slugs that collide as project ids", async () => {
      const built = await buildPack(project(), { tilesetIds: ["forest"], assetIds: [] }, META, { readAsset, sha256 });
      const proto = JSON.parse(JSON.stringify(built.manifest).replace('"forest":', '"__proto__":').replace('"id":"forest"', '"id":"__proto__"'));
      const protoResult = validateManifest(proto);
      expect(protoResult.ok).toBe(false);
      if (!protoResult.ok) expect(protoResult.errors.join()).toContain("타일셋 id 가 올바르지 않습니다");
      const stretched = structuredClone(built.manifest);
      stretched.content.tilesets.forest!.count = 4096;
      const stretchedResult = validateManifest(stretched);
      expect(stretchedResult.ok).toBe(false);
      if (!stretchedResult.ok) expect(stretchedResult.errors.join()).toContain("칸 수(count)와 통행·층 정보 길이가 다릅니다");
      expect(STORE_SLUG.test("abc--def")).toBe(false);
      expect(STORE_SLUG.test("abc-def")).toBe(true);
    });

    it("refuses to apply a tileset whose cells do not fit its picture", async () => {
      const built = await buildPack(project(), { tilesetIds: ["forest"], assetIds: [] }, META, { readAsset, sha256 });
      const tall = structuredClone(built.manifest);
      const forest = tall.content.tilesets.forest!;
      forest.count = 16;
      forest.passability = [...forest.passability, ...forest.passability];
      forest.priority = [...forest.priority, ...forest.priority];
      forest.terrain = [...(forest.terrain ?? []), ...(forest.terrain ?? [])];
      const target = { tilesets: {}, assets: { uploaded: {} } } as unknown as Project;
      const context = { slug: "tall-pack", version: 1, author: "테스터", storeUrl: "https://store.example", itemUrl: "https://store.example/items/tall-pack", blob: (sha: string) => built.blobs.get(sha)!.bytes };
      expect(() => applyPackToProject(target, tall, context)).toThrow("그림 64×32 보다 큽니다");
      expect(target.assets.uploaded).toEqual({});
    });

    it("applies into a project with rewritten ids, restored data URLs and origin, and replaces on update", async () => {
      const built = await buildPack(project(), { tilesetIds: ["forest"], assetIds: [] }, META, { readAsset, sha256 });
      const target = { tilesets: {}, assets: { uploaded: {} } } as unknown as Project;
      const blob = (sha: string) => built.blobs.get(sha)!.bytes;
      const context = { slug: "forest-pack", version: 1, author: "테스터", storeUrl: "https://store.example", itemUrl: "https://store.example/items/forest-pack", blob };
      const first = applyPackToProject(target, built.manifest, context);
      expect(first.replaced).toBe(false);
      const tilesetId = storeProjectId("forest-pack", "forest");
      const tileset = target.tilesets[tilesetId]!;
      expect(tileset.image).toEqual({ type: "uploaded", id: storeProjectId("forest-pack", "sheet") });
      expect(tileset.tileGrafts![0]!.sourceChipset).toBe(storeProjectId("forest-pack", "extra"));
      expect(tileset.tileGrafts![1]!.sourceChipset).toBe("tex_bundled_town");
      expect(tileset.referenceDocuments![0]!.images[0]!.dataUrl).toMatch(/^data:image\/png;base64,/);
      const asset = target.assets.uploaded[storeProjectId("forest-pack", "sheet")]!;
      expect(asset.origin).toMatchObject({ itemSlug: "forest-pack", version: 1, license: "CC-BY-4.0", aiGenerated: true });
      expect(asset.dataUrl).toBe(project().assets.uploaded.sheet!.dataUrl);

      const second = applyPackToProject(target, built.manifest, { ...context, version: 2 });
      expect(second.replaced).toBe(true);
      expect(Object.keys(target.tilesets)).toHaveLength(1);
      expect(storeItemsInProject(target)).toMatchObject([{ slug: "forest-pack", version: 2, tilesetIds: [tilesetId] }]);
      const credits = storeCredits(target);
      expect(credits).toContain("「숲 마을 팩」 — 테스터 · CC-BY-4.0 · AI 생성 포함");
      expect(credits).toContain("그림: 테스터");
    });

    it("makes stable ascii slugs even from Korean titles", () => {
      expect(slugify("Forest Village Pack!", "Ab12xyz9")).toBe("forest-village-pack-ab12xyz9");
      expect(slugify("숲 마을", "k9")).toBe("sup-maeul-k9");
      expect(slugify("버들항 — 로마풍 항구 도시", "ab12")).toBe("beodeulhang-romapung-hanggu-dosi-ab12");
      expect(slugify("!!", "k9")).toBe("item-k9");
    });

    it("only lets people upload what they made: no store, shared-library or third-party packs", () => {
      expect(uploadBlockReason("my_forest", "내 숲 칩셋", undefined)).toBeNull();
      expect(uploadBlockReason("store_x__forest", "숲", { itemSlug: "x" })).toContain("스토어에서 받은 것");
      expect(uploadBlockReason("shared_tileset_interior_materials", "실내", undefined)).toContain("공용 자료집");
      expect(uploadBlockReason("paw_public_direct", "PAW 직접 배치 · 공공", undefined)).toContain("제3자");
      expect(uploadBlockReason("t1", "Rasak Fantasy 마을", undefined)).toContain("제3자");
      expect(uploadBlockReason("t2", "RPG Maker MV 실내", undefined)).toContain("제3자");
      expect(uploadBlockReason("pawn_shop", "전당포 pawnshop", undefined)).toBeNull();
    });

    it("finds third-party names glued to words or digits but not inside ordinary words", () => {
      for (const name of ["rasaktown", "rasak01_house", "RASAK-B", "refmap2", "PAWModern", "paw_modern", "mv_actor1", "MZ Exterior", "RPGMaker 실내", "라삭 마을"]) expect(storeThirdPartyName(name), name).not.toBeNull();
      for (const name of ["pawn_shop", "전당포 pawnshop", "mvp_trophy", "내 숲 칩셋", "tex_easyrpg_chipset_retro_house"]) expect(storeThirdPartyName(name), name).toBeNull();
    });

    it("lets only REFMAP-MODIFIED items carry the refmap name, and keeps every other third-party name out", () => {
      expect(storeThirdPartyName("RefmapDoll12-3", "REFMAP-MODIFIED")).toBeNull();
      expect(storeThirdPartyName("RefmapDoll12-3", "OPRN-GAME")).toBe("refmap");
      expect(storeThirdPartyName("refmap rasak mix", "REFMAP-MODIFIED")).toBe("rasak");
      expect(storeThirdPartyName("rtp actor", "REFMAP-MODIFIED")).toBe("rtp");
    });

    it("does not treat the EasyRPG RTP credit as RPG Maker RTP, but still catches bare RTP", () => {
      for (const text of [
        "Walking chips based on EasyRPG RTP (CC BY 4.0)", "easyrpg rtp", "EasyRPG-RTP", "EASYRPG  RTP", "Easy RPG RTP",
        "https://github.com/EasyRPG/RTP", "그림: EasyRPG RTP 바탕 · CC BY 4.0",
      ]) expect(storeThirdPartyName(text), text).toBeNull();
      for (const text of ["RTP", "RTP 소재", "RPG Maker RTP", "rtp_actor1", "EasyRPG RTP and RTP chars"]) {
        expect(storeThirdPartyName(text), text).not.toBeNull();
      }
    });

    it("refuses a pack when a picked tileset drags in third-party or store-bought dependencies", async () => {
      const p = project();
      p.assets.uploaded.extra!.name = "Rasak town A";
      p.assets.uploaded.bought = { id: "bought", name: "산 타일", kind: "chipset", dataUrl: dataUrl(png(16, 16, 5)), meta: {}, origin: { itemSlug: "x" } as UploadedAsset["origin"] };
      p.tilesets.forest!.tileGrafts = [...p.tilesets.forest!.tileGrafts!, { targetTile: 2, sourceChipset: "bought", sourceTile: 0 }];
      p.tilesets.forest!.referenceSourceTilesetId = "refmap_ts";
      p.tilesets.refmap_ts = { ...basicTilesetFor("sheet", "도시", 64, 32, 16), id: "refmap_ts" };
      expect(packBlockedItems(p, { tilesetIds: ["forest"], assetIds: [] }).map((item) => item.id).sort()).toEqual(["bought", "extra", "refmap_ts"]);
      const refused = buildPack(p, { tilesetIds: ["forest"], assetIds: [] }, META, { readAsset, sha256 });
      await expect(refused).rejects.toBeInstanceOf(StorePackBlockedError);
      await expect(refused).rejects.toThrow("bought — 스토어에서 받은 것은 다시 올릴 수 없습니다");
    });

    it("encodes and decodes a single-file OPK1 pack bundle with sha256 verification", async () => {
      const built = await buildPack(project(), { tilesetIds: ["forest"], assetIds: ["song"] }, META, { readAsset, sha256 });
      const bundle = encodePackBundle(built.manifest, (sha) => built.blobs.get(sha)!.bytes);
      const decoded = decodePackBundle(bundle, (bytes) => createHash("sha256").update(bytes).digest("hex"));
      expect(decoded.manifest).toEqual(built.manifest);
      expect(decoded.blobs.size).toBe(built.blobs.size);
      for (const [sha, blob] of built.blobs) {
        expect(decoded.blobs.get(sha)).toEqual(blob.bytes);
      }
    });
  });
  describe("AI 생성 표시 강제", () => {
    const asset = (over: Partial<UploadedAsset>): UploadedAsset => ({ id: "a", name: "a", kind: "picture", dataUrl: "", meta: {}, ...over });
    it("만든 경로 표식·공방 시트 id·스토어의 AI 생성품을 AI 가 만든 것으로 본다", () => {
      expect(aiMaker(asset({ generatedBy: "original-music" }))).toBe("original-music");
      expect(aiMaker(asset({ id: "workshop_1a2b_3c" }))).toBe("workshop");
      expect(aiMaker(asset({ origin: { aiGenerated: true } as UploadedAsset["origin"] }))).toBe("store");
      expect(aiMaker(asset({}))).toBeNull();
    });
    it("타일셋을 고르면 이식 시트까지 보고, 하나라도 있으면 meta 가 false 여도 매니페스트는 AI 생성", async () => {
      const p = project();
      p.assets.uploaded.extra!.generatedBy = "workshop";
      expect(aiMadeAssets(p, { tilesetIds: ["forest"], assetIds: [] })).toEqual([{ id: "extra", name: "이식 원본", by: "workshop" }]);
      expect(aiMadeAssets(p, { tilesetIds: ["other"], assetIds: [] })).toEqual([]);
      const forced = await buildPack(p, { tilesetIds: ["forest"], assetIds: [] }, { ...META, aiGenerated: false }, { readAsset, sha256 });
      expect(forced.manifest.aiGenerated).toBe(true);
      const own = await buildPack(p, { tilesetIds: ["other"], assetIds: [] }, { ...META, aiGenerated: false }, { readAsset, sha256 });
      expect(own.manifest.aiGenerated).toBe(false);
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
