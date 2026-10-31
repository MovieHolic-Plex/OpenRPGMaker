// 스토어 전투 애니메이션(content.battleAnimations): 매니페스트 검사 → 넣기(id 바꾸기·덮지 않기·다시 넣기) → 되돌리기 → 웹 내보내기 포함 → 프레임 hold 길이.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { STORE_ANIMATION_EASYRPG_SOUNDS, storeBattleAnimationSizeProblems, storeProjectId, validateManifest, type StorePackManifest } from "@/assetStore/format";
import { EASYRPG_SOUND_ASSETS } from "@/assets/easyrpgRtp";
import { applyPackToProject, storeAnimationId } from "@/assetStore/pack";
import { pngSize } from "@/assetStore/sniff";
import { battleAnimationChainDurationMs, battleAnimationDurationMs, battleAnimationFrameAtUnits } from "@/battle/animationTiming";
import { captureStoreAdd, removeStoreItem, storeAddKeys, undoStoreAdd } from "@/editor/assetStore/storeUndo";
import { normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import { createBlankProject } from "@/project/defaults";
import { collectUsedUploadedAssetIds } from "@/project/webExportAssets";
import type { BattleAnimationRecord, Project } from "@/project/types";

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
