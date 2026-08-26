import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeGhostAnimationState,
  ghostPhaseChipInfo,
  type GhostCellAnimState,
  AgentGhostPreviewRenderer,
} from "@/editor/agentPreviewRenderers";
import {
  buildGhostRevealSchedule,
  type AgentGhostCell,
  clearAgentGhostPreview,
  replaceAgentGhostPreviewFromProjectDiff,
} from "@/editor/agentGhostPreview";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";

describe("computeGhostAnimationState pure function", () => {
  it("determines cell phases (pending -> stamping -> settling -> done) and shine sweep deterministically", () => {
    const cells: AgentGhostCell[] = [
      { x: 0, y: 0, layer: "lower", tileId: 10, tilesetId: "ts1" },
      { x: 1, y: 0, layer: "lower", tileId: 11, tilesetId: "ts1" },
    ];
    const schedule = buildGhostRevealSchedule(cells, { tileStepMs: 50 });

    // At t = -10ms (before anything starts)
    const stateBefore = computeGhostAnimationState(schedule, -10);
    expect(stateBefore.cellStates[0].phase).toBe("pending");
    expect(stateBefore.cellStates[1].phase).toBe("pending");
    expect(stateBefore.cursorCell).toBeNull();
    expect(stateBefore.isScheduleComplete).toBe(false);
    expect(stateBefore.stampedCount).toBe(0);

    // At t = 0ms (first cell just starts stamping: 0 <= elapsed < 180ms)
    const state0 = computeGhostAnimationState(schedule, 0);
    expect(state0.cellStates[0].phase).toBe("stamping");
    expect(state0.cellStates[0].scale).toBeCloseTo(1.5, 2);
    expect(state0.cellStates[1].phase).toBe("pending");
    expect(state0.cursorCell).toEqual(cells[0]);
    expect(state0.stampedCount).toBe(1);

    // At t = 90ms (first cell midway through stamping: elapsed 90ms/180ms -> scale 1.25; second cell stamping: elapsed 40ms/180ms)
    const state90 = computeGhostAnimationState(schedule, 90);
    expect(state90.cellStates[0].phase).toBe("stamping");
    expect(state90.cellStates[0].scale).toBeCloseTo(1.25, 2);
    expect(state90.cellStates[1].phase).toBe("stamping");
    expect(state90.cursorCell).toEqual(cells[1]);
    expect(state90.stampedCount).toBe(2);

    // At t = 200ms (first cell elapsed 200ms -> settling: 180ms..800ms; second cell elapsed 150ms -> stamping)
    const state200 = computeGhostAnimationState(schedule, 200);
    expect(state200.cellStates[0].phase).toBe("settling");
    expect(state200.cellStates[0].scale).toBe(1.0);
    expect(state200.cellStates[0].ringAlpha).toBeGreaterThan(0);
    expect(state200.cellStates[0].afterglowAlpha).toBeGreaterThan(0);
    expect(state200.cellStates[1].phase).toBe("stamping");

    // At t = 900ms (first cell elapsed 900ms > 800ms -> done; second cell elapsed 850ms > 800ms -> done)
    const state900 = computeGhostAnimationState(schedule, 900);
    expect(state900.cellStates[0].phase).toBe("done");
    expect(state900.cellStates[1].phase).toBe("done");
    expect(state900.cellStates[0].ringAlpha).toBe(0);
    expect(state900.cellStates[0].afterglowAlpha).toBe(0);
    expect(state900.isScheduleComplete).toBe(true);
    expect(state900.stampedCount).toBe(2);
  });

  it("diagonal shine sweep activates for 450ms after the full reveal schedule completes", () => {
    const cells: AgentGhostCell[] = [
      { x: 0, y: 0, layer: "lower", tileId: 10 },
    ];
    const schedule = buildGhostRevealSchedule(cells);
    // last cell start = 0ms + LAST_CELL_DISPLAY_MS(300) hold, then shine 300→750ms.
    const state500 = computeGhostAnimationState(schedule, 500);
    expect(state500.shineProgress).toBeGreaterThan(0);
    expect(state500.shineProgress).toBeLessThan(1);

    const state900 = computeGhostAnimationState(schedule, 900);
    expect(state900.shineProgress).toBe(1); // completed
  });
});

describe("ghostPhaseChipInfo helper", () => {
  it("translates toolNames into Korean labels and tracks progress vs completion", () => {
    // animating with build/author/paint/fill/create/scatter tool
    const buildInfo = ghostPhaseChipInfo({
      toolName: "build_house",
      stampedCount: 3,
      totalCount: 10,
      isScheduleComplete: false,
    });
    expect(buildInfo.koreanLabel).toBe("시공 중");
    expect(buildInfo.spinner).toBe(true);
    expect(buildInfo.text).toBe("시공 중 · 3/10 셀 · build_house");

    // place_npc / make_villager
    const npcInfo = ghostPhaseChipInfo({
      toolName: "place_npc",
      stampedCount: 1,
      totalCount: 1,
      isScheduleComplete: false,
    });
    expect(npcInfo.koreanLabel).toBe("주민 배치 중");
    expect(npcInfo.text).toBe("주민 배치 중 · 1/1 셀 · place_npc");

    // upsert_event
    const eventInfo = ghostPhaseChipInfo({
      toolName: "upsert_event",
      stampedCount: 1,
      totalCount: 2,
      isScheduleComplete: false,
    });
    expect(eventInfo.koreanLabel).toBe("이벤트 연결 중");

    // generic tool
    const otherInfo = ghostPhaseChipInfo({
      toolName: "erase_tiles",
      stampedCount: 0,
      totalCount: 5,
      isScheduleComplete: false,
    });
    expect(otherInfo.koreanLabel).toBe("작업 중");

    // completed
    const doneInfo = ghostPhaseChipInfo({
      toolName: "paint_tiles",
      stampedCount: 10,
      totalCount: 10,
      isScheduleComplete: true,
    });
    expect(doneInfo.spinner).toBe(false);
    expect(doneInfo.text).toBe("초안 완성 · 검토 대기");
  });
});

