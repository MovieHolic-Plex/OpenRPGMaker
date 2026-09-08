import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type ProposedCall, type TurnResult } from "@/ai/assistantSession";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { type ToolContext, type ToolResult } from "@/editor/tools";
import type { ChangeSummary } from "@/editor/tools/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { completeChatTurn } from "./helpers/aiChatTestSignals";

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
    value: Object.assign(new EventTarget(), {
      localStorage: storage,
      location: { search: "?aiBridge=0", href: "http://localhost/?aiBridge=0" },
      setTimeout: (handler: TimerHandler) => {
        if (typeof handler === "function") handler();
        return 0;
      },
      clearTimeout: vi.fn(),
      innerWidth: 1280,
      innerHeight: 800,
    }),
  });
  Object.defineProperty(document, "addEventListener", { configurable: true, value: vi.fn() });
  Object.defineProperty(document, "removeEventListener", { configurable: true, value: vi.fn() });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, writable: true, value: null });
  Object.defineProperty(document, "documentElement", { configurable: true, value: document.createElement("html") });
}

// 도크는 float 하나뿐이라 렌더 인자가 없다 (구 `getChatDock` 옵션 삭제).
function renderPanel(): FakeElement {
  storage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
    ...defaultAiConfig(),
    apiKey: "sk-test",
    baseUrl: "x",
    model: "m",
    authMode: "apiKey",
    agentMode: "chat",
  }));
  return renderAiChatPanel({ clock: () => 1_000 }) as unknown as FakeElement;
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

afterEach(async () => {
  await whenAiChatPanelSettled();
  teardownAiChatPanel();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "window");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// 도크 축 삭제(float 단일) — 「유리 도크는 카드 안에 물린다」 분기가 없어져, 더보기 메뉴는
// 항상 뷰포트 기준으로 앵커된다. 케이스를 지우지 않고 그 반대 계약으로 뒤집었다.
describe("Assistant After UX contracts", () => {
  it("더보기 메뉴는 언제나 뷰포트에 앵커된다 — 카드 안 물림 분기는 없다", () => {
    // Break: 유리 도크용 in-card 분기가 되살아나 `right: 0` 로 붙거나 좌표를 안 심는다.
    const panel = renderPanel();
    const menu = findByTestId(panel, "ai-more-menu") as FakeElement;
    if (menu) menu.hidden = true;

    findByTestId(panel, "ai-more-menu-toggle")?.click();
    expect(menu?.hidden).toBe(false);
    expect(menu?.classList.contains("is-viewport-anchored")).toBe(true);
    // anchoredPopupPosition 결과를 인라인 좌표로 심는다 — right 로 붙이는 경로는 없다.
    expect(menu?.style.left ?? "").toMatch(/^-?\d+(\.\d+)?px$/);
    expect(menu?.style.top ?? "").toMatch(/^-?\d+(\.\d+)?px$/);
    expect(menu?.style.right ?? "").toBe("");
  });

  it("folds header undo/export actions under 작업 so the idle-view menu hugs", () => {
    const panel = renderPanel();
    findByTestId(panel, "ai-more-menu-toggle")?.click();
    const menu = findByTestId(panel, "ai-more-menu") as FakeElement;
    const fold = findByTestId(menu, "ai-more-actions");
    expect(fold).not.toBeNull();
    expect(fold?.textContent ?? "").toContain("작업");
    expect(findByTestId(fold!, "ai-more-export")).not.toBeNull();
    // 「도크 전환」 항목은 도크 축과 함께 삭제됐다.
    expect(findByTestId(fold!, "ai-more-dock")).toBeNull();
    // 대기 화면 라디오는 접기 밖 — 펼치지 않아도 바로 보인다.
    expect(findByTestId(fold!, "ai-temperature-quiet-gold")).toBeNull();
    expect(findByTestId(menu, "ai-temperature-quiet-gold")).not.toBeNull();
  });

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
    await completeChatTurn(() => findByTestId(panel, "ai-send")?.click());

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
    await completeChatTurn(() => findByTestId(panel, "ai-send")?.click());

    // Message has badge applied
    expect(findByTestId(panel, "ai-msg-badge-applied")?.textContent).toBe("적용됨");

    // Status or composer row must NOT show duplicate 적용됨 next to send button
    const composerStatus = findByTestId(panel, "ai-status")?.textContent;
    expect(composerStatus).not.toBe("적용됨");
  });
});
