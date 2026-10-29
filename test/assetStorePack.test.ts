import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { REFMAP_CREDIT, STORE_BLOB_PREFIX, STORE_SLUG, slugify, storeProjectId, storeThirdPartyName, validateManifest, packGrade } from "@/assetStore/format";
import { aiMadeAssets, aiMaker, applyPackToProject, basicTilesetFor, buildPack, closeSelection, decodePackBundle, encodePackBundle, packBlockedItems, storeCredits, storeItemsInProject, StorePackBlockedError, type PackMeta } from "@/assetStore/pack";
import { bytesToBase64, pngSize, sniffMime } from "@/assetStore/sniff";
import { uploadBlockReason } from "@/editor/assetStore/storeUpload";
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
