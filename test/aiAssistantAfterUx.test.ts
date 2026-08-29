import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type ProposedCall, type TurnResult } from "@/ai/assistantSession";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { runTool, type ToolContext, type ToolResult } from "@/editor/tools";
import type { ChangeSummary } from "@/editor/tools/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

let restoreDom: (() => void) | null = null;
let storage: MemoryStorage;

function changeSummary(overrides: Partial<ChangeSummary> = {}): ChangeSummary {
  return {
    tilesChanged: 0,
    eventsAdded: 0,
    eventsModified: 0,
    eventsRemoved: 0,
    mapsAdded: 0,
    mapsRemoved: 0,
    dbRecordsChanged: 0,
    tilesetsChanged: 0,
    switchesAdded: 0,
    variablesAdded: 0,
    worldEntitiesAdded: 0,
    worldEntitiesModified: 0,
    palettePresetsAdded: 0,
    palettePresetsModified: 0,
    endingsChanged: 0,
    sessionChanged: false,
    systemChanged: false,
    warnings: [],
    ...overrides,
  };
}

function proposed(
  name: string,
  args: Record<string, unknown>,
  diff: Partial<ChangeSummary>,
  summary = `${name} summary`,
  data?: unknown
): ProposedCall {
  const result: ToolResult = { ok: true, summary, diff: changeSummary(diff), data };
  return { name, args, summary, result, destructive: false };
}

function installBrowserGlobals(): void {
  storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: storage });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      localStorage: storage,
      location: { search: "?aiBridge=0", href: "http://localhost/?aiBridge=0" },
      setTimeout: (handler: TimerHandler) => {
        if (typeof handler === "function") handler();
        return 0;
      },
      clearTimeout: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      innerWidth: 1280,
      innerHeight: 800,
    },
  });
  Object.defineProperty(document, "addEventListener", { configurable: true, value: vi.fn() });
  Object.defineProperty(document, "removeEventListener", { configurable: true, value: vi.fn() });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, writable: true, value: null });
  Object.defineProperty(document, "documentElement", { configurable: true, value: document.createElement("html") });
}

function renderPanel(): FakeElement {
  storage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
    ...defaultAiConfig(),
    apiKey: "sk-test",
    baseUrl: "x",
    model: "m",
    agentMode: "chat",
    autoApprove: false,
  }));
  return renderAiChatPanel({ clock: () => 1_000}) as unknown as FakeElement;
}

async function flushAsync(): Promise<void> {
  for (let i = 0; i < 25; i += 1) await Promise.resolve();
}

function turn(result: Partial<TurnResult>): TurnResult {
  return {
    assistantText: result.assistantText ?? "",
    proposedCalls: result.proposedCalls ?? [],
    stoppedReason: result.stoppedReason ?? "final",
    ...(result.error ? { error: result.error } : {}),
  };
}

beforeEach(() => {
  restoreDom = installFakeDom();
  installBrowserGlobals();
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubGlobal("fetch", (async () => new Response(null, { status: 201 })) satisfies typeof fetch);
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  resetMapEditHistory();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "window");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Assistant After UX contracts", () => {
  // ── 삭제한 헤더 ☰ 테스트 2건 ────────────────────────────────────────────────
  //   glass dock clamps more menu inside card without is-viewport-anchored …
  //   folds header undo/dock actions under 작업 so the idle-view menu hugs
  //
  // 둘 다 `ai-more-menu` 를 열어서 재고 있었다. 그 메뉴는 숨은 툴바(`hidden` + `inert`) 안에
  // 있어 실제로는 열 수 없었고, 조수 띠에서 삭제됐다 — 남은 ☰ 는 컴포저 액션 행의 것 하나이며
  // 유리 카드 안 클램프(`is-viewport-anchored`)도 유리 도크와 함께 사라졌다.

  it("folds lint and quality verification dumps into details labeled 작업 기록", async () => {
    const mapId = store.getCurrent().startMapId;
    const lintDump = "- id map_dungeon_1\n✓ lint: error 0 / warning 226 / info 4\n✓ 출입구 쌍: 빈 맵(49,20) ↔ 어두운 동굴 던전(15,28)\n✓ 게임 품질 평가 통과 (객관 차단 오류 없음)";
    const assistantText = `동쪽 길 끝에 입구를 열고, 새 던전 맵과 양방향 이동을 붙였습니다.\n\n\`\`\`\n${lintDump}\n\`\`\``;

    const calls = [proposed("paint_tiles", { mapId }, { tilesChanged: 2 }, "타일 2칸")];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn({ assistantText, proposedCalls: calls }));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => store.getCurrent());

    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "동굴 입구 만들어줘";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    const log = findByTestId(panel, "ai-chat-log") as FakeElement;
    const workLog = log.querySelector("details.ai-work-log, details.work, [data-testid=ai-work-log]");
    expect(workLog).toBeTruthy();
    expect(workLog?.textContent).toContain("작업 기록");
    expect(workLog?.textContent).toContain("lint: error 0");
  });

  it("shows at most one 적용됨 badge across message and composer row", async () => {
    const baseline = store.getCurrent();
    const mapId = baseline.startMapId;
    const ctx: ToolContext = { project: structuredClone(baseline) };
    const calls = [proposed("paint_tiles", { mapId, layer: "lower", mode: "cells", tile: TILE.PATH, cells: [{ x: 2, y: 2 }] }, { tilesChanged: 1 }, "길")];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn({ assistantText: "적용 준비", proposedCalls: calls }));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => structuredClone(ctx.project));

    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "길 깔아";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    findByTestId(panel, "ai-proposal-accept")?.click();
    await flushAsync();

    // Message has badge applied
    expect(findByTestId(panel, "ai-msg-badge-applied")?.textContent).toBe("적용됨");

    // Status or composer row must NOT show duplicate 적용됨 next to send button
    const composerStatus = findByTestId(panel, "ai-status")?.textContent;
    expect(composerStatus).not.toBe("적용됨");
  });
});
