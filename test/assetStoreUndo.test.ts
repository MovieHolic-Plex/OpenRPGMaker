import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { storeProjectId } from "@/assetStore/format";
import { applyPackToProject, basicTilesetFor, buildPack, type ApplyContext, type BuiltPack } from "@/assetStore/pack";
import { bytesToBase64 } from "@/assetStore/sniff";
import { humanStoreError, landedLines, landedSummary } from "@/editor/assetStore/storeText";
import { captureStoreAdd, removeStaleStoreAssets, removeStoreItem, staleStoreAssetIds, storeAddKeys, storeItemUsages, undoStoreAdd } from "@/editor/assetStore/storeUndo";
import type { Project, UploadedAsset } from "@/project/types";

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
