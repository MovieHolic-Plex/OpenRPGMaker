import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { placeAiActivityChip } from "@/editor/aiActivityChipPlacement";
import { AgentGhostPreviewRenderer, ghostPhaseChipInfo } from "@/editor/agentPreviewRenderers";
import { regionTaskBadgeText } from "@/editor/EditScene";
import {
  appendAgentGhostPreviewForToolCall,
  clearAgentGhostPreview,
  clearAgentGhostRunningTool,
  replaceAgentGhostPreviewFromProjectDiff,
  setAgentGhostRunningTool,
} from "@/editor/agentGhostPreview";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, installFakeDom } from "./fakeDom";

vi.mock("@/app/phaserRuntime", () => ({
  getLoadedPhaser: () => ({
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: "shutdown", DESTROY: "destroy" } },
  }),
}));

function makeEmitter() {
  const handlers = new Map<string, Set<() => void>>();
  return {
    on(name: string, handler: () => void) {
      const listeners = handlers.get(name) ?? new Set();
      listeners.add(handler);
      handlers.set(name, listeners);
      return this;
    },
    once(name: string, handler: () => void) {
      return this.on(name, handler);
    },
    off(name: string, handler: () => void) {
      handlers.get(name)?.delete(handler);
      return this;
    },
    emit(name: string) {
      for (const handler of [...(handlers.get(name) ?? [])]) handler();
      return true;
    },
  };
}

function makeContainer(): any {
  const container: any = {
    list: [],
    parentContainer: null,
    setName: vi.fn(),
    add: vi.fn((...children: any[]) => {
      for (const child of children) {
        child.parentContainer = container;
        container.list.push(child);
      }
    }),
    removeAll: vi.fn(() => { container.list.length = 0; }),
    destroy: vi.fn(),
  };
  return container;
}

