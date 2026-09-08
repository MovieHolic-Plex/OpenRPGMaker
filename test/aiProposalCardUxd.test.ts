import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type ProposedCall, type TurnResult } from "@/ai/assistantSession";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { clearAgentGhostPreview } from "@/editor/agentGhostPreview";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import {
  proposalHumanSummaryLine,
  proposalSummaryLines,
  renderAiChatPanel,
  teardownAiChatPanel,
  whenAiChatPanelSettled,
} from "@/editor/panels/aiChatPanel";
import { computeMapTileChangeBounds, renderProposalMapThumbnail } from "@/editor/panels/aiProposalCard";
import { runTool, type ToolContext, type ToolResult } from "@/editor/tools";
import type { ChangeSummary } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
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
  data?: unknown,
): ProposedCall {
  const result: ToolResult = { ok: true, summary, diff: changeSummary(diff), data };
  return { name, args, summary, result, destructive: false };
}

function runProposed(ctx: ToolContext, name: string, args: Record<string, unknown>): ProposedCall {
  const result = runTool(ctx, name, args, { dryRun: false });
  if (!result.ok) throw new Error(result.summary);
  return { name, args, summary: result.summary, result, destructive: false };
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

function renderPanel(): FakeElement {
  storage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
    ...defaultAiConfig(),
    apiKey: "sk-test",
    authMode: "apiKey",
    baseUrl: "x",
    model: "m",
  }));
  return renderAiChatPanel({ clock: () => 1_000 }) as unknown as FakeElement;
}

function turn(proposedCalls: ProposedCall[], assistantText = "완료"): TurnResult {
  return { assistantText, proposedCalls, stoppedReason: "final" };
}

beforeEach(() => {
  restoreDom = installFakeDom();
  installBrowserGlobals();
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubGlobal("fetch", (async () => new Response(null, { status: 201 })) satisfies typeof fetch);
  store.replace(createBlankProject());
  editorState.set({ currentMapId: store.getCurrent().startMapId, selection: null });
  resetMapEditHistory();
});

