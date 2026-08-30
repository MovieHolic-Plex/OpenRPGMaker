// 라이브 프리뷰는 150ms 스로틀로 셀이 계속 늘어난다. 예전 렌더러는 셀 집합 지문이 바뀌면
// startTime 을 되감았으므로 툴 12개짜리 턴이 "왼쪽부터 쏵"을 12번 반복했다 — 쌓여가는 것이
// 아니라 깜빡임으로 읽혔다. 이 스펙은 이미 드러난 셀의 공개 시각이 보존되는지를 못 박는다.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentGhostPreviewRenderer } from "@/editor/agentPreviewRenderers";
import {
  clearAgentGhostPreview,
  GHOST_WIPE_DURATION_MS,
  replaceAgentGhostPreviewFromProjectDiff,
} from "@/editor/agentGhostPreview";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";
import type { Project } from "@/project/types";

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
