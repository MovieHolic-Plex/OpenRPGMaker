import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { STORE_PACK_SCHEMA, storeProjectId, validateManifest, type StorePackManifest } from "@/assetStore/format";
import { applyPackToProject, storeAppearanceId } from "@/assetStore/pack";
import { captureStoreAdd, storeAddKeys, undoStoreAdd } from "@/editor/assetStore/storeUndo";
import { appearancePortraitForEmotion, faceForDialogueEmotion, resolveAppearancePortrait } from "@/project/characterAppearances";
import type { Project } from "@/project/types";

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
