import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentGhostPreviewRenderer, computeGhostAnimationState, ghostPhaseChipInfo, preferredGhostToolName } from "@/editor/agentPreviewRenderers";
import { clearAgentGhostPreview, GHOST_WIPE_DURATION_MS, replaceAgentGhostPreviewFromProjectDiff, getAgentGhostPreviewState, isAgentGhostPreviewHidden, setAgentGhostPreviewHidden, subscribeAgentGhostPreview, buildGhostRevealSchedule, GHOST_WIPE_HOLD_MS, type AgentGhostCell, appendAgentGhostPreviewForToolCall, clearAgentGhostRunningTool, setAgentGhostRunningTool, type AgentGhostPreviewState } from "@/editor/agentGhostPreview";
import { createBlankMap } from "@/project/defaults";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";
import type { Project } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

// 라이브 프리뷰는 150ms 스로틀로 셀이 계속 늘어난다. 예전 렌더러는 셀 집합 지문이 바뀌면
// startTime 을 되감았으므로 툴 12개짜리 턴이 "왼쪽부터 쏵"을 12번 반복했다 — 쌓여가는 것이
// 아니라 깜빡임으로 읽혔다. 이 스펙은 이미 드러난 셀의 공개 시각이 보존되는지를 못 박는다.
describe("agentGhostCumulativeReveal", () => {
  isolateTimers();
  let restoreDom: (() => void) | null = null;
  let hostEl: HTMLElement;
  let mockScene: any;
  let mockLayer: any;
  let now = 1000;
  function containerFactory(): any {
    const children: any[] = [];
    return {
      add: vi.fn((child: any) => {
        children.push(child);
        child.parentContainer = children;
        return child;
      }),
      removeAll: vi.fn(() => {
        children.length = 0;
      }),
      setName: vi.fn(),
      setAlpha: vi.fn(),
      setDepth: vi.fn(),
      setVisible: vi.fn(),
      setPosition: vi.fn(),
      destroy: vi.fn(),
      parentContainer: null,
      list: children,
    };
  }
  function makeEmitter(): any {
    const handlers = new Map<string, Set<() => void>>();
    return {
      on: vi.fn((name: string, handler: () => void) => {
        const set = handlers.get(name) ?? new Set();
        set.add(handler);
        handlers.set(name, set);
      }),
      off: vi.fn((name: string, handler: () => void) => handlers.get(name)?.delete(handler)),
      once: vi.fn(),
      emit: (name: string) => {
        for (const handler of [...(handlers.get(name) ?? [])]) handler();
      },
    };
  }
  beforeEach(() => {
    now = 1000;
    restoreDom = installFakeDom();
    hostEl = document.createElement("div");
    document.body.append(hostEl);
    mockLayer = containerFactory();
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
      cameras: { main: { scrollX: 0, scrollY: 0, zoom: 1, worldView: { x: 0, y: 0 } } },
      textures: { exists: vi.fn(() => true), get: vi.fn(() => ({ getSourceImage: vi.fn() })), addCanvas: vi.fn() },
      game: { canvas: { parentElement: hostEl, getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, width: 640, height: 480 }) } },
      tweens: { add: vi.fn() },
      events: makeEmitter(),
    };
  });
  afterEach(() => {
    hostEl?.remove();
    clearAgentGhostPreview();
    restoreDom?.();
    restoreDom = null;
  });
  function blankPair(): { base: Project; draft: Project } {
    const base = createBlankProject();
    const draft = createBlankProject();
    base.maps["m1"] = createBlankMap("m1", 20, 20);
    draft.maps["m1"] = createBlankMap("m1", 20, 20);
    store.replace(base);
    return { base, draft };
  }
  function startMsByCell(renderer: AgentGhostPreviewRenderer): Map<string, number> {
    const out = new Map<string, number>();
    for (const step of renderer.getCurrentSchedule()) out.set(`${step.cell.x},${step.cell.y}`, step.startMs);
    return out;
  }
  describe("AgentGhostPreviewRenderer 누적 공개", () => {
    it("셀이 추가돼도 이미 예약된 셀의 공개 시각은 그대로다", () => {
      const renderer = new AgentGhostPreviewRenderer(mockScene, mockLayer, () => "m1", { clock: () => now });
      const { base, draft } = blankPair();

      draft.maps["m1"].lowerTiles[0] = 5; // (0,0)
      draft.maps["m1"].lowerTiles[2] = 6; // (2,0)
      replaceAgentGhostPreviewFromProjectDiff(base, draft);
      renderer.render();
      const first = startMsByCell(renderer);
      expect([...first.values()]).toEqual([0, GHOST_WIPE_DURATION_MS]);

      // 다음 스로틀 틱: 셀 2개가 더 붙는다.
      now += 200;
      draft.maps["m1"].lowerTiles[4] = 7; // (4,0)
      draft.maps["m1"].lowerTiles[6] = 8; // (6,0)
      replaceAgentGhostPreviewFromProjectDiff(base, draft);
      renderer.render();

      const second = startMsByCell(renderer);
      expect(second.get("0,0")).toBe(first.get("0,0"));
      expect(second.get("2,0")).toBe(first.get("2,0"));
      // 새 셀은 지금(경과 200ms) 이후에 드러난다 — 처음으로 되감기지 않는다.
      expect(second.get("4,0")).toBeGreaterThanOrEqual(200);
      expect(second.get("6,0")).toBeGreaterThan(second.get("4,0")!);
    });

    it("스케줄은 공개 시각 오름차순이다 — bbox 경로의 이분 탐색 전제", () => {
      const renderer = new AgentGhostPreviewRenderer(mockScene, mockLayer, () => "m1", { clock: () => now });
      const { base, draft } = blankPair();

      // 먼저 오른쪽을 칠하고, 그 뒤에 왼쪽을 칠한다(모델이 실제로 이렇게 한다).
      draft.maps["m1"].lowerTiles[10] = 5; // (10,0)
      replaceAgentGhostPreviewFromProjectDiff(base, draft);
      renderer.render();

      now += 500;
      draft.maps["m1"].lowerTiles[1] = 6; // (1,0)
      replaceAgentGhostPreviewFromProjectDiff(base, draft);
      renderer.render();

      const schedule = renderer.getCurrentSchedule();
      expect(schedule).toHaveLength(2);
      expect(schedule.map((step) => step.startMs)).toEqual([...schedule.map((step) => step.startMs)].sort((a, b) => a - b));
      // 나중에 붙은 왼쪽 셀이 나중에 드러난다 — 공간 순서가 아니라 도착 순서다.
      expect(schedule[0].cell.x).toBe(10);
      expect(schedule[1].cell.x).toBe(1);
    });

    it("같은 셀 집합으로 다시 렌더해도 공개 시각이 되감기지 않는다", () => {
      const renderer = new AgentGhostPreviewRenderer(mockScene, mockLayer, () => "m1", { clock: () => now });
      const { base, draft } = blankPair();
      draft.maps["m1"].lowerTiles[0] = 5;
      draft.maps["m1"].lowerTiles[3] = 6;
      replaceAgentGhostPreviewFromProjectDiff(base, draft);
      renderer.render();
      const first = startMsByCell(renderer);

      now += 1000;
      renderer.render(); // 스토어 emit / 카메라 변경으로 다시 그려지는 경우
      expect(startMsByCell(renderer)).toEqual(first);
    });

    it("프리뷰가 비면 시각 기록도 버려 다음 턴이 처음부터 시작한다", () => {
      const renderer = new AgentGhostPreviewRenderer(mockScene, mockLayer, () => "m1", { clock: () => now });
      const { base, draft } = blankPair();
      draft.maps["m1"].lowerTiles[0] = 5;
      replaceAgentGhostPreviewFromProjectDiff(base, draft);
      renderer.render();

      clearAgentGhostPreview();
      renderer.render();
      expect(renderer.getCurrentSchedule()).toHaveLength(0);

      now += 5000;
      const next = createBlankProject();
      next.maps["m1"] = createBlankMap("m1", 20, 20);
      next.maps["m1"].lowerTiles[0] = 9;
      replaceAgentGhostPreviewFromProjectDiff(base, next);
      renderer.render();
      // 새 턴의 첫 셀은 다시 0ms 다(이전 턴의 경과 시간을 물려받지 않는다).
      expect(startMsByCell(renderer).get("0,0")).toBe(0);
    });
  });
});

