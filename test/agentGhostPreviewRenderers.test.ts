import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeGhostAnimationState,
  ghostPhaseChipInfo,
  preferredGhostToolName,
  AgentGhostPreviewRenderer,
} from "@/editor/agentPreviewRenderers";
import {
  buildGhostRevealSchedule,
  GHOST_WIPE_DURATION_MS,
  GHOST_WIPE_HOLD_MS,
  type AgentGhostCell,
  appendAgentGhostPreviewForToolCall,
  clearAgentGhostPreview,
  replaceAgentGhostPreviewFromProjectDiff,
} from "@/editor/agentGhostPreview";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";

describe("computeGhostAnimationState pure function", () => {
  it("와이프 선단이 지난 셀만 드러나고, 선단 앞 셀은 pending 으로 남는다", () => {
    const cells: AgentGhostCell[] = [
      { x: 0, y: 0, layer: "lower", tileId: 10, tilesetId: "ts1" },
      { x: 1, y: 0, layer: "lower", tileId: 11, tilesetId: "ts1" },
    ];
    const schedule = buildGhostRevealSchedule(cells);
    const before = computeGhostAnimationState(schedule, -10);
    expect(before.cellStates.map((cell) => cell.phase)).toEqual(["pending", "pending"]);
    expect(before.revealedCount).toBe(0);
    expect(before.isScheduleComplete).toBe(false);
    const atStart = computeGhostAnimationState(schedule, 0);
    expect(atStart.cellStates.map((cell) => cell.phase)).toEqual(["revealed", "pending"]);
    expect(atStart.revealedCount).toBe(1);
    const midWipe = computeGhostAnimationState(schedule, GHOST_WIPE_DURATION_MS - 1);
    expect(midWipe.cellStates.map((cell) => cell.phase)).toEqual(["revealed", "pending"]);
    const atEnd = computeGhostAnimationState(schedule, GHOST_WIPE_DURATION_MS);
    expect(atEnd.cellStates.map((cell) => cell.phase)).toEqual(["revealed", "revealed"]);
    expect(atEnd.revealedCount).toBe(2);
    // 마지막 열이 드러난 직후에는 아직 완료가 아니다 — 짧은 유지 시간 뒤에 완료로 넘어간다.
    expect(atEnd.isScheduleComplete).toBe(false);
    const settled = computeGhostAnimationState(schedule, GHOST_WIPE_DURATION_MS + GHOST_WIPE_HOLD_MS);
    expect(settled.isScheduleComplete).toBe(true);
    expect(settled.revealedCount).toBe(2);
  });

  it("빈 스케줄은 즉시 완료 상태다", () => {
    const empty = computeGhostAnimationState([], 0);
    expect(empty.cellStates).toEqual([]);
    expect(empty.revealedCount).toBe(0);
    expect(empty.isScheduleComplete).toBe(true);
  });

  it("한 열뿐인 변경도 유지 시간 뒤 완료로 수렴한다", () => {
    const schedule = buildGhostRevealSchedule([{ x: 3, y: 3, layer: "lower", tileId: 7 }]);
    expect(computeGhostAnimationState(schedule, 0).isScheduleComplete).toBe(false);
    expect(computeGhostAnimationState(schedule, GHOST_WIPE_HOLD_MS).isScheduleComplete).toBe(true);
  });
});


describe("ghostPhaseChipInfo helper", () => {
  it("translates toolNames into Korean labels and tracks progress vs completion", () => {
    // animating with build/author/paint/fill/create/scatter tool
    const buildInfo = ghostPhaseChipInfo({
      toolName: "build_house",
      revealedCount: 3,
      totalCount: 10,
      isScheduleComplete: false,
    });
    expect(buildInfo.koreanLabel).toBe("시공 중");
    expect(buildInfo.spinner).toBe(true);
    expect(buildInfo.text).toBe("시공 중 · 3/10 셀 · build_house");

    // place_npc / make_villager
    const npcInfo = ghostPhaseChipInfo({
      toolName: "place_npc",
      revealedCount: 1,
      totalCount: 1,
      isScheduleComplete: false,
    });
    expect(npcInfo.koreanLabel).toBe("주민 배치 중");
    expect(npcInfo.text).toBe("주민 배치 중 · 1/1 셀 · place_npc");

    // upsert_event
    const eventInfo = ghostPhaseChipInfo({
      toolName: "upsert_event",
      revealedCount: 1,
      totalCount: 2,
      isScheduleComplete: false,
    });
    expect(eventInfo.koreanLabel).toBe("이벤트 연결 중");

    // generic tool
    const otherInfo = ghostPhaseChipInfo({
      toolName: "erase_tiles",
      revealedCount: 0,
      totalCount: 5,
      isScheduleComplete: false,
    });
    expect(otherInfo.koreanLabel).toBe("작업 중");

    // completed
    const doneInfo = ghostPhaseChipInfo({
      toolName: "paint_tiles",
      revealedCount: 10,
      totalCount: 10,
      isScheduleComplete: true,
    });
    expect(doneInfo.spinner).toBe(false);
    expect(doneInfo.text).toBe("초안 완성");
  });
});