describe("AgentGhostPreviewRenderer with mock phaser and DOM", () => {
  let restoreDom: (() => void) | null = null;
  let hostEl: any;
  let mockScene: any;
  let mockLayer: any;

  beforeEach(() => {
    restoreDom = installFakeDom();
    clearAgentGhostPreview();
    hostEl = document.createElement("div");
    const canvas = document.createElement("canvas");
    hostEl.append(canvas);
    document.body.append(hostEl);

    mockLayer = {
      removeAll: vi.fn(),
      add: vi.fn(),
      list: [],
    };

    mockScene = {
      add: {
        container: vi.fn(() => ({
          setName: vi.fn(),
          add: vi.fn(),
          removeAll: vi.fn(),
          destroy: vi.fn(),
          list: [],
        })),
        graphics: vi.fn(() => ({
          fillStyle: vi.fn(),
          fillRect: vi.fn(),
          lineStyle: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          strokePath: vi.fn(),
          strokeRect: vi.fn(),
          clear: vi.fn(),
          destroy: vi.fn(),
        })),
        image: vi.fn(() => ({
          setOrigin: vi.fn(),
          setAlpha: vi.fn(),
          setScale: vi.fn(),
          setCrop: vi.fn(),
          destroy: vi.fn(),
        })),
        rectangle: vi.fn(() => ({
          setOrigin: vi.fn(),
          setStrokeStyle: vi.fn(),
          destroy: vi.fn(),
        })),
      },
      cameras: {
        main: {
          scrollX: 0,
          scrollY: 0,
          zoom: 1,
        },
      },
      textures: {
        exists: vi.fn(() => true),
        get: vi.fn(() => ({
          getSourceImage: vi.fn(),
        })),
        addCanvas: vi.fn(),
      },
      game: {
        canvas,
      },
      tweens: {
        add: vi.fn(),
      },
    };
  });

  afterEach(() => {
    hostEl?.remove();
    clearAgentGhostPreview();
    restoreDom?.();
    restoreDom = null;
  });

  it("(a) chip appears with Korean label containing '중' then transitions to text containing '초안 완성'", () => {
    let now = 1000;
    const renderer = new AgentGhostPreviewRenderer(
      mockScene,
      mockLayer,
      () => "m1",
      { clock: () => now }
    );

    // Setup preview in store diff
    const base = createBlankProject();
    const draft = createBlankProject();
    base.maps["m1"] = createBlankMap("m1", 10, 10);
    draft.maps["m1"] = createBlankMap("m1", 10, 10);
    draft.maps["m1"].lowerTiles[0] = 5; // changed 1 cell
    store.replace(base);

    replaceAgentGhostPreviewFromProjectDiff(base, draft);
    renderer.render();

    const chip = hostEl.querySelector("[data-testid='ai-ghost-phase-chip']");
    expect(chip).not.toBeNull();
    expect(chip?.textContent).toContain("중");

    // Advance clock past completion
    now += 3000;
    renderer.update();
    expect(chip?.textContent).toContain("초안 완성");
    expect(chip?.querySelector(".ai-ghost-phase-spinner")).toBeNull();

    // Clear previews -> chip removed
    clearAgentGhostPreview();
    renderer.render();
    expect(hostEl.querySelector("[data-testid='ai-ghost-phase-chip']")).toBeNull();
  });

  it("(b) reveal schedule order honored", () => {
    let now = 1000;
    const renderer = new AgentGhostPreviewRenderer(
      mockScene,
      mockLayer,
      () => "m1",
      { clock: () => now }
    );

    const base = createBlankProject();
    const draft = createBlankProject();
    base.maps["m1"] = createBlankMap("m1", 10, 10);
    draft.maps["m1"] = createBlankMap("m1", 10, 10);
    draft.maps["m1"].lowerTiles[0] = 5;
    draft.maps["m1"].lowerTiles[1] = 6;
    store.replace(base);

    replaceAgentGhostPreviewFromProjectDiff(base, draft);
    renderer.render();

    const schedule = renderer.getCurrentSchedule();
    expect(schedule).toHaveLength(2);
    expect(schedule[0].cell.x).toBe(0);
    expect(schedule[1].cell.x).toBe(1);
    expect(schedule[0].startMs).toBeLessThan(schedule[1].startMs);
  });

  it("(c) >256-cell preview renders bbox-only (no per-cell sprites) and chip still counts", () => {
    let now = 1000;
    const renderer = new AgentGhostPreviewRenderer(
      mockScene,
      mockLayer,
      () => "m1",
      { clock: () => now }
    );

    const base = createBlankProject();
    const draft = createBlankProject();
    base.maps["m1"] = createBlankMap("m1", 20, 20);
    draft.maps["m1"] = createBlankMap("m1", 20, 20);
    for (let i = 0; i < 300; i++) {
      draft.maps["m1"].lowerTiles[i] = (draft.maps["m1"].lowerTiles[i] ?? 0) + 1;
    }
    store.replace(base);

    replaceAgentGhostPreviewFromProjectDiff(base, draft);
    renderer.render();

    // No image added for cells (>256 fallback)
    expect(mockScene.add.image).not.toHaveBeenCalled();

    const chip = hostEl.querySelector("[data-testid='ai-ghost-phase-chip']");
    expect(chip).not.toBeNull();
    expect(chip?.textContent).toContain("300 셀");
  });
});