describe("agentGhostPreviewHidden", () => {
  isolateTimers();
  describe("agentGhostPreview hidden toggle", () => {
    beforeEach(() => {
      setAgentGhostPreviewHidden(false);
      clearAgentGhostPreview();
    });

    it("토글 상태를 보관하고 변경 시 구독자에게 알린다", () => {
      let notified = 0;
      const unsubscribe = subscribeAgentGhostPreview(() => { notified += 1; });
      const before = notified; // 구독 즉시 1회 호출됨
      setAgentGhostPreviewHidden(true);
      expect(isAgentGhostPreviewHidden()).toBe(true);
      expect(notified).toBe(before + 1);
      setAgentGhostPreviewHidden(true); // 동일 값 — emit 없음
      expect(notified).toBe(before + 1);
      setAgentGhostPreviewHidden(false);
      expect(isAgentGhostPreviewHidden()).toBe(false);
      unsubscribe();
    });

    it("숨김은 프리뷰 데이터 자체를 파괴하지 않는다", () => {
      setAgentGhostPreviewHidden(true);
      expect(getAgentGhostPreviewState().previews).toEqual([]);
      setAgentGhostPreviewHidden(false);
    });
  });
});

describe("agentGhostPreviewRenderers", () => {
  isolateTimers();
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
    it("narrates toolNames in Korean and tracks progress vs completion without exposing internal ids", () => {
      const buildInfo = ghostPhaseChipInfo({
        toolName: "build_house",
        revealedCount: 3,
        totalCount: 10,
        isScheduleComplete: false,
      });
      expect(buildInfo.koreanLabel).toBe("집을 만드는 중");
      expect(buildInfo.spinner).toBe(true);
      expect(buildInfo.text).toBe("집을 만드는 중 · 3/10 셀");
      expect(buildInfo.text).not.toContain("build_house");

      const npcInfo = ghostPhaseChipInfo({
        toolName: "place_npc",
        revealedCount: 1,
        totalCount: 1,
        isScheduleComplete: false,
      });
      expect(npcInfo.koreanLabel).toBe("사람을 만드는 중");
      expect(npcInfo.text).toBe("사람을 만드는 중 · 1/1 셀");
      expect(npcInfo.text).not.toContain("place_npc");

      const eventInfo = ghostPhaseChipInfo({
        toolName: "upsert_event",
        revealedCount: 1,
        totalCount: 2,
        isScheduleComplete: false,
      });
      expect(eventInfo.koreanLabel).toBe("이벤트를 만드는 중");

      const otherInfo = ghostPhaseChipInfo({
        toolName: "unknown_internal_tool",
        revealedCount: 0,
        totalCount: 5,
        isScheduleComplete: false,
      });
      expect(otherInfo.koreanLabel).toBe("작업을 진행하는 중");
      expect(otherInfo.text).not.toContain("unknown_internal_tool");

      const doneInfo = ghostPhaseChipInfo({
        toolName: "paint_tiles",
        revealedCount: 10,
        totalCount: 10,
        isScheduleComplete: true,
        runningToolName: "",
      });
      expect(doneInfo.spinner).toBe(false);
      expect(doneInfo.text).toBe("초안 완성");

      const stillRunningInfo = ghostPhaseChipInfo({
        toolName: "paint_tiles",
        revealedCount: 10,
        totalCount: 10,
        isScheduleComplete: true,
        runningToolName: "paint_tiles",
      });
      expect(stillRunningInfo.spinner).toBe(true);
      expect(stillRunningInfo.text).toBe("타일을 칠하는 중 · 10/10 셀");
    });

    it("셀 수를 아직 모르는 도구 시작 직후에는 0/0 분수를 쓰지 않고 행동만 알린다", () => {
      const info = ghostPhaseChipInfo({
        toolName: "paint_tiles",
        revealedCount: 0,
        totalCount: 0,
        isScheduleComplete: false,
      });
      expect(info.text).toBe("타일을 칠하는 중");
      expect(info.text).not.toContain("0/0");
      expect(info.spinner).toBe(true);
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
          container: vi.fn(() => containerFactory!()),
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
            worldView: { x: 0, y: 0 },
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

    it("(c) >256-cell preview keeps actual tile sprites and the count", () => {
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

      // Large previews must not collapse to a bounding box.
      expect(mockScene.add.image).toHaveBeenCalled();

      const chip = hostEl.querySelector("[data-testid='ai-ghost-phase-chip']");
      expect(chip).not.toBeNull();
      expect(chip?.textContent).toContain("300 셀");
    });

    it("이어 칠한 칸만 스프라이트를 추가하고, 이미 만든 칸은 다시 만들지 않는다", () => {
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
      const imagesAfterFirst = mockScene.add.image.mock.calls.length;
      expect(imagesAfterFirst).toBe(1);

      draft.maps["m1"].lowerTiles[1] = 6;
      replaceAgentGhostPreviewFromProjectDiff(base, draft);
      renderer.render();

      expect(mockScene.add.image.mock.calls.length - imagesAfterFirst).toBe(1);
      expect(renderer["animGroup"]).toBe(mockLayer.list[0]);
    });

    it("레이어에서 떨어진 미리보기는 다음 render()에서 새 그룹에 다시 붙인다", () => {
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
      const firstGroup = renderer["animGroup"] as { parentContainer: unknown };
      firstGroup.parentContainer = null;
      mockLayer.list.length = 0;
      renderer.render();
      const secondGroup = renderer["animGroup"];
      expect(secondGroup).not.toBe(firstGroup);
      const tileLayer = renderer["tileLayer"] as { parentContainer: unknown; list: unknown[] };
      expect(tileLayer.parentContainer).toBe(secondGroup);
      expect(tileLayer.list.length).toBeGreaterThan(0);
      expect(renderer["tileLayerParent"]).toBe(secondGroup);
    });
  });
});

