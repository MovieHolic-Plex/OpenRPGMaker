import { describe, expect, it } from "vitest";
import { graftSourceGeometry, uploadedGraftGeometryIn } from "@/assets/tileGrafts";
import { translateTiles } from "@/project/objectStamp";
import type { TilesetDef } from "@/project/types";

// 2026-10-08: 768px(48칸) 공용 기물 아틀라스를 번들 기본(30칸)으로 읽어 찍은 냉장고·진열대가 투명 칸으로 그려졌다.
function tileset(id: string, image: TilesetDef["image"], tilesPerRow: number, count: number): TilesetDef {
  return { id, name: id, image, tileSize: 16, tilesPerRow, count, passability: [], priority: [], terrain: [] } as unknown as TilesetDef;
}

describe("graft source geometry for uploaded sheets", () => {
  it("records the uploaded source sheet's layout on new grafts", () => {
    const source = tileset("shared", { type: "uploaded", id: "shared_atlas" }, 48, 8186);
    const target = tileset("jp_city", { type: "bundled", id: "tex_jp_city" }, 48, 9168);
    translateTiles(source, target, [7165]);
    const graft = target.tileGrafts!.at(-1)!;
    expect(graft).toMatchObject({ sourceChipset: "shared_atlas", sourceTile: 7165, sourceTileSize: 16, sourceTilesPerRow: 48 });
    expect(graftSourceGeometry(graft)).toEqual({ tileSize: 16, tilesPerRow: 48 });
  });

  it("finds the layout of grafts saved before it was recorded", () => {
    const source = tileset("shared", { type: "uploaded", id: "shared_atlas" }, 48, 8186);
    expect(uploadedGraftGeometryIn({ shared: source }, "shared_atlas")).toEqual({ tileSize: 16, tilesPerRow: 48 });
    expect(uploadedGraftGeometryIn({ shared: source }, "tex_jp_city")).toBeNull();
  });
});
