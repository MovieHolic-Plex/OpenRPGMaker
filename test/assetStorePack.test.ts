import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { STORE_BLOB_PREFIX, slugify, storeProjectId, validateManifest, packGrade } from "@/assetStore/format";
import { applyPackToProject, basicTilesetFor, buildPack, closeSelection, storeCredits, storeItemsInProject, type PackMeta } from "@/assetStore/pack";
import { bytesToBase64, pngSize, sniffMime } from "@/assetStore/sniff";
import type { Project, TilesetDef, UploadedAsset } from "@/project/types";

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
});
