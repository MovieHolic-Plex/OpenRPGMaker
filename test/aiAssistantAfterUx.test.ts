import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type ProposedCall, type TurnResult } from "@/ai/assistantSession";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { runTool, type ToolContext } from "@/editor/tools";
import type { Project } from "@/project/types";
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
      dispatchEvent: vi.fn(() => true),
      innerWidth: 1280,
      innerHeight: 800,
    },
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

/**
 * 독립 검수를 통과한 후보를 모델링한다. sendUserMessage 가 돌려주는 턴에 승인 리뷰를
 * 싣고, getProposedProject 는 검수 대상 초안의 불변 스냅샷을 돌려준다 — 실제 적용
 * 경로의 승인 확인(isDraftReviewApproved)과 stale 베이스라인 검사는 그대로 탄다.
 * 검수를 끄거나 베이스라인을 다시 캡처하지 않는다.
 */
function reviewedTurn(result: Partial<TurnResult>): TurnResult {
  return {
    ...turn(result),
    review: { status: "approved", revision: 1, summary: "독립 검수 승인", findings: [] },
  };
}

/**
 * 검수 후보 모의는 캡처된 불변 스냅샷에만 묶는다. getProposedProject 는 후보의
 * 복제본만 내주고(원본 별칭 유출 금지), isDraftReviewApproved 는 그 스냅샷의
 * 직렬화 동일성으로만 판정한다 — 무조건 true 가 아니라 달라진 후보는 거부한다.
 */
function mockReviewedCandidate(candidate: Project): void {
  const reviewedIdentity = JSON.stringify(candidate);
  vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => structuredClone(candidate));
  vi.spyOn(AssistantSession.prototype, "isDraftReviewApproved").mockImplementation((project?: Project) => {
    return JSON.stringify(project ?? structuredClone(candidate)) === reviewedIdentity;
  });
}

function runProposed(ctx: ToolContext, name: string, args: Record<string, unknown>): ProposedCall {
  const result = runTool(ctx, name, args, { dryRun: false });
  if (!result.ok) throw new Error(result.summary);
  return { name, args, summary: result.summary, result, destructive: false };
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

    const ctx: ToolContext = { project: structuredClone(store.getCurrent()) };
    const calls = [
      runProposed(ctx, "paint_tiles", { mapId, layer: "lower", mode: "cells", tile: TILE.PATH, cells: [{ x: 2, y: 2 }] }),
    ];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(reviewedTurn({ assistantText, proposedCalls: calls }));
    mockReviewedCandidate(ctx.project);

    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "동굴 입구에 길 1칸 깔아줘";
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
    const calls = [
      runProposed(ctx, "paint_tiles", { mapId, layer: "lower", mode: "cells", tile: TILE.PATH, cells: [{ x: 2, y: 2 }] }),
    ];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(reviewedTurn({ assistantText: "길 1칸을 놓았습니다.", proposedCalls: calls }));
    mockReviewedCandidate(ctx.project);

    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "길 1칸 깔아줘";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    // Message has badge applied
    expect(findByTestId(panel, "ai-msg-badge-applied")?.textContent).toBe("적용됨");

    // Status or composer row must NOT show duplicate 적용됨 next to send button
    const composerStatus = findByTestId(panel, "ai-status")?.textContent;
    expect(composerStatus).not.toBe("적용됨");
  });
});
