import { geographyChromeState, type GeographyTool } from "@/editor/panels/spatialGeographyChromeState";
import { commitWorkingGeography, mutateWorkingGeography } from "@/editor/panels/spatialGeographyCommands";
import type { GeographyDesign, GeographyDraftTarget, GeographyKind } from "@/editor/panels/spatialGeographyDraft";
import { GEOGRAPHY_MATERIALS, setTerrainFloor } from "@/editor/panels/spatialGeographyGeometry";
import { WORLD_TERRAIN_BLOCKS } from "@/project/defaults/worldTerrainAutotiles";
import { el } from "@/util/dom";

const TOOL_LABEL: Record<GeographyTool, string> = {
  select: "선택",
  route: "경로",
  entry: "진입",
  terrain: "지형",
};

const MATERIAL_LABEL: Record<string, string> = {
  ground: "땅",
  water: "물",
  "mountain:grass": "산:풀",
  "mountain:dirt": "산:흙",
  "mountain:snow": "산:눈",
  ...Object.fromEntries(WORLD_TERRAIN_BLOCKS.map((block) => [block.key, block.name])),
};

export function renderGeographyTools(kind: GeographyKind, rerender: () => void): HTMLElement {
  const tools: readonly GeographyTool[] = kind === "region"
    ? ["select", "route", "terrain"]
    : ["select", "entry", "terrain"];
  return el("div", {
    class: "spatial-geography-tools",
    dataset: { testid: "spatial-geography-tools" },
    children: tools.map((tool) => el("button", {
      class: `spatial-source-chip${geographyChromeState.tool === tool ? " is-active" : ""}`,
      text: TOOL_LABEL[tool],
      attrs: { type: "button", "aria-pressed": String(geographyChromeState.tool === tool) },
      dataset: { testid: `spatial-geography-tool-${tool}` },
      on: {
        click: () => {
          geographyChromeState.tool = tool;
          geographyChromeState.routeDraft = [];
          rerender();
        },
      },
    })),
  });
}

export function renderGeographyMaterials(
  design: GeographyDesign,
  target: GeographyDraftTarget,
  rerender: () => void,
): HTMLElement {
  return el("div", {
    class: "spatial-geography-materials",
    dataset: { testid: "spatial-geography-materials" },
    children: GEOGRAPHY_MATERIALS.map((material) => el("button", {
      class: `spatial-source-chip${design.terrain.floor === material ? " is-active" : ""}`,
      text: MATERIAL_LABEL[material] ?? material,
      attrs: { type: "button", "aria-pressed": String(design.terrain.floor === material) },
      dataset: { testid: `spatial-geography-material-${material}` },
      on: {
        click: () => {
          const edited = setTerrainFloor(design, material);
          if (edited.kind === "ok") mutateWorkingGeography(target, () => edited.design);
          else commitWorkingGeography(target, edited);
          rerender();
        },
      },
    })),
  });
}
