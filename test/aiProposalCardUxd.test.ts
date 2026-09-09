import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProposedCall } from "@/ai/assistantSession";
import type { JsonValue } from "@/ai/jobs/contracts";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { clearAgentGhostPreview } from "@/editor/agentGhostPreview";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import {
  proposalHumanSummaryLine,
  proposalSummaryLines,
  renderAiChatPanel,
  teardownAiChatPanel,
} from "@/editor/panels/aiChatPanel";
import { computeMapTileChangeBounds, renderProposalMapThumbnail } from "@/editor/panels/aiProposalCard";
import { runTool, type ToolContext, type ToolResult } from "@/editor/tools";
import type { ChangeSummary } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { installAdmitClient } from "./aiJobAdmitSupport";
import { IDBFactory } from "fake-indexeddb";
import { locks } from "node:worker_threads";

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

/**
 * 변경 카드가 붙을 때까지 기다린다 — 자기 시계(setTimeout deadline)를 두지 않는다.
 * 이 파일의 큐 경로 한 벌은 IndexedDB 반영까지 수 초가 걸려서, 임의의 벽시계 마감은
 * 부하에 따라 통과 여부가 갈리는 「타이밍 운」이 된다. 한계는 vitest 의 테스트 시한이 쥔다.
 */
