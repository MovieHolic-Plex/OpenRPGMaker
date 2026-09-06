import { describe, expect, it } from "vitest";
import { defaultTilesets, ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { worldTileDescription } from "@/project/defaults/worldTileDescriptions";
import { CHIPSET_LABEL_CORRECTIONS } from "@/project/defaults/chipsetLabelCorrections";
import { deserialize, serialize } from "@/project/io";
import { applyEasyRpgThemeMetadataPacks } from "@/project/tilesetHarness/themePacks";
import { resolveMaterialByLabel } from "@/project/tileVocabulary";
import type { TilesetDef } from "@/project/types";

const WORLD_ID = "easyrpg_chipset_world";
const WORLD_TEXTURE = "tex_easyrpg_chipset_world";
const BLANK_SLOTS = [233, 258];
const tileset = () => defaultTilesets()[WORLD_ID]!;
const descriptions = (ts: TilesetDef) => ts.tileMeta!.map(meta => meta.description);

function clearDescriptions(ts: TilesetDef): void {
  for (const meta of ts.tileMeta!) meta.description = "";
}

function withoutDescriptions(ts: TilesetDef): TilesetDef {
  const result = structuredClone(ts);
  clearDescriptions(result);
  return result;
}

describe("World tile descriptions", () => {
  it("documents every one of the 478 drawn slots and leaves the two blank slots empty", () => {
    const described: number[] = [];
    const empty: number[] = [];
    for (let tile = 0; tile < 480; tile++) {
      const description = worldTileDescription(tile);
      if (description.trim()) {
        described.push(tile);
        expect(description, `tile ${tile}`).toMatch(/[가-힣]/);
      } else {
        empty.push(tile);
      }
    }
    expect(described).toHaveLength(478);
    expect(empty).toEqual(BLANK_SLOTS);
    for (const tile of [-1, 480, 900]) expect(worldTileDescription(tile)).toBe("");
  });

  it("fills legacy World descriptions without changing any other metadata or runtime flag", () => {
    const ts = tileset();
    clearDescriptions(ts);
    const before = withoutDescriptions(ts);
    expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(true);
    const corrected = new Map(CHIPSET_LABEL_CORRECTIONS
      .filter(entry => entry.textureKey === WORLD_TEXTURE)
      .map(entry => [entry.index, entry.description]));
    expect(descriptions(ts)).toEqual(Array.from({ length: 480 }, (_, tile) => corrected.get(tile) ?? worldTileDescription(tile)));
    expect(withoutDescriptions(ts)).toEqual(before);
    expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(false);
  });

  it.each([
    { name: "피아노", tiles: [417, 418, 419], layout: "[417,418,419]" },
    { name: "파이프오르간", tiles: [444, 445, 474, 475], layout: "[444,445] / [474,475]" },
    { name: "큰 붉은 왕좌", tiles: [447, 448, 449, 477, 478, 479], layout: "[447,448,449] / [477,478,479]" },
  ])("describes the complete $name assembly without rewriting older semantic labels", ({ name, tiles, layout }) => {
    const ts = tileset();
    const labels = tiles.map(tile => ts.tileMeta![tile]!.label);
    for (const tile of tiles) ts.tileMeta![tile]!.description = "";
    applyEasyRpgThemeMetadataPacks(ts);
    for (const tile of tiles) {
      expect(ts.tileMeta![tile]!.description, `tile ${tile}`).toContain(name);
      expect(ts.tileMeta![tile]!.description, `tile ${tile}`).toContain(layout);
    }
    expect(tiles.map(tile => ts.tileMeta![tile]!.label)).toEqual(labels);
  });

  it("preserves existing nonempty World prose even when metadata is not user locked", () => {
    const ts = tileset();
    ts.tileMeta![67]!.description = "  마을 입구에서만 쓰는 흙길입니다.  ";
    ts.tileMeta![262] = { ...ts.tileMeta![262]!, source: "ai", description: "여울 마을의 작은 여관입니다." };
    const expected = [67, 262].map(tile => ts.tileMeta![tile]!.description);
    applyEasyRpgThemeMetadataPacks(ts);
    expect([67, 262].map(tile => ts.tileMeta![tile]!.description)).toEqual(expected);
    expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(false);
  });

  it("preserves complete user-authored and locked metadata, including deliberately empty descriptions", () => {
    const ts = tileset();
    ts.tileMeta![67] = {
      label: "사용자가 정한 길", description: "", source: "user", tags: ["개인 지도"],
      role: "prop", defaultLayer: "upper", passage: "star", confidence: "low",
    };
    ts.tileMeta![120] = {
      label: "잠근 바다", description: "수정하지 않는 바다 설명", source: "ai", userLocked: true,
      tags: ["잠금"], role: "prop", defaultLayer: "upper", passage: "passable", repeatability: "fixed",
    };
    for (const tile of [67, 120]) {
      ts.priority[tile] = "upper";
      ts.passability[tile] = { up: true, down: false, left: true, right: false };
    }
    const authored = () => [67, 120].map(tile => ({
      meta: ts.tileMeta![tile], priority: ts.priority[tile], passability: ts.passability[tile],
    }));
    const before = structuredClone(authored());
    applyEasyRpgThemeMetadataPacks(ts);
    expect(authored()).toEqual(before);
    expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(false);
  });

  it("does not attach original artwork descriptions to grafted slots and preserves their existing prose", () => {
    const ts = tileset();
    ts.tileMeta![67]!.description = "";
    ts.tileMeta![262]!.description = "";
    ts.tileMeta![120]!.description = "바다 자리에 이식한 집 그림입니다.";
    ts.tileGrafts = [67, 120, 262].map(targetTile => ({ targetTile, sourceChipset: WORLD_TEXTURE, sourceTile: 292 }));
    const before = withoutDescriptions(ts);
    applyEasyRpgThemeMetadataPacks(ts);
    expect([67, 120, 262].map(tile => ts.tileMeta![tile]!.description)).toEqual(["", "바다 자리에 이식한 집 그림입니다.", ""]);
    expect(withoutDescriptions(ts)).toEqual(before);
    expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(false);
    delete ts.tileGrafts;
    expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(true);
    expect(ts.tileMeta![67]!.description).toBe(worldTileDescription(67));
    expect(ts.tileMeta![262]!.description).toBe(worldTileDescription(262));
    expect(ts.tileMeta![120]!.description).toBe("바다 자리에 이식한 집 그림입니다.");
  });

  it("does not introduce World prose into other bundled chipsets or an uploaded atlas with the same ID", () => {
    for (const ts of Object.values(defaultTilesets())) {
      if (ts.id === WORLD_ID) continue;
      const before = structuredClone(ts);
      applyEasyRpgThemeMetadataPacks(ts);
      expect(ts, ts.id).toEqual(before);
    }
    const uploaded = tileset();
    uploaded.image = { type: "uploaded", id: WORLD_TEXTURE };
    clearDescriptions(uploaded);
    const before = structuredClone(uploaded);
    expect(applyEasyRpgThemeMetadataPacks(uploaded)).toBe(false);
    expect(uploaded).toEqual(before);
  });

  it("fills legacy prose during load-time ensure and preserves it through later save/load cycles", () => {
    const project = createBlankProject();
    const ts = project.tilesets[WORLD_ID]!;
    clearDescriptions(ts);
    ts.tileMeta![262]!.description = "저장한 여울 마을 설명";
    ts.tileMeta![67] = { ...ts.tileMeta![67]!, source: "user", description: "" };
    ts.tileMeta![120] = { ...ts.tileMeta![120]!, userLocked: true, description: "잠근 바다 설명" };
    ts.tileGrafts = [{ targetTile: 292, sourceChipset: WORLD_TEXTURE, sourceTile: 262 }];
    const loaded = deserialize(serialize(project));
    // ProjectStore runs this after deserialization; parsing alone does not seed defaults.
    ensureBundledTilesets(loaded);
    const loadedTs = loaded.tilesets[WORLD_ID]!;
    expect(loadedTs.tileMeta![0]!.description).toBe(worldTileDescription(0));
    expect([67, 120, 262, 292].map(tile => loadedTs.tileMeta![tile]!.description))
      .toEqual(["", "잠근 바다 설명", "저장한 여울 마을 설명", ""]);
    expect(loadedTs.tileGrafts).toEqual(ts.tileGrafts);
    const before = structuredClone(loadedTs);
    ensureBundledTilesets(loaded);
    expect(loadedTs).toEqual(before);
    expect(applyEasyRpgThemeMetadataPacks(loadedTs)).toBe(false);
    const reloaded = deserialize(serialize(loaded));
    ensureBundledTilesets(reloaded);
    const reloadedTs = reloaded.tilesets[WORLD_ID]!;
    expect(reloadedTs.tileMeta).toEqual(loadedTs.tileMeta);
    expect(reloadedTs.tileGrafts).toEqual(loadedTs.tileGrafts);
    expect(applyEasyRpgThemeMetadataPacks(reloadedTs)).toBe(false);
  });

  it("resolves a World material by its seeded description without a label or tag match", () => {
    const ts = tileset();
    const description = ts.tileMeta![417]!.description;
    expect(description).not.toBe("");
    ts.tileMeta![417]!.label = "";
    ts.tileMeta![417]!.tags = [];
    const result = resolveMaterialByLabel(ts, description, { preferGroup: false });
    expect(result).toMatchObject({ kind: "tile", tileId: 417, matchedLabel: "", matchedDescription: description });
    expect(result.status).not.toBe("missing");
    ts.tileMeta![417]!.description = "";
    expect(resolveMaterialByLabel(ts, description, { preferGroup: false })).not.toMatchObject({ kind: "tile", tileId: 417 });
  });
});
