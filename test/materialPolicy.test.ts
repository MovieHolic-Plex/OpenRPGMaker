import { describe, expect, it } from "vitest";
import {
  bagMaterialRejectMessage,
  isBagGroup,
  isBagGroupId,
  isBagMaterialQuery,
} from "@/project/materialPolicy";
import { resolveMaterialByLabel } from "@/project/tileVocabulary";
import { createBlankProject } from "@/project/defaults";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import { runTool } from "@/editor/tools/toolRunner";
import { TILE } from "@/project/defaults/constants";
import { formatMaterialLabelHint } from "@/ai/turnGuide";

const BAG_ID = `${COMBINED_TOWN_HARNESS_PREFIX}small-props`;

describe("materialPolicy bag demotion", () => {
  it("detects bag group ids and labels", () => {
    expect(isBagGroupId(BAG_ID)).toBe(true);
    expect(isBagGroupId("small-props")).toBe(true);
    expect(isBagGroupId(`${COMBINED_TOWN_HARNESS_PREFIX}wood-box`)).toBe(false);
    expect(isBagMaterialQuery("마을 소품")).toBe(true);
    expect(isBagMaterialQuery("small-props")).toBe(true);
    expect(isBagMaterialQuery("나무 상자")).toBe(false);
    expect(isBagGroup({ id: BAG_ID, name: "마을 소품", description: "잔여 소품 가방" })).toBe(true);
    expect(bagMaterialRejectMessage("마을 소품")).toMatch(/가방|구체 라벨/);
  });

  it("resolveMaterialByLabel rejects bag labels and group ids", () => {
    const project = createBlankProject();
    const tileset = project.tilesets[project.startMapId ? Object.values(project.maps)[0]!.tilesetId : Object.keys(project.tilesets)[0]!];
    const ts = Object.values(project.tilesets)[0]!;
    expect(resolveMaterialByLabel(ts, "마을 소품").status).toBe("missing");
    expect(resolveMaterialByLabel(ts, BAG_ID).status).toBe("missing");
    const ok = resolveMaterialByLabel(ts, "나무 상자");
    expect(ok.status === "approved" || ok.status === "soft").toBe(true);
  });

  it("place_props rejects bag material", () => {
    const ctx = { project: createBlankProject() };
    const mapId = "map_bag";
    expect(runTool(ctx, "create_map", { id: mapId, name: "bag", width: 16, height: 12 }).ok).toBe(true);
    ctx.project.maps[mapId].lowerTiles.fill(TILE.GRASS);
    ctx.project.maps[mapId].upperTiles.fill(TILE.EMPTY);
    const result = runTool(ctx, "place_props", {
      mapId,
      area: { x: 2, y: 2, w: 8, h: 6 },
      material: "마을 소품",
      count: 3,
      seed: 1,
    });
    expect(result.ok).toBe(false);
    expect(`${result.summary} ${JSON.stringify(result.issues ?? [])}`).toMatch(/가방|구체 라벨|small-props|마을 소품/);
  });

  it("formatMaterialLabelHint omits bag group name from examples", () => {
    const project = createBlankProject();
    const tileset = Object.values(project.tilesets)[0]!;
    const hint = formatMaterialLabelHint(tileset);
    expect(hint).not.toContain("마을 소품");
    expect(hint).not.toContain("small-props");
    expect(hint).toMatch(/침엽수|나무 상자|그룹 id 금지|가방/);
  });
});
