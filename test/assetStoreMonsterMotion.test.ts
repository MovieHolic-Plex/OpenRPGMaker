// 스토어 몬스터의 전투 도트 시트(meta.pixelEnemySheet): 매니페스트 검사 → 넣기(id 바꾸기·크기 검사) → 전투 조회 → 웹 내보내기 포함.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { storeMonsterSheetSizeProblems, storeProjectId, validateManifest, type StorePackManifest } from "@/assetStore/format";
import { applyPackToProject, buildPack, closeSelection } from "@/assetStore/pack";
import { bytesToBase64, pngSize } from "@/assetStore/sniff";
import { monsterBattleMotion, pixelEnemyCell, projectPixelEnemySheet } from "@/assets/pixelEnemySheets";
import { isAuthoredMonsterAsset } from "@/editor/tools/enemyPixelSheetTools";
import { createBlankProject } from "@/project/defaults";
import { collectUsedUploadedAssetIds } from "@/project/webExportAssets";
import type { Project, UploadedAsset } from "@/project/types";

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