function makeRendererScene(
  canvas: FakeElement,
  camera: {
    scrollX: number;
    scrollY: number;
    zoom: number;
    worldView?: { x: number; y: number };
  } = { scrollX: 0, scrollY: 0, zoom: 1 },
): any {
  return {
    add: {
      container: vi.fn(() => makeContainer()),
      graphics: vi.fn(() => ({
        fillStyle: vi.fn(),
        fillRect: vi.fn(),
        lineStyle: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        strokePath: vi.fn(),
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
        ...camera,
        worldView: camera.worldView ?? { x: camera.scrollX, y: camera.scrollY },
      },
    },
    textures: {
      exists: vi.fn(() => true),
      get: vi.fn(() => ({ getSourceImage: vi.fn() })),
      addCanvas: vi.fn(),
    },
    game: { canvas },
    tweens: { add: vi.fn() },
    events: makeEmitter(),
  };
}

describe("맵 캔버스 AI 진행 칩", () => {
  let restoreDom: (() => void) | null = null;
  let host: FakeElement;
  let canvas: FakeElement;

  beforeEach(() => {
    restoreDom = installFakeDom();
    clearAgentGhostPreview();
    host = document.createElement("div") as unknown as FakeElement;
    canvas = document.createElement("canvas") as unknown as FakeElement;
    host.append(canvas);
    document.body.append(host as unknown as Node);
    vi.spyOn(FakeElement.prototype, "getBoundingClientRect").mockImplementation(function (this: FakeElement) {
      if (this.classList.contains("ai-ghost-phase-chip")) {
        return { x: 0, y: 0, left: 0, top: 0, right: 160, bottom: 28, width: 160, height: 28, toJSON: () => ({}) };
      }
      if (this.tagName === "CANVAS") {
        return { x: 180, y: 90, left: 180, top: 90, right: 820, bottom: 570, width: 640, height: 480, toJSON: () => ({}) };
      }
      if (this === host) {
        return { x: 40, y: 25, left: 40, top: 25, right: 1040, bottom: 725, width: 1000, height: 700, toJSON: () => ({}) };
      }
      return { x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) };
    });
  });

  afterEach(() => {
    clearAgentGhostPreview();
    host?.remove();
    vi.restoreAllMocks();
    restoreDom?.();
    restoreDom = null;
  });

  it("쓰기 도구를 사용자용 한국어 행동과 셀 진행률로 설명하고 내부 도구명은 숨긴다", () => {
    const info = ghostPhaseChipInfo({
      toolName: "paint_road",
      revealedCount: 12,
      totalCount: 40,
      isScheduleComplete: false,
    });

    expect(info.text).toContain("길을 그리는 중");
    expect(info.text).toContain("12/40 셀");
    expect(info.text).not.toMatch(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/u);
  });

  it("프리뷰 영역 위치를 캔버스 좌표에서 칩 호스트 좌표로 보정한다", () => {
    const project = createBlankProject();
    project.maps.m1 = createBlankMap("m1", 30, 30);
    store.replace(project);
    appendAgentGhostPreviewForToolCall(project, "clear_region", {
      mapId: "m1",
      x: 10,
      y: 8,
      w: 4,
      h: 3,
    });
    const camera = { scrollX: 64, scrollY: 32, zoom: 1.5, worldView: { x: 96, y: 48 } };
    const renderer = new AgentGhostPreviewRenderer(makeRendererScene(canvas, camera), makeContainer(), () => "m1");

    renderer.render();

    const expected = placeAiActivityChip({
      region: { x: 10, y: 8, width: 4, height: 3 },
      camera: { worldView: camera.worldView, zoom: camera.zoom },
      viewport: { width: 640, height: 480 },
      chip: { width: 160, height: 28 },
    });
    const chip = host.querySelector("[data-testid='ai-ghost-phase-chip']");
    const canvasToHost = { x: 180 - 40, y: 90 - 25 };
    expect(chip?.style.left).toBe(`${expected.left + canvasToHost.x}px`);
    expect(chip?.style.top).toBe(`${expected.top + canvasToHost.y}px`);
    expect(chip?.dataset.chipMode).toBe(expected.mode);
    expect(expected).toMatchObject({ left: 64, top: 84, mode: "above", anchored: true });
  });

  it("도구 시작 직후 셀이 없어도 코너 폴백으로 칩을 마운트한다", () => {
    store.replace(createBlankProject());
    setAgentGhostRunningTool("paint_road", { mapId: "m1" });
    const renderer = new AgentGhostPreviewRenderer(makeRendererScene(canvas), makeContainer(), () => "m1");

    renderer.render();

    const chip = host.querySelector("[data-testid='ai-ghost-phase-chip']");
    expect(chip).not.toBeNull();
    expect(chip?.dataset.chipMode).toBe("corner");
    expect(chip?.textContent).toContain("길을 그리는 중");
  });

  it.each(["render", "update"] as const)("removes A's empty-preview chip on B via %s and restores it on A", (refresh) => {
    // Given: activity on A, before any preview cells exist.
    let mapId = "m1";
    const renderer = new AgentGhostPreviewRenderer(makeRendererScene(canvas), makeContainer(), () => mapId);
    setAgentGhostRunningTool("fill_region", { mapId: "m1" });
    renderer.render();
    expect(host.querySelector("[data-testid='ai-ghost-phase-chip']")).not.toBeNull();

    // When: the viewed map changes, without clearing the owner's activity.
    mapId = "m2";
    renderer[refresh]();

    // Then: B has no chip, while returning to A restores it.
    expect(host.querySelector("[data-testid='ai-ghost-phase-chip']")).toBeNull();
    mapId = "m1";
    renderer.render();
    expect(host.querySelector("[data-testid='ai-ghost-phase-chip']")).not.toBeNull();
    clearAgentGhostRunningTool();
    renderer.render();
    expect(host.querySelector("[data-testid='ai-ghost-phase-chip']")).toBeNull();
    renderer.clear();
  });

  it("keeps unknown-target activity off the canvas", () => {
    // Given: no map identity in the tool event.
    setAgentGhostRunningTool("get_project_summary");
    const renderer = new AgentGhostPreviewRenderer(makeRendererScene(canvas), makeContainer(), () => "m1");
    // When: rendering the currently viewed map.
    renderer.render();
    // Then: chat-only activity must not acquire that map.
    expect(host.querySelector("[data-testid='ai-ghost-phase-chip']")).toBeNull();
    renderer.clear();
  });

  it("does not let A's running tool label or spinner contaminate B's local diff", () => {
    // Given: B has a real local preview, but the running tool belongs to A.
    const project = createBlankProject();
    project.maps.m2 = createBlankMap("m2", 10, 10);
    store.replace(project);
    const draft = structuredClone(project);
    draft.maps.m2.lowerTiles[0] = 1;
    replaceAgentGhostPreviewFromProjectDiff(project, draft);
    let now = 0;
    const renderer = new AgentGhostPreviewRenderer(makeRendererScene(canvas), makeContainer(), () => "m2", { clock: () => now });
    renderer.render();
    const localLabel = host.querySelector(".ai-ghost-phase-text")?.textContent;

    // When: A starts a different tool while B's preview remains visible.
    setAgentGhostRunningTool("fill_region", { mapId: "m1" });
    renderer.render();

    // Then: B keeps its own label and completes independently of A.
    expect(host.querySelector(".ai-ghost-phase-text")?.textContent).toBe(localLabel);
    now = 1000;
    renderer.update();
    expect(host.querySelector(".ai-ghost-phase-spinner")).toBeNull();
    renderer.clear();
  });

  it("실행 중에는 고스트 진행 칩만 보이고 영역 배지는 확인 대기 단계만 맡는다", () => {
    const runningChip = ghostPhaseChipInfo({
      toolName: "paint_road",
      revealedCount: 12,
      totalCount: 40,
      isScheduleComplete: false,
    });

    expect(regionTaskBadgeText("running")).toBeNull();
    expect(regionTaskBadgeText("pending")).toBe("✓ 변경 확인 대기");
    expect(runningChip.text).toContain("길을 그리는 중");
  });
});
