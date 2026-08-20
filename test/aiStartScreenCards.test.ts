import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { directorStartPrompts, readAgentBrief } from "@/editor/panels/aiAgentBrief";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { installFakeDom, findByTestId, renderWithFakeDom } from "./fakeDom";
import {
  buildRecentAiWorkCard,
  buildTryRegionCard,
  buildVisualStartGallery,
  defaultAiVisualStartPrompts,
  formatRelativeTime,
  summarizeActivityResult,
} from "@/editor/panels/aiStartScreenCards";
import type { AiActivityLogRecord } from "@/ai/activityLog";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  store.replace(createBlankProject());
  restoreDom = installFakeDom();
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
  const mapId = store.getCurrent().startMapId;
  editorState.set({
    currentMapId: mapId,
    layer: "lower",
    tool: "paint",
    selection: null,
    chatDock: "float",
  });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

const NOW = new Date("2026-07-10T12:00:00Z");

function record(overrides: Partial<AiActivityLogRecord> = {}): AiActivityLogRecord {
  return {
    id: "log1",
    at: "2026-07-10T11:55:00Z",
    channel: "region",
    instruction: "이 영역을 잔디로 채워줘",
    result: { ok: true, applied: true, changedCells: 34, changedEvents: 2 },
    toolCalls: [],
    audit: [],
    ...overrides,
  } as AiActivityLogRecord;
}

describe("formatRelativeTime", () => {
  it("분/시간/일 단위", () => {
    expect(formatRelativeTime("2026-07-10T11:59:40Z", NOW)).toBe("방금 전");
    expect(formatRelativeTime("2026-07-10T11:55:00Z", NOW)).toBe("5분 전");
    expect(formatRelativeTime("2026-07-10T09:00:00Z", NOW)).toBe("3시간 전");
    expect(formatRelativeTime("2026-07-08T12:00:00Z", NOW)).toBe("2일 전");
  });
});

describe("summarizeActivityResult", () => {
  it("적용/오류/무변경을 요약한다", () => {
    expect(summarizeActivityResult(record())).toBe("34칸 · 이벤트 2건");
    expect(summarizeActivityResult(record({ result: { ok: false, applied: false, error: "boom" } as never }))).toBe("오류");
    expect(summarizeActivityResult(record({ result: { ok: true, applied: false, changedCells: 0, changedEvents: 0 } as never }))).toBe("변경 없음");
  });
});

describe("buildTryRegionCard", () => {
  it("예시 칩 클릭 시 onPick에 instruction을 넘긴다", () => {
    const picked: string[] = [];
    const card = renderWithFakeDom(() =>
      buildTryRegionCard({
        commands: [{ id: "c1", label: "🌊 호수", instruction: "둥근 호수를 만들어줘", category: "타일" }],
        onPick: (instruction) => picked.push(instruction),
      }),
    );
    expect(findByTestId(card, "ai-start-try-region")).not.toBeNull();
    findByTestId(card, "ai-start-try-c1")!.dispatchEvent(new Event("click"));
    expect(picked).toEqual(["둥근 호수를 만들어줘"]);
  });
});

describe("buildRecentAiWorkCard", () => {
  it("기록이 있으면 최근 항목을 렌더, 없으면 null", () => {
    const built = buildRecentAiWorkCard([record()], NOW);
    expect(built).not.toBeNull();
    const card = renderWithFakeDom(() => built!);
    expect(findByTestId(card, "ai-start-recent-work")).not.toBeNull();
    expect(card.textContent).toContain("34칸");
    expect(card.textContent).toContain("5분 전");
    expect(buildRecentAiWorkCard([], NOW)).toBeNull();
  });
});

describe("buildVisualStartGallery", () => {
  it("모자이크 헬퍼는 호출 시에만 썸을 만들고 5열 갤러리를 부팅 빈 면으로 쓰지 않는다", () => {
    // Break: panel boot still mounts ai-start-visual-gallery as the empty product.
    const project = createBlankProject();
    const tileset = project.tilesets[DEFAULT_TILESET_ID] ?? Object.values(project.tilesets)[0] ?? null;
    const gallery = renderWithFakeDom(() =>
      buildVisualStartGallery({
        tileset,
        onPick: () => undefined,
      }),
    );
    expect(findByTestId(gallery, "ai-start-visual-stage-place")).toBeTruthy();
    expect(defaultAiVisualStartPrompts().length).toBeGreaterThanOrEqual(3);

    const panel = renderWithFakeDom(() => renderAiChatPanel());
    if (panel.classList.contains("is-collapsed")) {
      findByTestId(panel, "ai-collapsed-restore")?.click();
    }
    const prompts = directorStartPrompts(readAgentBrief());
    const chips = findByTestId(panel, "ai-composer-chips");
    expect(findByTestId(panel, "ai-start-visual-gallery")).toBeNull();
    expect(findByTestId(panel, "ai-empty-cta")).toBeNull();
    expect(chips?.querySelectorAll("button").length).toBe(prompts.length);
    expect(prompts.length).toBeLessThanOrEqual(3);
  });
});
