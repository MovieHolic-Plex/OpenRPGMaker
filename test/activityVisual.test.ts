import { describe, expect, it } from "vitest";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { searchResources } from "@/assets/resourceSearch";
import { captureActivityVisuals } from "@/ai/activityVisual";
import type { Project } from "@/project/types";

const project = { maps: {}, tilesets: {}, assets: { uploaded: {} }, database: {} } as unknown as Project;

function preview(kind: "backdrop" | "charset" | "monster" | "tile", query: string) {
  const matches = searchResources(kind, query, { monsterProject: { resourceProfiles: [], assets: { uploaded: {} } } });
  return captureActivityVisuals(project, "list_resources", { kind, query }, { ok: true, data: { matches } });
}

describe("captureActivityVisuals resource search", () => {
  it("draws a charset hit from the sheet file, not the search id", () => {
    const [visual] = preview("charset", "남자아이");
    expect(visual?.title).toBe("남자아이");
    expect(visual?.caption).toBe("검색된 소재");
    expect(visual?.resourceId).toBe("tex_easyrpg_charset_people1");
    expect(visual?.pattern).toBe(charsetFrameIndex({ characterIndex: 0, direction: "down", pattern: 1 }));
    expect(resolveAssetResourceUrl(visual?.resourceId)).toBe("/assets/easyrpg/charset/People1.png");
    expect(resolveAssetResourceUrl("charset:tex_easyrpg_charset_people1:0")).toBeNull();
  });

  it("draws a backdrop hit from the asset id behind the search prefix", () => {
    const [visual] = preview("backdrop", "cosmos");
    expect(visual?.resourceId).toBe("easyrpg-backdrop-cosmos1");
    expect(resolveAssetResourceUrl(visual?.resourceId)).toBe("/assets/easyrpg/backdrop/Cosmos1.png");
  });

  it("keeps a monster catalog id that already resolves", () => {
    const [visual] = preview("monster", "slime");
    expect(visual?.resourceId).toMatch(/^generated-enemy-slime/);
    expect(resolveAssetResourceUrl(visual?.resourceId)).toMatch(/\.png$/);
  });

  it("does not attach a tile card whose search id is not a file", () => {
    expect(searchResources("tile", "표지판").some((match) => match.id === "tile:320")).toBe(true);
    expect(preview("tile", "표지판").some((visual) => visual.resourceId?.startsWith("tile:"))).toBe(false);
  });
});