describe("agentGhostRunningTool", () => {
  isolateTimers();
  afterEach(clearAgentGhostPreview);
  describe("running-tool map ownership", () => {
    it.each([
      { mapId: "a" },
      { target: { kind: "existing", mapId: "a" } },
    ])("captures the explicit tool target before preview cells for %j", (args) => {
      // Given: no geometry has arrived.
      clearAgentGhostPreview();
      // When: a map-targeted tool starts.
      setAgentGhostRunningTool("fill_region", args);
      // Then: activity already belongs to its target, not a viewed map.
      expect(getAgentGhostPreviewState()).toMatchObject({ previews: [], runningToolName: "fill_region", runningToolMapId: "a" });
    });

    it("publishes an owner change even when the tool name is unchanged", () => {
      // Given: A owns a running tool.
      setAgentGhostRunningTool("fill_region", { mapId: "a" });
      const states: AgentGhostPreviewState[] = [];
      const unsubscribe = subscribeAgentGhostPreview(state => states.push(state));
      try {
        // When: the same tool starts on B.
        setAgentGhostRunningTool("fill_region", { mapId: "b" });
        // Then: subscribers receive the changed ownership.
        expect(states).toHaveLength(2);
        expect(states[1]).toMatchObject({ runningToolName: "fill_region", runningToolMapId: "b" });
      } finally { unsubscribe(); }
    });

    it.each([undefined, {}, { mapId: 12 }, { target: { kind: "new" } }])("does not inherit the last owner for unknown target %j", (args) => {
      // Given: a previously targeted tool.
      setAgentGhostRunningTool("fill_region", { mapId: "a" });
      // When: a tool without a known map starts.
      setAgentGhostRunningTool("get_project_summary", args);
      // Then: the name remains available, but canvas ownership is unknown.
      expect(getAgentGhostPreviewState()).toMatchObject({ runningToolName: "get_project_summary", runningToolMapId: null });
    });

    it.each([clearAgentGhostRunningTool, clearAgentGhostPreview])("clears name and ownership together via %s", (clear) => {
      // Given: an owned running tool.
      setAgentGhostRunningTool("fill_region", { mapId: "a" });
      // When: tool/turn state is cleared.
      clear();
      // Then: neither name nor owner survives.
      expect(getAgentGhostPreviewState()).toMatchObject({ runningToolName: "", runningToolMapId: null });
    });
  });
});
