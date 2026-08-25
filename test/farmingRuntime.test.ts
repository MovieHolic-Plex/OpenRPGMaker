import { describe, expect, it } from "vitest";
import { DB_TOOLS } from "@/editor/tools/dbTools";
import { MAP_TOOLS } from "@/editor/tools/mapTools";
import { DEFAULT_FARMLAND_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { createBlankProject, createFarmingDemoProject } from "@/project/defaults";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import {
  advanceGameDays,
  advanceGameTime,
  resolveTimeSystem,
  sleepGameTimeUntilMorning,
  type ResolvedTimeSystemConfig,
} from "@/project/gameTime";
import {
  cropReady,
  farmIgnoreMessage,
  farmIntentForHand,
  farmPlotAt,
  interactWithFarmPlot,
  advanceFarmPlotsForDay,
  syncFarmPlotsToDate,
  type FarmIgnoreReason,
} from "@/player/farming";
import { handSlotIndex } from "@/player/handSlot";
import { setEquippedTool } from "@/project/toolActions";
import { createInterpreter } from "@/player/interpreter";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { startSession, type PlaySession } from "@/project/session";
import type { GameMap, Project } from "@/project/types";
import { runSceneTest } from "@/testing/sceneTestRunner";

function demoRuntime() {
  const project = createFarmingDemoProject();
  const session = startSession(project, 1);
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("missing farming demo map");
  return { project, session, map };
}

function timeSystemOf(project: Project): ResolvedTimeSystemConfig {
  const system = resolveTimeSystem(project);
  if (!system) throw new Error("farming demo must enable timeSystem");
  return system;
}

function plantAndWater(project: Project, session: PlaySession, map: GameMap): void {
  interactWithFarmPlot(project, session, map, 4, 5);
  interactWithFarmPlot(project, session, map, 4, 5);
  interactWithFarmPlot(project, session, map, 4, 5);
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

  it("잠을 자지 않고 시계가 날짜를 넘겨도 하루치만 성장하고 watered가 리셋된다", () => {
    const { project, session, map } = demoRuntime();
    const system = timeSystemOf(project);
    plantAndWater(project, session, map);
    // dayStartHour 6 → dayEndHour 26: 하루는 1200분이다.
    const advanced = advanceGameTime(session.gameTime!, 1200, system);
    expect(advanced.dayEnds).toBe(1);
    session.gameTime = advanced.time;
    syncFarmPlotsToDate(project, session, system);
    expect(farmPlotAt(session, map.id, 4, 5)?.growthDays).toBe(1);
    expect(farmPlotAt(session, map.id, 4, 5)?.stage).toBe(1);
    expect(farmPlotAt(session, map.id, 4, 5)?.watered).toBe(false);
    expect(session.farmPlotsAdvancedThrough).toEqual({ day: 2, season: "spring", year: 1 });
  });

  it("여러 날을 한 번에 넘기면 그만큼 틱이 적용되고 재호출은 무동작이다", () => {
    const { project, session, map } = demoRuntime();
    const system = timeSystemOf(project);
    plantAndWater(project, session, map);
    session.gameTime = advanceGameDays(session.gameTime!, 3, system).time;
    syncFarmPlotsToDate(project, session, system);
    // 물을 준 날은 첫날뿐이므로 성장은 1일치, 커서는 3일 전진해야 한다.
    expect(farmPlotAt(session, map.id, 4, 5)?.growthDays).toBe(1);
    expect(session.farmPlotsAdvancedThrough).toEqual({ day: 4, season: "spring", year: 1 });
    const before = structuredClone(session.farmPlots);
    syncFarmPlotsToDate(project, session, system);
    expect(session.farmPlots).toEqual(before);
  });

  it("계절 경계를 넘기면 제철 외 작물이 죽는다", () => {
    const { project, session, map } = demoRuntime();
    const system = timeSystemOf(project);
    session.gameTime = { ...session.gameTime!, day: 28 };
    session.farmPlotsAdvancedThrough = { day: 28, season: "spring", year: 1 };
    plantAndWater(project, session, map);
    session.gameTime = advanceGameDays(session.gameTime, 1, system).time;
    expect(session.gameTime.season).toBe("summer");
    syncFarmPlotsToDate(project, session, system);
    expect(farmPlotAt(session, map.id, 4, 5)?.dead).toBe(true);
    expect(farmPlotAt(session, map.id, 4, 5)?.watered).toBe(false);
  });

  it("취침은 하루치만 성장시킨다(이중 계산 없음)", () => {
    const { project, session, map } = demoRuntime();
    const system = timeSystemOf(project);
    plantAndWater(project, session, map);
    session.gameTime = sleepGameTimeUntilMorning(session.gameTime!, system).time;
    syncFarmPlotsToDate(project, session, system);
    expect(farmPlotAt(session, map.id, 4, 5)?.growthDays).toBe(1);
    expect(farmPlotAt(session, map.id, 4, 5)?.stage).toBe(1);
  });

  it("advanceCropGrowth 는 커서를 옮기지 않아 다음 날 자연 성장을 삼키지 않는다", () => {
    const { project, session, map } = demoRuntime();
    const system = timeSystemOf(project);
    plantAndWater(project, session, map);
    // 달력과 무관한 보너스 성장 1일
    advanceFarmPlotsForDay(project, session, 1);
    expect(farmPlotAt(session, map.id, 4, 5)?.growthDays).toBe(1);
    // 다시 물을 주고 실제로 하루를 잔다 → 자연 성장 1일이 더 붙어야 한다
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("watered");
    session.gameTime = sleepGameTimeUntilMorning(session.gameTime!, system).time;
    syncFarmPlotsToDate(project, session, system);
    expect(farmPlotAt(session, map.id, 4, 5)?.growthDays).toBe(2);
  });

  it("세이브/로드가 성장 커서를 보존하고 경과일을 재적용하지 않는다", () => {
    const { project, session, map } = demoRuntime();
    const system = timeSystemOf(project);
    plantAndWater(project, session, map);
    session.gameTime = advanceGameDays(session.gameTime!, 2, system).time;
    syncFarmPlotsToDate(project, session, system);
    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
    expect(restored.farmPlotsAdvancedThrough).toEqual(session.farmPlotsAdvancedThrough);
    const before = structuredClone(restored.farmPlots);
    syncFarmPlotsToDate(project, restored, system);
    expect(restored.farmPlots).toEqual(before);
  });

  it("죽은 작물은 괭이질로 정리되고 다시 심을 수 있다", () => {
    const { project, session, map } = demoRuntime();
    plantAndWater(project, session, map);
    advanceFarmPlotsForDay(project, session, 1, "summer");
    expect(farmPlotAt(session, map.id, 4, 5)?.dead).toBe(true);
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("tilled");
    expect(farmPlotAt(session, map.id, 4, 5)).toEqual({ tilled: true, watered: false });
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("planted");
  });
});

