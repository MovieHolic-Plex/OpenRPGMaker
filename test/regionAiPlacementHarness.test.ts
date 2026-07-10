import { describe, expect, it } from "vitest";
import {
  buildRegionTaskMessage,
  ensureRegionPlacementHarness,
  formatApprovedPropVocabHint,
  REGION_PROP_VOCAB,
} from "@/editor/regionTask/runRegionTask";
import { BUILD_PALETTE_PRESETS } from "@/editor/panels/buildPaletteCore";
import { toOpenAiTools } from "@/editor/tools";
import { beginAssistantToolDomainTurn, computeActiveToolDomains } from "@/editor/assistantToolMode";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { approvedVocabulary } from "@/project/tileVocabulary";
import { TILE } from "@/project/defaults/constants";

const MAP_ID = "map_region_harness";
const REGION = { x: 2, y: 2, width: 12, height: 10 };

function makeMapProject() {
  const context = { project: createBlankProject() };
  const created = runTool(context, "create_map", { id: MAP_ID, name: "하네스", width: 20, height: 16 });
  expect(created.ok).toBe(true);
  context.project.maps[MAP_ID].lowerTiles.fill(TILE.GRASS);
  context.project.maps[MAP_ID].upperTiles.fill(TILE.EMPTY);
  return context;
}

describe("region AI placement harness", () => {
  it("multi-domain region message keeps place_props/place_npc/build_house_kit exposed", () => {
    const project = makeMapProject().project;
    const tileset = project.tilesets[project.maps[MAP_ID].tilesetId];
    ensureRegionPlacementHarness(tileset);
    const msg = buildRegionTaskMessage("집과 나무 1개, npc 배치", "하네스", MAP_ID, REGION, tileset);
    beginAssistantToolDomainTurn(msg);
    const domains = computeActiveToolDomains(msg);
    const tools = toOpenAiTools(undefined, { domains }).map((tool) => tool.function.name);
    expect(domains.has("tile")).toBe(true);
    expect(domains.has("event")).toBe(true);
    expect(tools).toContain("place_props");
    expect(tools).toContain("place_npc");
    expect(tools).toContain("build_house_kit");
    expect(msg).toContain(BUILD_PALETTE_PRESETS.tree);
  });

  it("ensureRegionPlacementHarness approves tree group so place_props succeeds", () => {
    const context = makeMapProject();
    const tileset = context.project.tilesets[context.project.maps[MAP_ID].tilesetId];
    expect(approvedVocabulary(tileset).groups).toHaveLength(0);
    ensureRegionPlacementHarness(tileset);
    expect(approvedVocabulary(tileset).groups.some((group) => group.id === BUILD_PALETTE_PRESETS.tree)).toBe(true);
    expect(formatApprovedPropVocabHint(tileset)).toContain(BUILD_PALETTE_PRESETS.tree);
    expect(formatApprovedPropVocabHint(tileset)).toContain(REGION_PROP_VOCAB.woodBox);

    const props = runTool(context, "place_props", {
      mapId: MAP_ID,
      area: { x: 4, y: 4, w: 8, h: 6 },
      propVocabId: BUILD_PALETTE_PRESETS.tree,
      count: 1,
      seed: 7,
    });
    expect(props.ok).toBe(true);
    const upper = context.project.maps[MAP_ID].upperTiles.filter((tile) => tile >= 0 && tile !== TILE.EMPTY).length;
    const lowerDiff = context.project.maps[MAP_ID].lowerTiles.filter((tile) => tile !== TILE.GRASS).length;
    expect(upper + lowerDiff).toBeGreaterThan(0);
  });

  it("place_props wood-box places tile 237 (not random small-props)", () => {
    const context = makeMapProject();
    const tileset = context.project.tilesets[context.project.maps[MAP_ID].tilesetId];
    ensureRegionPlacementHarness(tileset);
    const result = runTool(context, "place_props", {
      mapId: MAP_ID,
      area: { x: 5, y: 5, w: 4, h: 3 },
      propVocabId: REGION_PROP_VOCAB.woodBox,
      count: 2,
      seed: 3,
      minGap: 1,
    });
    expect(result.ok).toBe(true);
    const woodTiles = context.project.maps[MAP_ID].upperTiles.filter((tile) => tile === 237).length;
    expect(woodTiles).toBeGreaterThanOrEqual(1);
    expect(woodTiles).toBeLessThanOrEqual(2);
  });

  it("박스 지시 메시지에 wood-box id가 small-props보다 앞에 노출된다", () => {
    const project = makeMapProject().project;
    const tileset = project.tilesets[project.maps[MAP_ID].tilesetId];
    ensureRegionPlacementHarness(tileset);
    const msg = buildRegionTaskMessage("박스 2개 설치해줘", "하네스", MAP_ID, REGION, tileset);
    const woodIdx = msg.indexOf(REGION_PROP_VOCAB.woodBox);
    const bagIdx = msg.indexOf(REGION_PROP_VOCAB.smallProps);
    expect(woodIdx).toBeGreaterThanOrEqual(0);
    // 전용 가이드 줄 + vocab 힌트 모두 wood-box 포함
    expect(msg).toMatch(/장식 박스.*wood-box/);
    if (bagIdx >= 0) expect(woodIdx).toBeLessThan(bagIdx);
  });

  it("place_npc without graphic uses villager charset, not transparent", () => {
    const context = makeMapProject();
    const result = runTool(context, "place_npc", {
      mapId: MAP_ID,
      x: 10,
      y: 10,
      name: "주민",
      pages: [{ lines: ["안녕하세요."] }],
    });
    expect(result.ok).toBe(true);
    const event = context.project.maps[MAP_ID].events.find((entry) => entry.pages?.[0]?.name === "주민" || entry.id.startsWith("ev_npc"));
    expect(event).toBeTruthy();
    const graphic = event?.pages?.[0]?.graphic;
    expect(graphic).toBeTruthy();
    expect(graphic && "transparent" in graphic ? graphic.transparent : false).not.toBe(true);
    expect(graphic && "sprite" in graphic ? graphic.sprite : null).toMatchObject({ type: "bundled" });
  });

  it("make_villager without graphic uses villager charset", () => {
    const context = makeMapProject();
    const result = runTool(context, "make_villager", {
      mapId: MAP_ID,
      name: "농부",
      home: { x: 8, y: 8 },
      dialogue: [{ text: "밭일이 한창이야." }],
    });
    expect(result.ok).toBe(true);
    const event = context.project.maps[MAP_ID].events.find((entry) => entry.pages?.[0]?.name === "농부");
    const graphic = event?.pages?.[0]?.graphic;
    expect(graphic && "transparent" in graphic ? graphic.transparent : false).not.toBe(true);
    expect(graphic && "sprite" in graphic ? (graphic.sprite as { id?: string }).id : "").toContain("charset");
  });
});
