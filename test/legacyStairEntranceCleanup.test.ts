import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";

const guide = { id: "stair-entrance-guide", name: "계단 입구 — atlas_biome_interior", markdown: "# 옛 안내" };
const bundledImage = { id: "s1", name: "01", caption: "", dataUrl: "/assets/old/01.png" };

describe("legacy stair-entrance references", () => {
  it("drops the bundled category from a saved tileset copy", () => {
    const p = createBlankProject();
    const city = p.tilesets.atlas_biome_interior!;
    city.referenceDocuments = [...city.referenceDocuments!, { id: "stair-entrance", name: "계단 입구", description: "", documents: [guide], images: [bundledImage] }];
    expect(ensureBundledTilesets(p)).toBe(true);
    expect(p.tilesets.atlas_biome_interior!.referenceDocuments!.some((c) => c.id === "stair-entrance")).toBe(false);
  });

  it("keeps author pages and uploads left in that category", () => {
    const p = createBlankProject();
    const city = p.tilesets.atlas_biome_interior!;
    const note = { id: "author-note", name: "내 메모", markdown: "계단은 북쪽" };
    const upload = { id: "u1", name: "내 그림", caption: "", dataUrl: "data:image/png;base64,AAAA" };
    city.referenceDocuments = [...city.referenceDocuments!, { id: "stair-entrance", name: "계단 입구", description: "", documents: [guide, note], images: [bundledImage, upload] }];
    ensureBundledTilesets(p);
    const kept = p.tilesets.atlas_biome_interior!.referenceDocuments!.find((c) => c.id === "stair-entrance")!;
    expect(kept.documents).toEqual([note]);
    expect(kept.images).toEqual([upload]);
  });
});