/** Phaser 씬 이벤트 최소 대역 — 프레임 티커(update)와 shutdown/destroy 만 다룬다. */
function makeEmitter() {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  return {
    handlers,
    on(name: string, fn: (...args: unknown[]) => void) {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name)!.add(fn);
      return this;
    },
    once(name: string, fn: (...args: unknown[]) => void) {
      return this.on(name, fn);
    },
    off(name: string, fn: (...args: unknown[]) => void) {
      handlers.get(name)?.delete(fn);
      return this;
    },
    emit(name: string) {
      for (const fn of [...(handlers.get(name) ?? [])]) fn();
      return true;
    },
    count(name: string) {
      return handlers.get(name)?.size ?? 0;
    },
  };
}

describe("preferredGhostToolName", () => {
  it("diff 가짜 도구명보다 tool_started 로 들어온 실제 도구명을 쓴다", () => {
    expect(preferredGhostToolName("live_project_diff", "fill_region")).toBe("fill_region");
    expect(preferredGhostToolName("fill_region", "paint_tiles")).toBe("fill_region");
    expect(preferredGhostToolName("live_project_diff", "")).toBe("live_project_diff");
    expect(preferredGhostToolName("", "upsert_event")).toBe("upsert_event");
  });
});

describe("AgentGhostPreviewRenderer with mock phaser and DOM", () => {
  let restoreDom: (() => void) | null = null;
  let hostEl: any;
  let mockScene: any;
  let mockLayer: any;
  let containerFactory: (() => any) | null = null;

  beforeEach(() => {
    restoreDom = installFakeDom();
    clearAgentGhostPreview();
    hostEl = document.createElement("div");
    const canvas = document.createElement("canvas");
    hostEl.append(canvas);
    document.body.append(hostEl);

    const makeContainer = () => {
      const c: any = {
        setName: vi.fn(),
        add: vi.fn((...kids: any[]) => { kids.forEach(k => { c.list.push(k); k.parentContainer = c; }); }),
        removeAll: vi.fn(() => { c.list.length = 0; }),
        destroy: vi.fn(() => { c.destroyed = true; }),
        list: [],
        parentContainer: null,
      };
      return c;
    };
    containerFactory = makeContainer;
    mockLayer = {
      // Phaser 규약 재현: removeAll(true) 는 자식을 파괴하고 parentContainer 를 끊는다.
      removeAll: vi.fn(() => { mockLayer.list.length = 0; }),
      add: vi.fn((child: any) => {
        child.parentContainer = mockLayer;
        mockLayer.list.push(child);
      }),
      list: [],
    };

    mockScene = {
      add: {
        container: vi.fn(() => containerFactory()),
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
          setVisible: vi.fn(),
          destroy: vi.fn(),
        })),
        rectangle: vi.fn(() => ({
          setOrigin: vi.fn(),
          setStrokeStyle: vi.fn(),
          setVisible: vi.fn(),
          setScale: vi.fn(),
          setPosition: vi.fn(),
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
      events: makeEmitter(),
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

  it("(b2) 같은 셀이 프리뷰 두 장에 겹쳐 들어와도 사라진 셀의 공개 시각은 버린다", () => {
    // 청소 조건의 비교 대상은 프리뷰 셀의 **개수**가 아니라 서로 다른 키의 수여야 한다.
    // appendAgentGhostPreviewForToolCall 경로는 같은 맵에 프리뷰를 여러 장 얹으므로(id 가
    // 도구명·인자까지 포함해 달라진다) 같은 좌표가 중복 계수되고, 개수로 비교하면 청소가
    // 건너뛰어져 되돌아온 셀이 **이미 지나간 시각**을 물려받아 와이프 없이 튀어나온다.
    let now = 1000;
    const renderer = new AgentGhostPreviewRenderer(mockScene, mockLayer, () => "m1", { clock: () => now });

    const base = createBlankProject();
    base.maps["m1"] = createBlankMap("m1", 10, 10);
    const draft = structuredClone(base);
    draft.maps["m1"].lowerTiles[0] = 5; // (0,0) — 첫 열
    draft.maps["m1"].lowerTiles[9] = 6; // (9,0) — 마지막 열
    store.replace(base);

    replaceAgentGhostPreviewFromProjectDiff(base, draft);
    renderer.render();
    const firstAtX0 = renderer.getCurrentSchedule().find((step) => step.cell.x === 0)?.startMs;
    const firstAtX9 = renderer.getCurrentSchedule().find((step) => step.cell.x === 9)?.startMs;
    expect(firstAtX0).toBe(0);
    expect(firstAtX9).toBe(GHOST_WIPE_DURATION_MS);

    // 프리뷰가 (0,0) 한 칸으로 줄어드는데, 그 한 칸이 서로 다른 프리뷰 두 장에 들어 있다.
    clearAgentGhostPreview();
    appendAgentGhostPreviewForToolCall(base, "clear_region", { mapId: "m1", x: 0, y: 0, w: 1, h: 1 });
    appendAgentGhostPreviewForToolCall(base, "mirror_region", { mapId: "m1", x: 0, y: 0, w: 1, h: 1 });
    now += 5000;
    renderer.render();

    // (9,0) 이 다시 들어온다 — 사라졌던 셀이므로 지금 시각부터 새 와이프를 받아야 한다.
    replaceAgentGhostPreviewFromProjectDiff(base, draft);
    renderer.render();
    const again = renderer.getCurrentSchedule();
    expect(again.find((step) => step.cell.x === 0)?.startMs).toBe(firstAtX0);
    expect(again.find((step) => step.cell.x === 9)?.startMs).toBe(5000);
  });

  it("(d) 씬 update 이벤트가 공개 애니메이션을 진행시키고 완료 후 스스로 떨어진다", () => {
    let now = 1000;
    const renderer = new AgentGhostPreviewRenderer(mockScene, mockLayer, () => "m1", { clock: () => now });

    const base = createBlankProject();
    const draft = createBlankProject();
    base.maps["m1"] = createBlankMap("m1", 10, 10);
    draft.maps["m1"] = createBlankMap("m1", 10, 10);
    draft.maps["m1"].lowerTiles[0] = 5;
    draft.maps["m1"].lowerTiles[1] = 6;
    store.replace(base);

    replaceAgentGhostPreviewFromProjectDiff(base, draft);
    renderer.render();

    // 렌더 직후 티커가 붙는다 — render() 를 다시 부르지 않아도 프레임마다 진행한다.
    expect(mockScene.events.count("update")).toBe(1);
    const chip = hostEl.querySelector("[data-testid='ai-ghost-phase-chip']");
    expect(chip?.textContent).toContain("중");

    now += 3000;
    mockScene.events.emit("update");
    expect(chip?.textContent).toContain("초안 완성");

    // 스케줄 + 샤인이 끝나면 유휴 상태로 돌아간다(프레임 작업 0).
    expect(mockScene.events.count("update")).toBe(0);
  });

  it("(e) 같은 셀 집합으로 다시 렌더해도 진행 상태가 처음으로 되돌아가지 않는다", () => {
    let now = 1000;
    const renderer = new AgentGhostPreviewRenderer(mockScene, mockLayer, () => "m1", { clock: () => now });

    const base = createBlankProject();
    const draft = createBlankProject();
    base.maps["m1"] = createBlankMap("m1", 10, 10);
    draft.maps["m1"] = createBlankMap("m1", 10, 10);
    draft.maps["m1"].lowerTiles[0] = 5;
    store.replace(base);

    replaceAgentGhostPreviewFromProjectDiff(base, draft);
    renderer.render();
    const chip = hostEl.querySelector("[data-testid='ai-ghost-phase-chip']");

    now += 3000;
    renderer.update();
    expect(chip?.textContent).toContain("초안 완성");

    // 스토어 emit·카메라 변경 등으로 다시 렌더돼도 완료 상태를 유지한다.
    renderer.render();
    expect(hostEl.querySelector("[data-testid='ai-ghost-phase-chip']")?.textContent).toContain("초안 완성");
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

  it("라운드3 회귀: 두 번째 render() 후에도 타일 레이어가 새 animGroup에 재부모된다", () => {
    let now = 1000;
    const renderer = new AgentGhostPreviewRenderer(mockScene, mockLayer, () => "m1", { clock: () => now });
    const base = createBlankProject();
    const draft = createBlankProject();
    base.maps["m1"] = createBlankMap("m1", 10, 10);
    draft.maps["m1"] = createBlankMap("m1", 10, 10);
    draft.maps["m1"].lowerTiles[0] = 5;
    store.replace(base);
    replaceAgentGhostPreviewFromProjectDiff(base, draft);
    renderer.render();
    const firstGroup = renderer["animGroup"];
    now += 50;
    renderer.update();
    expect((renderer["tileObjects"] as unknown[]).length).toBeGreaterThan(0);
    now += 3000;
    renderer.render();
    const secondGroup = renderer["animGroup"];
    expect(secondGroup).not.toBe(firstGroup);
    // 파괴된 컨테이너 재사용이 아니라 새 그룹에 실제 재부모됐음을 판별한다:
    // tileLayer 가 secondGroup 의 자식이고 셀 오브젝트를 실제로 담고 있어야 한다.
    const tileLayer = renderer["tileLayer"] as any;
    expect(tileLayer).not.toBeNull();
    expect(tileLayer.parentContainer).toBe(secondGroup);
    expect(secondGroup.list).toContain(tileLayer);
    expect(tileLayer.list?.length ?? 0).toBeGreaterThan(0);
    expect(renderer["tileLayerParent"]).toBe(secondGroup);
  });
});