function whenChangeCard(panel: FakeElement): Promise<void> {
  if (findByTestId(panel, "ai-change-card")) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const observer = new MutationObserver(() => {
      if (!findByTestId(panel, "ai-change-card")) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(panel as unknown as Node, { subtree: true, childList: true, attributes: true, characterData: true });
  });
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

afterEach(() => {
  // 마운트된 패널을 살려두면 늦게 도착한 작업 구독이 DOM 해제 뒤에 실행된다.
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
  /**
   * 큐 경로의 자동 적용 한 벌 — 접수 → 결과(payload + 생성 스냅샷) → 자동 반영.
   * 적용 식별자는 meta.title 이다 — 생성 스냅샷만 그 제목을 달고 있다.
   */
  async function autoAdmit(
    title: string,
    payload: Record<string, JsonValue> = {},
    options: {
      /** 사용자 발화 — 완성도 린트가 「얼마를 요구했는가」를 이것으로 본다(기본: title). */
      readonly instruction?: string;
      /** 작업이 만들어 돌려주는 프로젝트 — 이것이 스토어에 반영된다. */
      readonly mutate?: (project: Project) => void;
      /** 반영 뒤 변경 카드가 붙을 때까지 기다린다(카드는 적용이 끝난 다음에 붙는다). */
      readonly awaitChangeCard?: boolean;
    } = {},
  ) {
    vi.stubGlobal("indexedDB", new IDBFactory());
    vi.stubGlobal("navigator", { locks });
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: "load-failed" });
    await store.loadFallbackProject(createBlankProject());
    editorState.set({ currentMapId: store.getCurrent().startMapId, selection: null });
    storage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
      ...defaultAiConfig(),
      apiKey: "sk-test",
      authMode: "apiKey",
      baseUrl: "https://example.test/v1",
      model: "m",
      agentMode: "auto",
    }));
    const harness = installAdmitClient({ reconcile: true });
    const panel = renderAiChatPanel({ clock: () => 1_000 }) as unknown as FakeElement;
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = options.instruction ?? title;
    const pending = harness.nextAdmitted();
    findByTestId(panel, "ai-send")?.click();
    const admitted = await pending;
    expect(admitted.input.mode).toBe("auto");
    const generated = structuredClone(store.getCurrent());
    generated.meta.title = title;
    options.mutate?.(generated);
    const applied = new Promise<void>((resolve, reject) => {
      const off = store.subscribe(() => {
        if (store.getCurrent().meta.title === title) { off(); resolve(); }
      });
      setTimeout(() => { off(); reject(new Error("auto apply did not land")); }, 5000);
    });
    const carded = options.awaitChangeCard ? whenChangeCard(panel) : null;
    await harness.complete({ assistantText: "적용했습니다.", proposedCalls: [], stoppedReason: "final", ...payload }, undefined, generated);
    await applied;
    if (carded) await carded;
    return panel;
  }

  it.each(["applied:remove_event", "applied:reset_project"])(
    "%s 자동 작업은 확인 없이 바로 적용한다",
    async (title) => {
      const panel = await autoAdmit(title);
      const root = document.body as unknown as Parameters<typeof findByTestId>[0];
      expect(findByTestId(root, "app-confirm-modal"), "확인 모달이 뜨면 안 된다").toBeNull();
      expect(store.getCurrent().meta.title).toBe(title);
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

  // 승인 메타데이터(requiresApproval/approvalWarning)는 **자동 모드의 적용을 막지 않는다.**
  // 큐 경로에서도 같아야 한다: 결과 payload 가 승인 경고를 달고 와도 확인 모달 없이 적용된다.
  it("승인 메타데이터만 있는 재료 제안은 확인 없이 적용한다", async () => {
    const title = "applied:propose_tile_vocabulary";
    const panel = await autoAdmit(title, {
      proposedCalls: [{
        ...proposed("propose_tile_vocabulary", {}, { systemChanged: true }, "재료 합의"),
        requiresApproval: true,
        approvalWarning: "재료 합의",
      }] as unknown as JsonValue,
    });
    const root = document.body as unknown as Parameters<typeof findByTestId>[0];
    expect(findByTestId(root, "app-confirm-modal"), "승인 메타데이터만으로 확인 모달이 뜨면 안 된다").toBeNull();
    expect(store.getCurrent().meta.title).toBe(title);
    expect(findByTestId(panel, "ai-proposal-card"), "자동 적용에는 검토 카드가 없다").toBeNull();
  });

  // 큐 경로도 같은 계약을 지킨다: 안전 분류/완성도 경고는 **정보**다 — 적용을 막지 않고,
  // 적용된 변경은 변경 카드 한 장 + 되돌리기로 사용자에게 남는다.
  it("안전 분류 불통과와 완성도 경고도 적용을 막지 않는다", async () => {
    const mapId = store.getCurrent().startMapId;
    const ctx: ToolContext = { project: structuredClone(store.getCurrent()) };
    const calls = [
      runProposed(ctx, "paint_tiles", { mapId, layer: "lower", mode: "cells", tile: TILE.PATH, cells: [{ x: 2, y: 2 }] }),
      proposed("place_npc", { mapId, x: 1, y: 1 }, { eventsAdded: 1 }, "NPC 1명"),
    ];
    const panel = await autoAdmit(
      "applied:npc_and_road",
      {
        proposedCalls: JSON.parse(JSON.stringify(calls)) as JsonValue,
        assistantText: "NPC 1명과 길 1칸을 놓았습니다.",
      },
      {
        instruction: "여기 NPC 3명 넣고 길 깔아줘",
        mutate: (project) => {
          const map = project.maps[mapId]!;
          map.lowerTiles[2 * map.width + 2] = TILE.PATH;
        },
        awaitChangeCard: true,
      },
    );

    const map = store.getCurrent().maps[mapId]!;
    expect(map.lowerTiles[2 * map.width + 2]).toBe(TILE.PATH);
    expect(findByTestId(panel, "ai-proposal-card"), "자동 적용에는 검토 카드가 없다").toBeNull();
    expect(findByTestId(panel, "ai-change-card"), "적용된 변경은 카드 한 장으로 보인다").toBeTruthy();
    expect(findByTestId(panel, "ai-change-undo"), "카드에는 되돌리기가 있다").toBeTruthy();
    expect(findByTestId(panel, "ai-chat-log")?.textContent).toContain("요청 수량 3개");
  });

  it("한 번의 되돌리기로 턴 전 전체 프로젝트를 복구한다", async () => {
    const mapId = store.getCurrent().startMapId;
    const ctx: ToolContext = { project: structuredClone(store.getCurrent()) };
    const calls = [runProposed(ctx, "paint_tiles", {
      mapId,
      layer: "lower",
      mode: "cells",
      tile: TILE.PATH,
      cells: [{ x: 2, y: 2 }],
    })];
    const panel = await autoAdmit(
      "applied:one_road_cell",
      { proposedCalls: JSON.parse(JSON.stringify(calls)) as JsonValue },
      {
        instruction: "길 한 칸",
        mutate: (project) => {
          const map = project.maps[mapId]!;
          map.lowerTiles[2 * map.width + 2] = TILE.PATH;
        },
        awaitChangeCard: true,
      },
    );
    const painted = store.getCurrent().maps[mapId]!;
    expect(painted.lowerTiles[2 * painted.width + 2]).toBe(TILE.PATH);

    findByTestId(panel, "ai-undo-last")?.click();
    const reverted = store.getCurrent().maps[mapId]!;
    expect(reverted.lowerTiles[2 * reverted.width + 2]).toBe(TILE.GRASS);
    expect(findByTestId(panel, "ai-msg-badge-reverted")?.textContent).toBe("되돌려짐");
  });
});