describe("손 슬롯 의도 계약", () => {
  // Record<FarmIgnoreReason, ...> 이므로 사유를 추가하면 이 리터럴이 타입 에러로 깨진다.
  const IGNORE_REASON_SILENCE: Readonly<Record<FarmIgnoreReason, boolean>> = {
    "not-farmable": true,
    "missing-crop": false,
    "missing-hoe": false,
    "missing-seed": false,
    "missing-watering-can": false,
    "already-watered": false,
    "missing-axe": false,
    "missing-pickaxe": false,
    "missing-placeable": true,
    "plot-needs-clearing": false,
    "plot-needs-tilling": false,
    "wrong-tool-for-plot": false,
    "out-of-season": false,
    "nothing-to-harvest": false,
  };

  it("손이 비면 기존 캐스케이드가 그대로 동작한다", () => {
    const { project, session, map } = demoRuntime();
    expect(farmIntentForHand(project, session)).toBeUndefined();
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("tilled");
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("planted");
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("watered");
  });

  it("괭이를 들면 이미 경작된 살아있는 밭은 다시 갈지 않는다", () => {
    const { project, session, map } = demoRuntime();
    setEquippedTool(session, "item_hoe");
    expect(farmIntentForHand(project, session)).toBe("till");
    expect(interactWithFarmPlot(project, session, map, 4, 5, "till").kind).toBe("tilled");
    const again = interactWithFarmPlot(project, session, map, 4, 5, "till");
    expect(again.kind).toBe("ignored");
    expect(again.reason).toBe("wrong-tool-for-plot");
  });

  it("물뿌리개를 들고 갈지 않은 밭을 누르면 사유를 돌려준다", () => {
    const { project, session, map } = demoRuntime();
    setEquippedTool(session, "item_watering_can");
    expect(farmIntentForHand(project, session)).toBe("water");
    const result = interactWithFarmPlot(project, session, map, 4, 5, "water");
    expect(result.kind).toBe("ignored");
    expect(result.reason).toBe("wrong-tool-for-plot");
  });

  it("토마토 씨앗을 들면 crops 배열 앞의 감자가 아니라 토마토를 심는다", () => {
    const { project, session, map } = demoRuntime();
    // 버그 재현 근거: 감자가 crops 배열의 첫 봄 작물이다.
    expect(project.database.crops?.[0]?.id).toBe("crop_potato");
    setEquippedTool(session, "item_hoe");
    expect(interactWithFarmPlot(project, session, map, 4, 5, "till").kind).toBe("tilled");
    setEquippedTool(session, "item_tomato_seed");
    expect(farmIntentForHand(project, session)).toBe("plant");
    const planted = interactWithFarmPlot(project, session, map, 4, 5, "plant");
    expect(planted.kind).toBe("planted");
    expect(planted.cropId).toBe("crop_tomato");
    expect(session.inventory.item_tomato_seed).toBe(1);
    expect(session.inventory.item_potato_seed).toBe(3);
  });

  it("계절이 맞지 않는 씨앗은 심기지 않고 소모되지 않는다", () => {
    const { project, session, map } = demoRuntime();
    setEquippedTool(session, "item_hoe");
    interactWithFarmPlot(project, session, map, 4, 5, "till");
    session.gameTime = { ...session.gameTime!, season: "summer" };
    setEquippedTool(session, "item_tomato_seed");
    const result = interactWithFarmPlot(project, session, map, 4, 5, "plant");
    expect(result.kind).toBe("ignored");
    /**
     * 사유는 **계절**이어야 한다. 예전에는 `wrong-tool-for-plot` 을 돌려주어
     * "지금 든 도구로는 할 수 없습니다" 가 떴다 — 손에 든 씨앗도 갈아 둔 밭도 옳은데
     * 도구를 의심하게 만드는 거짓이었고, 계절이라는 진짜 이유는 화면에 없었다(브라우저 실측).
     */
    expect(result.reason, "계절 거절이 도구 사유로 위장돼 있다").toBe("out-of-season");
    expect(farmIgnoreMessage(result.reason)).toBe("이 씨앗은 지금 철이 아닙니다");
    expect(session.inventory.item_tomato_seed).toBe(2);
    expect(farmPlotAt(session, map.id, 4, 5)?.cropId).toBeUndefined();
  });

  it("마지막 씨앗을 심으면 손이 비고 의도도 같이 사라진다", () => {
    const { project, session, map } = demoRuntime();
    session.inventory.item_tomato_seed = 1;
    setEquippedTool(session, "item_hoe");
    interactWithFarmPlot(project, session, map, 4, 5, "till");
    setEquippedTool(session, "item_tomato_seed");
    expect(interactWithFarmPlot(project, session, map, 4, 5, farmIntentForHand(project, session)).kind).toBe("planted");

    // 씨앗을 다 썼다 — HUD 는 이미 「빈 손」이므로 의도도 비어야 한다.
    expect(session.inventory.item_tomato_seed ?? 0).toBe(0);
    expect(handSlotIndex(project, session)).toBe(0);
    expect(farmIntentForHand(project, session)).toBeUndefined();
    // 의도가 plant 로 남아 있었다면 방금 심은 밭은 물을 줄 수 없다.
    expect(interactWithFarmPlot(project, session, map, 4, 5, farmIntentForHand(project, session)).kind).toBe("watered");
  });

  it("다 자란 작물은 씨앗·괭이·물뿌리개 어느 것을 들어도 수확된다", () => {
    for (const hand of ["item_potato_seed", "item_hoe", "item_watering_can"]) {
      const { project, session, map } = demoRuntime();
      plantAndWater(project, session, map);
      advanceFarmPlotsForDay(project, session, 1, "spring");
      // 성장은 물을 준 다음 날에만 진행하므로 다시 물을 주고 하룰을 더 보낸다.
      interactWithFarmPlot(project, session, map, 4, 5);
      advanceFarmPlotsForDay(project, session, 1, "spring");
      expect(cropReady(project, farmPlotAt(session, map.id, 4, 5)), hand).toBe(true);

      setEquippedTool(session, hand);
      const result = interactWithFarmPlot(project, session, map, 4, 5, farmIntentForHand(project, session));

      expect(result.kind, hand).toBe("harvested");
      expect(session.inventory.item_potato, hand).toBe(1);
    }
  });

  it("고사 작물은 괭이로 정리되고, 씨앗을 들면 도구 탓을 하지 않는 사유를 돌려준다", () => {
    const { project, session, map } = demoRuntime();
    plantAndWater(project, session, map);
    advanceFarmPlotsForDay(project, session, 1, "summer");
    expect(farmPlotAt(session, map.id, 4, 5)?.dead).toBe(true);

    setEquippedTool(session, "item_potato_seed");
    const blocked = interactWithFarmPlot(project, session, map, 4, 5, "plant");
    // 괭이를 가지고 있으므로 "괭이가 필요합니다" 는 거짓이다.
    expect(blocked.reason).toBe("plot-needs-clearing");
    expect(farmIgnoreMessage(blocked.reason)).toContain("괭이로 정리");

    setEquippedTool(session, "item_hoe");
    expect(interactWithFarmPlot(project, session, map, 4, 5, "till").kind).toBe("tilled");
  });

  it("DB 에서 사라진 작물은 안내대로 괭이로 정리된다", () => {
    const { project, session, map } = demoRuntime();
    plantAndWater(project, session, map);
    project.database.crops = (project.database.crops ?? []).filter((crop) => crop.id !== "crop_potato");

    const probe = interactWithFarmPlot(project, session, map, 4, 5, "plant");
    expect(probe.reason).toBe("missing-crop");
    expect(farmIgnoreMessage(probe.reason)).toContain("괭이로 정리");

    // 안내가 실제로 통해야 한다 — 괭이질로 밭이 초기화되고 다시 쓸 수 있다.
    expect(interactWithFarmPlot(project, session, map, 4, 5, "till").kind).toBe("tilled");
    expect(farmPlotAt(session, map.id, 4, 5)).toEqual({ tilled: true, watered: false });
    // 손을 비운 캐스케이드도 막히지 않는다.
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("planted");
  });

  it("갈지 않은 밭에 씨앗을 쓰면 도구가 아니라 경작이 필요하다고 안내한다", () => {
    const { project, session, map } = demoRuntime();
    setEquippedTool(session, "item_potato_seed");

    const result = interactWithFarmPlot(project, session, map, 4, 5, "plant");

    expect(result.reason).toBe("plot-needs-tilling");
    expect(session.inventory.item_hoe).toBeGreaterThan(0);
  });

  it("열린 세계 사유는 침묵하고 나머지 사유는 한국어 문구를 가진다", () => {
    expect(farmIgnoreMessage(undefined)).toBeNull();
    expect(farmIgnoreMessage("unknown-reason")).toBeNull();
    for (const [reason, silent] of Object.entries(IGNORE_REASON_SILENCE)) {
      const message = farmIgnoreMessage(reason);
      if (silent) {
        expect(message, reason).toBeNull();
        continue;
      }
      expect(message, reason).toBeTruthy();
      expect(message!.trim().length, reason).toBeGreaterThan(0);
    }
  });
});

