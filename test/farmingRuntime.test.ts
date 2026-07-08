import { describe, expect, it } from "vitest";
import { DB_TOOLS } from "@/editor/tools/dbTools";
import { MAP_TOOLS } from "@/editor/tools/mapTools";
import { createBlankProject, createFarmingDemoProject } from "@/project/defaults";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { cropReady, farmPlotAt, interactWithFarmPlot, advanceFarmPlotsForDay } from "@/player/farming";
import { createInterpreter } from "@/player/interpreter";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { startSession } from "@/project/session";
import { runSceneTest } from "@/testing/sceneTestRunner";

function demoRuntime() {
  const project = createFarmingDemoProject();
  const session = startSession(project, 1);
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("missing farming demo map");
  return { project, session, map };
}

describe("Phase 10b 농사 런타임", () => {
  it("괭이질, 심기, 물주기, 성장, 수확 상태 머신을 처리한다", () => {
    const { project, session, map } = demoRuntime();
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("tilled");
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("planted");
    expect(session.inventory.item_potato_seed).toBe(2);
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("watered");

    advanceFarmPlotsForDay(project, session, 1, "spring");
    expect(farmPlotAt(session, map.id, 4, 5)?.stage).toBe(1);
    expect(farmPlotAt(session, map.id, 4, 5)?.watered).toBe(false);
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("watered");
    advanceFarmPlotsForDay(project, session, 1, "spring");

    const ready = farmPlotAt(session, map.id, 4, 5);
    expect(ready?.stage).toBe(2);
    expect(cropReady(project, ready)).toBe(true);
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("harvested");
    expect(session.inventory.item_potato).toBe(1);
    expect(farmPlotAt(session, map.id, 4, 5)).toEqual({ tilled: true, watered: false });
  });

  it("물을 주지 않은 날은 성장하지 않는다", () => {
    const { project, session, map } = demoRuntime();
    interactWithFarmPlot(project, session, map, 4, 5);
    interactWithFarmPlot(project, session, map, 4, 5);
    advanceFarmPlotsForDay(project, session, 1, "spring");
    expect(farmPlotAt(session, map.id, 4, 5)?.stage).toBe(0);
    expect(farmPlotAt(session, map.id, 4, 5)?.growthDays).toBe(0);
  });

  it("재배 가능 계절 밖 작물은 죽고 watered를 리셋한다", () => {
    const { project, session, map } = demoRuntime();
    interactWithFarmPlot(project, session, map, 4, 5);
    interactWithFarmPlot(project, session, map, 4, 5);
    interactWithFarmPlot(project, session, map, 4, 5);
    advanceFarmPlotsForDay(project, session, 1, "summer");
    expect(farmPlotAt(session, map.id, 4, 5)?.dead).toBe(true);
    expect(farmPlotAt(session, map.id, 4, 5)?.watered).toBe(false);
  });

  it("재수확 작물은 수확 후 regrow 단계로 후퇴한다", () => {
    const { project, session, map } = demoRuntime();
    session.inventory.item_potato_seed = 0;
    interactWithFarmPlot(project, session, map, 5, 5);
    interactWithFarmPlot(project, session, map, 5, 5);
    expect(farmPlotAt(session, map.id, 5, 5)?.cropId).toBe("crop_strawberry");
    interactWithFarmPlot(project, session, map, 5, 5);
    advanceFarmPlotsForDay(project, session, 1, "spring");
    interactWithFarmPlot(project, session, map, 5, 5);
    advanceFarmPlotsForDay(project, session, 1, "spring");
    expect(interactWithFarmPlot(project, session, map, 5, 5).kind).toBe("harvested");
    expect(session.inventory.item_strawberry).toBe(2);
    expect(farmPlotAt(session, map.id, 5, 5)?.stage).toBe(1);

    interactWithFarmPlot(project, session, map, 5, 5);
    advanceFarmPlotsForDay(project, session, 1, "spring");
    expect(interactWithFarmPlot(project, session, map, 5, 5).kind).toBe("harvested");
    expect(session.inventory.item_strawberry).toBe(4);
  });

  it("세이브/로드가 farmPlots를 왕복 보존한다", () => {
    const { project, session, map } = demoRuntime();
    interactWithFarmPlot(project, session, map, 4, 5);
    interactWithFarmPlot(project, session, map, 4, 5);
    interactWithFarmPlot(project, session, map, 4, 5);
    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
    expect(restored.farmPlots).toEqual(session.farmPlots);
  });

  it("farmableArea 밖 상호작용은 무시한다", () => {
    const { project, session, map } = demoRuntime();
    const result = interactWithFarmPlot(project, session, map, 1, 1);
    expect(result.kind).toBe("ignored");
    expect(session.farmPlots?.[map.id]).toBeUndefined();
  });

  it("define_crop과 create_farm_plot 툴을 실행한다", () => {
    const project = createBlankProject();
    const itemId = project.database.items[0]?.id ?? "item_potion";
    project.database.items.push(normalizeItemRecord({ id: "item_turnip", name: "순무", scope: "none", price: 30 }));
    const defineCrop = DB_TOOLS.find((tool) => tool.name === "define_crop");
    const createFarmPlot = MAP_TOOLS.find((tool) => tool.name === "create_farm_plot");
    if (!defineCrop || !createFarmPlot) throw new Error("missing farming tools");

    const cropResult = defineCrop.run(project, {
      crop: {
        id: "crop_turnip",
        name: "순무",
        seedItemId: itemId,
        harvestItemId: "item_turnip",
        stages: [{ days: 1 }],
        seasons: ["spring"],
      },
    });
    const plotResult = createFarmPlot.run(project, {
      mapId: project.startMapId,
      area: { x: 2, y: 2, w: 3, h: 2 },
    });

    expect(cropResult.summary).toContain("작물");
    expect(project.database.crops?.some((crop) => crop.id === "crop_turnip")).toBe(true);
    expect(plotResult.data).toEqual({ mapId: project.startMapId, area: { x: 2, y: 2, w: 3, h: 2 } });
    expect(project.maps[project.startMapId]?.farmableArea).toContainEqual({ x: 2, y: 2, w: 3, h: 2 });
  });

  it("advanceCropGrowth 커맨드가 현재 세션 작물을 성장시킨다", () => {
    const { project, session, map } = demoRuntime();
    interactWithFarmPlot(project, session, map, 4, 5);
    interactWithFarmPlot(project, session, map, 4, 5);
    interactWithFarmPlot(project, session, map, 4, 5);
    const interpreter = createInterpreter([{ kind: "advanceCropGrowth", days: 1 }], session, project);
    expect(interpreter.start().kind).toBe("done");
    expect(farmPlotAt(session, map.id, 4, 5)?.stage).toBe(1);
  });

  it("run_scene_test에서 봄 감자를 심고 매일 물을 준 뒤 수확한다", () => {
    const project = createFarmingDemoProject();
    const potato = project.database.items.find((item) => item.id === "item_potato");
    expect(potato?.price).toBeGreaterThan(0);
    const result = runSceneTest(project, {
      mapId: project.startMapId,
      start: project.startPos,
      steps: [
        { kind: "interact" },
        { kind: "interact" },
        { kind: "interact" },
        { kind: "advanceDays", days: 1 },
        { kind: "expect", cropStageAt: { x: 4, y: 5, stage: 1 } },
        { kind: "interact" },
        { kind: "advanceDays", days: 1 },
        { kind: "expect", cropStageAt: { x: 4, y: 5, stage: 2 } },
        { kind: "interact" },
        { kind: "expect", inventoryCount: { itemId: "item_potato", count: 1 } },
      ],
    });
    expect(result.ok, result.failureReason).toBe(true);
    expect(result.log.some((entry) => entry.includes("farm harvested"))).toBe(true);
  });
});