afterEach(async () => {
  await whenAiChatPanelSettled();
  teardownAiChatPanel();
  restoreDom?.();
  restoreDom = null;
  clearAgentGhostPreview();
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "window");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("제안 결과 요약", () => {
  it("집·길·나무·세계관을 사람 언어로 집계한다", () => {
    const calls = [
      proposed("build_house", { mapId: "m1" }, { tilesChanged: 40 }, "집 A"),
      proposed("author_house", { mapId: "m1" }, { tilesChanged: 50 }, "집 B"),
      proposed("paint_road", { mapId: "m1" }, { tilesChanged: 33 }, "마을에 dirt 도로 33칸"),
      proposed("scatter_object", { mapId: "m1", groupId: "broadleaf_tree" }, { tilesChanged: 32 }, "활엽수 16개", { placed: 16 }),
      proposed("upsert_world_entities", {}, { worldEntitiesAdded: 1 }, "세계관 추가 1"),
    ];

    expect(proposalHumanSummaryLine(calls)).toBe("집 2 · 길 33 · 나무 16 · 세계관 1");
    expect(proposalSummaryLines(calls, ["⚠ 미이행: 길 영역 미변경"]).at(-1)).toBe("⚠ 미이행: 길 영역 미변경");
  });

  it("타일과 이벤트 변경을 전후 썸네일 crop에 포함한다", () => {
    const before = createBlankProject();
    const after = structuredClone(before);
    const mapId = before.startMapId;
    const map = after.maps[mapId];
    map.lowerTiles[4 * map.width + 7] = TILE.PATH;
    map.events.push({ id: "ev1", x: 12, y: 9, trigger: { kind: "action" }, commands: [] } as never);

    const crop = computeMapTileChangeBounds(before, after, mapId);
    expect(crop).not.toBeNull();
    expect(crop!.x).toBeLessThanOrEqual(7);
    expect(crop!.x + crop!.w).toBeGreaterThan(12);
  });

  it("원본에 없는 맵은 새 맵 썸네일을 렌더한다", () => {
    const project = createBlankProject();
    const thumbnail = renderProposalMapThumbnail(project, "missing-map", "after", null);
    expect(thumbnail.getAttribute("data-testid")).toBe("ai-proposal-thumb-new-map");
  });
});

describe("AI 변경 즉시 적용", () => {
  it.each(["remove_event", "reset_project"])(
    "%s가 포함된 턴은 확인 없이 바로 적용한다",
    async (toolName) => {
      const after = structuredClone(store.getCurrent());
      after.meta.title = `applied:${toolName}`;
      const calls = [{
        ...proposed(toolName, {}, { systemChanged: true }, `${toolName} 적용`),
        destructive: true,
      }];
      vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn(calls));
      vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => structuredClone(after));

      const panel = renderPanel();
      const input = findByTestId(panel, "ai-input") as FakeElement;
      input.value = `${toolName} 실행`;
      await completeChatTurn(() => findByTestId(panel, "ai-send")?.click());
      const root = document.body as unknown as Parameters<typeof findByTestId>[0];
      expect(findByTestId(root, "app-confirm-modal"), "확인 모달이 뜨면 안 된다").toBeNull();

      expect(store.getCurrent().meta.title).toBe(`applied:${toolName}`);
      expect(findByTestId(panel, "ai-msg-badge-applied")?.textContent).toBe("적용됨");
      for (const testId of [
        "ai-proposal-card",
        "ai-proposal-host",
        "ai-proposal-pin-host",
        "ai-proposal-modal",
        "ai-proposal-reopen",
        "ai-proposal-accept",
        "ai-proposal-reject",
        "ai-proposal-auto-approve-input",
      ]) {
        expect(findByTestId(panel, testId), testId).toBeNull();
      }
    },
  );

  it("승인 메타데이터만 있는 재료 제안은 확인 없이 적용한다", async () => {
    const after = structuredClone(store.getCurrent());
    after.meta.title = "applied:propose_tile_vocabulary";
    const calls = [{
      ...proposed("propose_tile_vocabulary", {}, { systemChanged: true }, "재료 합의"),
      destructive: false,
      requiresApproval: true,
      approvalWarning: "재료 합의",
    }];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn(calls));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => structuredClone(after));

    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "재료 합의 실행";
    await completeChatTurn(() => findByTestId(panel, "ai-send")?.click());

    const root = document.body as unknown as Parameters<typeof findByTestId>[0];
    expect(findByTestId(root, "app-confirm-modal"), "승인 메타데이터만으로 확인 모달이 뜨면 안 된다").toBeNull();
    expect(store.getCurrent().meta.title).toBe("applied:propose_tile_vocabulary");
  });

  it("안전 분류 불통과와 완성도 경고도 적용을 막지 않는다", async () => {
    const baseline = store.getCurrent();
    const mapId = baseline.startMapId;
    const ctx: ToolContext = { project: structuredClone(baseline) };
    const calls = [
      runProposed(ctx, "paint_tiles", { mapId, layer: "lower", mode: "cells", tile: TILE.PATH, cells: [{ x: 2, y: 2 }] }),
      proposed("place_npc", { mapId, x: 1, y: 1 }, { eventsAdded: 1 }, "NPC 1명"),
    ];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn(calls, "NPC 1명과 길 1칸을 놓았습니다."));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => structuredClone(ctx.project));

    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "여기 NPC 3명 넣고 길 깔아줘";
    await completeChatTurn(() => findByTestId(panel, "ai-send")?.click());

    const map = store.getCurrent().maps[mapId];
    expect(map.lowerTiles[2 * map.width + 2]).toBe(TILE.PATH);
    expect(findByTestId(panel, "ai-proposal-card")).toBeNull();
    expect(findByTestId(panel, "ai-change-card")).toBeTruthy();
    expect(findByTestId(panel, "ai-change-undo")).toBeTruthy();
    expect(findByTestId(panel, "ai-chat-log")?.textContent).toContain("요청 수량 3개");
  });

  it("한 번의 되돌리기로 턴 전 전체 프로젝트를 복구한다", async () => {
    const baseline = store.getCurrent();
    const mapId = baseline.startMapId;
    const ctx: ToolContext = { project: structuredClone(baseline) };
    const calls = [runProposed(ctx, "paint_tiles", {
      mapId,
      layer: "lower",
      mode: "cells",
      tile: TILE.PATH,
      cells: [{ x: 2, y: 2 }],
    })];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn(calls));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => structuredClone(ctx.project));

    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "길 한 칸";
    await completeChatTurn(() => findByTestId(panel, "ai-send")?.click());
    expect(store.getCurrent().maps[mapId].lowerTiles[2 * store.getCurrent().maps[mapId].width + 2]).toBe(TILE.PATH);

    findByTestId(panel, "ai-undo-last")?.click();
    expect(store.getCurrent().maps[mapId].lowerTiles[2 * store.getCurrent().maps[mapId].width + 2]).toBe(TILE.GRASS);
    expect(findByTestId(panel, "ai-msg-badge-reverted")?.textContent).toBe("되돌려짐");
  });
});