/**
 * 데모의 밭은 **괭이를 대기 전에도 화면에서 밭으로 보여야** 한다. `farmableArea` 는 저작
 * 데이터일 뿐 그려지지 않으므로, 바닥 타일이 주변과 같으면 플레이어는 어디를 갈 수 있는지
 * 알 수 없다(브라우저 실측: 데모 밭이 주변과 똑같은 풀밭이었다).
 */
describe("농사 데모의 밭 지형", () => {
  const farmMap = () => {
    const project = createFarmingDemoProject();
    const map = project.maps["map_farming_demo"];
    if (!map) throw new Error("농사 데모 맵을 찾지 못했다");
    return map;
  };
  const tileAt = (map: ReturnType<typeof farmMap>, x: number, y: number): number | undefined =>
    map.lowerTiles[y * map.width + x];

  it("paints the farmable rect with ground that differs from the surrounding terrain", () => {
    const map = farmMap();
    const rect = map.farmableArea?.[0];
    expect(rect, "밭 영역이 저작되지 않았다").toBeDefined();
    if (!rect) return;

    const outside = tileAt(map, rect.x, rect.y - 1);
    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        expect(tileAt(map, x, y), `밭 (${x},${y}) 이 주변 지형과 같은 타일이다`).not.toBe(outside);
      }
    }
  });

  it("does not use the tilled-soil autotile as the untilled ground", () => {
    // 갈린 흙 오버레이가 builtin_farmland 를 그린다 — 바닥에 같은 그룹을 깔면
    // 갈기 전과 후가 같은 그림이 되어 경작 여부를 구별할 수 없다.
    const map = farmMap();
    const rect = map.farmableArea?.[0];
    if (!rect) return;
    const farmland = new Set(DEFAULT_FARMLAND_AUTOTILE_GROUP.memberTileIds);
    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        const tile = tileAt(map, x, y);
        expect(farmland.has(tile ?? -1), `밭 (${x},${y}) 이 경작지 타일로 미리 깔려 있다`).toBe(false);
      }
    }
  });
});
