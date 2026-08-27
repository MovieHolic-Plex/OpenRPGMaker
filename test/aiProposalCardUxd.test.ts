import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type ProposedCall, type TurnResult } from "@/ai/assistantSession";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig, type AiConfig } from "@/ai/llmClient";
import {
  enforceProposalDependencies,
  proposalDecisionTitle,
  proposalDependencyIndexes,
  proposalDetailsToggleLabel,
  proposalHasMapTileChanges,
  proposalHumanSummaryLine,
  proposalPreviewMapId,
  proposalSummaryLines,
  proposalTechnicalDetailLines,
  reassembleSelectedProposalProject,
  renderAiChatPanel,
} from "@/editor/panels/aiChatPanel";
import { resolveProposalPresentation } from "@/editor/panels/aiProposalModal";
import {
  agentGhostPreviewsForMap,
  clearAgentGhostPreview,
  getAgentGhostPreviewState,
  hasAgentGhostPreviewSubscribers,
  replaceAgentGhostPreviewFromProjectDiff,
  subscribeAgentGhostPreview,
} from "@/editor/agentGhostPreview";
import { classifyProposalSafety } from "@/editor/proposalSafety";
import type { ChatDock } from "@/editor/chatDock";
import { readableTopbarIdentityLabel, renderTopbar } from "@/editor/panels/menu";
import { editorState } from "@/editor/editorState";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { runTool, type ToolContext, type ToolResult } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
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
    },
  });
  Object.defineProperty(document, "addEventListener", { configurable: true, value: vi.fn() });
  Object.defineProperty(document, "removeEventListener", { configurable: true, value: vi.fn() });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, writable: true, value: null });
  Object.defineProperty(document, "documentElement", { configurable: true, value: document.createElement("html") });
}

function fakeElement(node: HTMLElement | null): FakeElement {
  if (node instanceof FakeElement) return node;
  throw new Error("Expected fake element");
}

/** 검토 카드 경로: 자동 적용을 명시적으로 끈 설정. 기본값은 즉시 적용이다. */
const REVIEW_MODE: Partial<AiConfig> = { agentMode: "chat", autoApprove: false };

function renderPanel(dock: ChatDock = "side", config: Partial<AiConfig> = {}): FakeElement {
  storage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), apiKey: "sk-test", baseUrl: "x", model: "m", ...config }));
  return renderAiChatPanel({ clock: () => 1_000, getChatDock: () => dock }) as unknown as FakeElement;
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
  // todo 4: 카드 수락이 공유 적용 함수(applyProposedProject)를 await하므로 실제 Supabase를
  // 건드리지 않도록 env를 빈 값(미설정)으로 덮는다 — recordProjectCommit이 sha256/네트워크 없이
  // 즉시 not-configured로 resolve되어 flushAsync(마이크로태스크) 안에서 결정적으로 완료된다.
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
  clearAgentGhostPreview();
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "window");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("UXD proposal summary helpers", () => {
  it("집·길·나무·세계관을 사람 언어 요약으로 집계한다", () => {
    const calls = [
      proposed("build_house", { mapId: "m1" }, { tilesChanged: 40 }, "집 A"),
      proposed("build_house_kit", { mapId: "m1" }, { tilesChanged: 50 }, "집 B"),
      proposed("paint_road", { mapId: "m1" }, { tilesChanged: 33 }, "마을에 dirt 도로 33칸 — 자연도 보통"),
      proposed("scatter_object", { mapId: "m1", groupId: "broadleaf_tree" }, { tilesChanged: 32 }, "활엽수 16개", { placed: 16 }),
      proposed("upsert_world_entities", {}, { worldEntitiesAdded: 1 }, "세계관 추가 1"),
    ];

    expect(proposalHumanSummaryLine(calls)).toBe("집 2 · 길 33 · 나무 16 · 세계관 1");
  });

  it("샷 08/10처럼 결정 요약은 짧은 명사 목록이다", () => {
    const calls = [
      proposed("author_house", {
        kind: "lots",
        mapId: "m1",
        houses: [
          { kitId: "amber-wood", yard: ["mailbox"] },
          { kitId: "bright-plaster", yard: ["flowers"] },
          { kitId: "blue-stone", yard: ["pot"] },
        ],
      }, { tilesChanged: 120 }, "오두막 세 채"),
      proposed("fill_region", { mapId: "m1", material: "물" }, { tilesChanged: 48 }, "강"),
    ];

    expect(proposalHumanSummaryLine(calls)).toBe("집 3 · 강 · 앞마당");
    expect(proposalHumanSummaryLine(calls)).not.toMatch(/채|칸|그루|건|fill_region|author_house|build_/u);
    expect(proposalHumanSummaryLine([
      proposed("paint_tiles", { mapId: "m1", tile: TILE.WATER }, { tilesChanged: 48 }, "수역"),
    ])).toBe("강");
    expect(proposalHumanSummaryLine([
      proposed("build_house_kit", { mapId: "m1", fence: true }, { tilesChanged: 40 }, "집"),
    ])).toBe("집 1 · 앞마당");
    expect(proposalHumanSummaryLine([
      proposed("paint_tiles", { mapId: "m1" }, { tilesChanged: 4 }, "타일 4칸"),
    ])).toBe("타일 4");
    expect(proposalHumanSummaryLine([
      proposed("upsert_world_entities", {}, { worldEntitiesAdded: 1 }, "세계관 1건"),
    ])).toBe("세계관 1");
    expect(proposalHumanSummaryLine([
      proposed("upsert_palette_preset", {}, { palettePresetsAdded: 2 }, "프리셋 2건"),
    ])).toBe("프리셋 2");
    expect(proposalHumanSummaryLine([
      proposed("paint_tiles", { mapId: "m1" }, { tilesChanged: 4 }, "타일 4칸"),
    ])).not.toMatch(/칸|건|채|그루/u);
  });

  it("세계관 추가와 수정이 함께 있으면 추가/수정 수를 보존한다", () => {
    const calls = [proposed("upsert_world_entities", {}, { worldEntitiesAdded: 1, worldEntitiesModified: 1 }, "세계관 추가 1/수정 1")];

    expect(proposalSummaryLines(calls)[0]).toContain("세계관 추가 1/수정 1");
  });

  it("완성도 경고는 사람 요약 뒤에 붙인다", () => {
    const calls = [proposed("build_house", { mapId: "m1" }, { tilesChanged: 12 }, "집")];

    expect(proposalSummaryLines(calls, ["⚠ 미이행: 길 영역 미변경"])).toEqual(["집 1", "⚠ 미이행: 길 영역 미변경"]);
  });

  it("기술 상세 라인은 원시 도구명을 별도로 유지한다", () => {
    const calls = [proposed("paint_road", { mapId: "m1" }, { tilesChanged: 3 }, "도로 3칸")];

    expect(proposalHumanSummaryLine(calls)).not.toContain("paint_road");
    expect(proposalTechnicalDetailLines(calls)[0]).toContain("paint_road — 도로 3칸");
  });

  it("결정 카드는 도크 인라인이고 캔버스 우선만 모달을 연다", () => {
    expect(resolveProposalPresentation("modal", "glass")).toBe("inline");
    expect(resolveProposalPresentation("modal", "side")).toBe("inline");
    expect(resolveProposalPresentation("modal", "float")).toBe("inline");
    expect(resolveProposalPresentation("canvas", "glass")).toBe("inline");
    expect(resolveProposalPresentation("canvas", "side")).toBe("inline");
    expect(resolveProposalPresentation("canvas", "float")).toBe("inline");
    expect(resolveProposalPresentation("inline", "float")).toBe("inline");
    expect(resolveProposalPresentation("canvas", "glass", true)).toBe("canvas");
  });

  it("결정 제목은 짧은 명사구를 쓰고 채팅체·툴 id는 버린다", () => {
    const calls = [
      proposed("build_house_kit", { mapId: "m1" }, { tilesChanged: 40 }, "집 A"),
      proposed("build_house_kit", { mapId: "m1" }, { tilesChanged: 40 }, "집 B"),
      proposed("build_house_kit", { mapId: "m1" }, { tilesChanged: 40 }, "집 C"),
    ];

    expect(proposalDecisionTitle(calls, "강가 오두막 3채")).toBe("강가 오두막 3채");
    expect(proposalDecisionTitle(calls, "길 초안을 제안합니다.")).toBe("집 3");
    expect(proposalDecisionTitle(calls, "build_house_kit 3")).toBe("집 3");
    expect(proposalDetailsToggleLabel(3)).toBe("3개 항목 · 자세히");
  });

  it("타일 변경이 있는 제안만 미니맵 후보를 가진다", () => {
    const before = createBlankProject();
    const after = structuredClone(before);
    const mapId = before.startMapId;
    const tileCall = proposed("paint_tiles", { mapId }, { tilesChanged: 1 }, "타일 1칸");
    const worldCall = proposed("upsert_world_entities", {}, { worldEntitiesAdded: 1 }, "세계관 1건");

    expect(proposalHasMapTileChanges([tileCall])).toBe(true);
    expect(proposalPreviewMapId([tileCall], before, after)).toBe(mapId);
    expect(proposalHasMapTileChanges([worldCall])).toBe(false);
    expect(proposalPreviewMapId([worldCall], before, after)).toBeNull();
  });

  it("author_house 타일 차이는 도구 화이트리스트 밖이어도 미니맵 후보가 된다", () => {
    const before = createBlankProject();
    const after = structuredClone(before);
    const mapId = before.startMapId;
    const map = after.maps[mapId];
    if (map) map.lowerTiles[map.width * 4 + 7] = TILE.PATH;
    const houseCall = proposed("author_house", { mapId, kind: "single" }, { tilesChanged: 24 }, "집 1");

    expect(proposalPreviewMapId([houseCall], before, after)).toBe(mapId);
    expect(proposalPreviewMapId([houseCall], before, before)).toBe(mapId);
  });

  it("새 맵 위의 후속 페인트는 create_map에 의존한다", () => {
    const calls = [
      proposed("create_map", { id: "map_new", name: "새 맵", width: 8, height: 8 }, { mapsAdded: 1 }, "맵 생성", { mapId: "map_new" }),
      proposed("paint_tiles", { mapId: "map_new", layer: "lower", mode: "rect", tile: TILE.PATH }, { tilesChanged: 2 }, "새 맵에 페인트"),
    ];

    expect(proposalDependencyIndexes(calls)).toEqual([[], [0]]);
  });

  it("의존 항목이 해제되면 하위 항목도 함께 해제된다", () => {
    const dependencies = [[], [0], [1]];

    expect(enforceProposalDependencies([false, true, true], dependencies)).toEqual([false, false, false]);
  });

  it("부분 수락 재조립은 선택된 호출만 baseline 위에 적용한다", () => {
    const baseline = createBlankProject();
    const mapId = baseline.startMapId;
    const ctx: ToolContext = { project: structuredClone(baseline) };
    const calls = [
      runProposed(ctx, "paint_tiles", { mapId, layer: "lower", mode: "cells", tile: TILE.PATH, cells: [{ x: 2, y: 2 }] }),
      runProposed(ctx, "paint_tiles", { mapId, layer: "lower", mode: "cells", tile: TILE.WATER, cells: [{ x: 3, y: 2 }] }),
    ];

    const reassembled = reassembleSelectedProposalProject(baseline, calls, [true, false]);
    if (!reassembled.ok) throw new Error(reassembled.message);
    const map = reassembled.project.maps[mapId];
    expect(map.lowerTiles[2 * map.width + 2]).toBe(TILE.PATH);
    expect(map.lowerTiles[2 * map.width + 3]).toBe(TILE.GRASS);
  });

  it("부분 수락 안전 규칙은 create_map이 빠진 새 맵 작업을 제외한다", () => {
    const baseline = createBlankProject();
    const ctx: ToolContext = { project: structuredClone(baseline) };
    const calls = [
      runProposed(ctx, "create_map", { id: "map_new", name: "새 맵", width: 8, height: 8 }),
      runProposed(ctx, "paint_tiles", { mapId: "map_new", layer: "lower", mode: "cells", tile: TILE.PATH, cells: [{ x: 2, y: 2 }] }),
    ];

    const reassembled = reassembleSelectedProposalProject(baseline, calls, [false, true]);
    if (!reassembled.ok) throw new Error(reassembled.message);
    expect(reassembled.calls).toHaveLength(0);
    expect(reassembled.project.maps.map_new).toBeUndefined();
  });
});

describe("UXD proposal panel integration", () => {
  it("결정 카드 앞면은 한 문장·전후·넣기/취소이고 체크·경고·툴 이름은 자세히에 접힌다", async () => {
    const mapId = store.getCurrent().startMapId;
    const calls = [
      proposed("build_house_kit", { mapId }, { tilesChanged: 40 }, "오두막 A"),
      proposed("paint_road", { mapId }, { tilesChanged: 12 }, "길 12칸"),
      { ...proposed("place_npc", { mapId, x: 1, y: 1 }, { eventsAdded: 1 }, "NPC 1명"), approvalWarning: "🔒 재료 합의 제안" },
    ];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn({ assistantText: "강가 오두막 3채", proposedCalls: calls }));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => store.getCurrent());
    const panel = renderPanel("side", REVIEW_MODE);
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "강가에 오두막 세 채";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    const card = findByTestId(panel, "ai-proposal-card") as FakeElement;
    const details = findByTestId(card, "ai-proposal-details") as FakeElement;
    const frontText = card.children
      .filter((child) => !child.classList.contains("ai-proposal-details"))
      .map((child) => child.textContent)
      .join("");

    expect(findByTestId(card, "ai-proposal-title")?.textContent).toBe("강가 오두막 3채");
    expect(findByTestId(card, "ai-proposal-summary")?.textContent).toContain("집");
    expect(findByTestId(card, "ai-proposal-accept")?.textContent).toBe("이 맵에 넣기");
    expect(findByTestId(card, "ai-proposal-reject")?.textContent).toBe("취소");
    expect(findByTestId(card, "ai-proposal-details-toggle")?.textContent).toBe("3개 항목 · 자세히");
    expect(details.getAttribute("open")).toBeNull();
    expect(details.contains(findByTestId(card, "ai-proposal-item-1"))).toBe(true);
    expect(details.contains(findByTestId(card, "ai-proposal-item-2"))).toBe(true);
    expect(details.contains(findByTestId(card, "ai-proposal-item-3"))).toBe(true);
    expect(details.contains(findByTestId(card, "ai-proposal-warning"))).toBe(true);
    expect(details.contains(findByTestId(card, "ai-proposal-technical-lines"))).toBe(true);
    expect(details.textContent).toContain("오두막 A");
    expect(details.textContent).toMatch(/paint_road|작업/);
    expect(frontText).not.toContain("paint_road");
    expect(frontText).not.toContain("build_house_kit");
    expect(frontText).not.toContain("place_npc");
    expect(frontText).not.toContain("오두막 A");
    expect(frontText).not.toContain("길 그리기");
    expect(frontText).not.toContain("🔒");
    expect(frontText).not.toContain("기술 상세");
    expect(findByTestId(card, "ai-proposal-accept-materials")).toBeNull();
  });

  it("제안 카드에 요약, 미니맵, 항목 체크박스, 제안 배지를 렌더한다", async () => {
    const baseline = store.getCurrent();
    const mapId = baseline.startMapId;
    const ctx: ToolContext = { project: structuredClone(baseline) };
    const calls = [runProposed(ctx, "paint_tiles", { mapId, layer: "lower", mode: "cells", tile: TILE.PATH, cells: [{ x: 2, y: 2 }] })];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn({ assistantText: "길 초안을 제안합니다.", proposedCalls: calls }));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => structuredClone(ctx.project));
    const panel = renderPanel("side", REVIEW_MODE);
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "길 깔아줘";

    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    expect(findByTestId(panel, "ai-proposal-summary")?.textContent).toContain("타일 1");
    expect(findByTestId(panel, "ai-proposal-summary")?.textContent).not.toMatch(/칸|건/u);
    expect(findByTestId(panel, "ai-proposal-thumb-before")).toBeTruthy();
    expect(findByTestId(panel, "ai-proposal-thumb-after")).toBeTruthy();
    expect(findByTestId(panel, "ai-proposal-item-1")).toBeTruthy();
    expect(findByTestId(panel, "ai-msg-badge-proposal")?.textContent).toBe("제안");
    expect(findByTestId(panel, "ai-proposal-details")?.contains(findByTestId(panel, "ai-proposal-item-1"))).toBe(true);
  });

  it("사이드 워크 로그는 idle 페이드로 숨기지 않고 제안 카드는 남는다", async () => {
    const mapId = store.getCurrent().startMapId;
    const calls = [proposed("paint_tiles", { mapId }, { tilesChanged: 1 }, "타일 1칸")];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn({ assistantText: "초안입니다.", proposedCalls: calls }));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => store.getCurrent());
    const panel = renderPanel("side", REVIEW_MODE);
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "초안";

    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    expect(findByTestId(panel, "ai-rising-overlay")).toBeTruthy();
    expect(findByTestId(panel, "ai-rising-volatile-zone")?.className).not.toContain("is-faded");
    expect(findByTestId(panel, "ai-rising-volatile-zone")?.hidden).toBe(false);
    expect(findByTestId(panel, "ai-proposal-accept")).toBeTruthy();
    expect(findByTestId(panel, "ai-proposal-accept")?.textContent).toBe("이 맵에 넣기");
    expect(findByTestId(panel, "ai-proposal-host")?.textContent).toContain("자세히");
  });

  it("사이드 도크는 몰입 모달 없이 결정 카드를 패널에 붙인다", async () => {
    const mapId = store.getCurrent().startMapId;
    const calls = [proposed("paint_tiles", { mapId }, { tilesChanged: 1 }, "타일 1칸")];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn({ assistantText: "초안입니다.", proposedCalls: calls }));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => store.getCurrent());
    const panel = renderPanel("side", REVIEW_MODE);
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "초안";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    const modal = findByTestId(panel, "ai-proposal-modal") as FakeElement;
    const card = findByTestId(panel, "ai-proposal-card") as FakeElement;
    const pinHost = findByTestId(panel, "ai-proposal-pin-host") as FakeElement;
    expect(modal.hidden).toBe(true);
    expect(findByTestId(panel, "ai-proposal-pin")).toBeNull();
    expect(pinHost.contains(card)).toBe(true);
    expect(findByTestId(card, "ai-proposal-accept")?.textContent).toBe("이 맵에 넣기");
    expect(findByTestId(card, "ai-proposal-details")?.getAttribute("open")).toBeNull();
  });

  it("플로트 도크도 몰입 모달 없이 결정 카드를 패널에 붙인다", async () => {
    const mapId = store.getCurrent().startMapId;
    const calls = [proposed("paint_tiles", { mapId }, { tilesChanged: 1 }, "타일 1칸")];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn({ assistantText: "초안입니다.", proposedCalls: calls }));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => store.getCurrent());
    const panel = renderPanel("float", REVIEW_MODE);
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "초안";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    const modal = findByTestId(panel, "ai-proposal-modal") as FakeElement;
    const card = findByTestId(panel, "ai-proposal-card") as FakeElement;
    expect(modal.hidden).toBe(true);
    expect(findByTestId(panel, "ai-proposal-pin")).toBeNull();
    expect(findByTestId(panel, "ai-proposal-pin-host")?.contains(card)).toBe(true);
    expect(findByTestId(card, "ai-proposal-accept")?.textContent).toBe("이 맵에 넣기");
  });

  it("플로트는 캔버스 우선이어도 오버레이 pill 없이 결정 카드를 붙인다", async () => {
    const before = store.getCurrent();
    const mapId = before.startMapId;
    const after = structuredClone(before);
    after.maps[mapId].lowerTiles[2 * after.maps[mapId].width + 2] = TILE.PATH;
    const calls = [proposed("paint_tiles", { mapId }, { tilesChanged: 1 }, "타일 1칸")];
    expect(classifyProposalSafety({ calls, before, after, currentMapId: mapId }).safe).toBe(true);

    const unsub = subscribeAgentGhostPreview(() => undefined);
    replaceAgentGhostPreviewFromProjectDiff(before, after);
    expect(hasAgentGhostPreviewSubscribers()).toBe(true);
    expect(agentGhostPreviewsForMap(getAgentGhostPreviewState(), mapId).length).toBeGreaterThan(0);

    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(
      turn({ assistantText: "초안입니다.", proposedCalls: calls, stoppedReason: "error" }),
    );
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => after);
    editorState.set({ currentMapId: mapId, selection: null });
    try {
      const panel = renderPanel("float", REVIEW_MODE);
      const input = findByTestId(panel, "ai-input") as FakeElement;
      input.value = "초안";
      findByTestId(panel, "ai-send")?.click();
      await flushAsync();

      const card = findByTestId(panel, "ai-proposal-card") as FakeElement;
      expect(findByTestId(panel, "ai-rising-overlay")).toBeNull();
      const reopen = findByTestId(panel, "ai-proposal-reopen");
      expect(reopen == null || reopen.hidden === true || (reopen as { attrs?: { hidden?: string } }).attrs?.hidden !== undefined).toBe(true);
      expect(findByTestId(panel, "ai-proposal-modal")?.hidden).toBe(true);
      expect(findByTestId(panel, "ai-proposal-pin")).toBeNull();
      expect(findByTestId(panel, "ai-proposal-pin-host")?.contains(card)).toBe(true);
      expect(findByTestId(card, "ai-proposal-accept")?.textContent).toBe("이 맵에 넣기");
      expect(panel.textContent ?? "").not.toContain("전체 검토");
    } finally {
      unsub();
      clearAgentGhostPreview();
    }
  });

  it("후속 채팅 턴(제안 0건)이 와도 대기 중인 변경 제안 카드 본문을 지우지 않는다", async () => {
    const mapId = store.getCurrent().startMapId;
    const calls = [
      proposed("paint_tiles", { mapId }, { tilesChanged: 2 }, "타일 2칸"),
      proposed("place_npc", { mapId, x: 1, y: 1 }, { eventsAdded: 1 }, "NPC 1명"),
    ];
    const sendSpy = vi.spyOn(AssistantSession.prototype, "sendUserMessage");
    sendSpy
      .mockResolvedValueOnce(turn({ assistantText: "초안입니다.", proposedCalls: calls }))
      .mockResolvedValueOnce(turn({ assistantText: "추가로 설명만 할게요.", proposedCalls: [] }));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => store.getCurrent());
    const panel = renderPanel("side", REVIEW_MODE);
    const input = findByTestId(panel, "ai-input") as FakeElement;

    input.value = "맵 고쳐줘";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    const modal = findByTestId(panel, "ai-proposal-modal") as FakeElement;
    const card = findByTestId(panel, "ai-proposal-card") as FakeElement;
    expect(modal.hidden).toBe(true);
    expect(findByTestId(panel, "ai-proposal-modal-count")?.textContent).toBe("2건");
    expect(findByTestId(card, "ai-proposal-accept")).toBeTruthy();
    expect(findByTestId(card, "ai-proposal-item-1")).toBeTruthy();
    expect(findByTestId(card, "ai-proposal-item-2")).toBeTruthy();

    // 제안 대기 중 후속 질문(쓰기 툴 없음) — 예전 버그는 host를 비우고 헤더(2건)만 남김.
    input.value = "왜 이렇게 했어?";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    expect(modal.hidden).toBe(true);
    expect(findByTestId(panel, "ai-proposal-modal-count")?.textContent).toBe("2건");
    expect(findByTestId(panel, "ai-proposal-accept")).toBeTruthy();
    // testid는 체크박스에 붙으므로 본문 문구는 host 텍스트로 확인한다.
    const summary = findByTestId(panel, "ai-proposal-summary")?.textContent ?? "";
    expect(summary).toContain("타일 2");
    expect(summary).toContain("NPC 1");
    expect(summary).not.toMatch(/칸|건|명/u);
    const hostText = findByTestId(panel, "ai-proposal-host")?.textContent ?? "";
    expect(hostText).toContain("NPC 1명");
    expect(findByTestId(panel, "ai-proposal-item-1")).toBeTruthy();
    expect(findByTestId(panel, "ai-proposal-item-2")).toBeTruthy();
  });

  it("미니 스트림: 새 턴이 시작되면 이전 턴을 접이식 그룹으로 묶는다", async () => {
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn({ assistantText: "첫 응답." }));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => store.getCurrent());
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as FakeElement;

    input.value = "첫 요청";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();
    input.value = "두번째 요청";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    const log = findByTestId(panel, "ai-chat-log") as FakeElement;
    const priorGroup = findByTestId(log, "ai-turn-group");
    expect(priorGroup).toBeTruthy();
    expect(priorGroup?.className).toContain("is-prior-turn");
    expect(priorGroup?.className).toContain("is-collapsed");
    expect(findByTestId(log, "ai-day-divider")).toBeTruthy();
    // 현재 턴 버블은 prior-turn이 아니다.
    const commandRows = [...(log.querySelectorAll?.("[data-testid=ai-command-row]") ?? [])];
    const currentUser = commandRows.filter((node) => (node as FakeElement).dataset.role === "user").at(-1)
      ?? log.childNodes[log.childNodes.length - 2];
    const currentAssistant = commandRows.filter((node) => (node as FakeElement).dataset.role === "assistant").at(-1)
      ?? log.childNodes[log.childNodes.length - 1];
    expect((currentUser as FakeElement)?.className ?? "").not.toContain("is-prior-turn");
    expect((currentAssistant as FakeElement)?.className ?? "").not.toContain("is-prior-turn");
  });

  it("거부하면 원 응답에 폐기됨 배지를 붙이고 본문을 딤 처리한다", async () => {
    const mapId = store.getCurrent().startMapId;
    const calls = [proposed("paint_tiles", { mapId }, { tilesChanged: 1 }, "타일 1칸")];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn({ assistantText: "초안입니다.", proposedCalls: calls }));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => store.getCurrent());
    const panel = renderPanel("side", REVIEW_MODE);
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "초안";

    findByTestId(panel, "ai-send")?.click();
    await flushAsync();
    findByTestId(panel, "ai-proposal-reject")?.click();

    const assistant = findByTestId(panel, "ai-command-row-assistant");
    expect(findByTestId(panel, "ai-msg-badge-discarded")?.textContent).toBe("폐기됨");
    expect(assistant?.className).toContain("is-discarded");
    expect(findByTestId(panel, "ai-chat-log")?.textContent).toContain("초안을 폐기했습니다");
  });

  it("선택지 버튼은 입력창 경유로 답을 전송한다", async () => {
    const sent: string[] = [];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockImplementation(async (text: string) => {
      sent.push(text);
      return sent.length === 1
        ? turn({ assistantText: "어떤 배치가 좋나요?\n[선택지] 1번 숲길 | 2번 광장" })
        : turn({ assistantText: "선택을 반영하겠습니다." });
    });
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "마을 만들어줘";

    findByTestId(panel, "ai-send")?.click();
    await flushAsync();
    findByTestId(panel, "ai-choice-1")?.click();
    await flushAsync();

    expect(sent).toHaveLength(2);
    expect(sent[1]).toContain("1번 숲길");
    expect((findByTestId(panel, "ai-input") as FakeElement).value).toBe("");
  });

  it("부분 수락은 체크된 항목만 적용하고 적용됨 배지로 전환한다", async () => {
    const baseline = store.getCurrent();
    const mapId = baseline.startMapId;
    const ctx: ToolContext = { project: structuredClone(baseline) };
    const calls = [
      runProposed(ctx, "paint_tiles", { mapId, layer: "lower", mode: "cells", tile: TILE.PATH, cells: [{ x: 2, y: 2 }] }),
      runProposed(ctx, "paint_tiles", { mapId, layer: "lower", mode: "cells", tile: TILE.WATER, cells: [{ x: 3, y: 2 }] }),
    ];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn({ assistantText: "두 칸을 제안합니다.", proposedCalls: calls }));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => structuredClone(ctx.project));
    const panel = renderPanel("side", REVIEW_MODE);
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "두 칸";

    findByTestId(panel, "ai-send")?.click();
    await flushAsync();
    const second = findByTestId(panel, "ai-proposal-item-2") as FakeElement;
    second.checked = false;
    second.dispatchEvent(new Event("change"));
    findByTestId(panel, "ai-proposal-accept")?.click();
    await flushAsync(); // todo 4: 수락이 공유 적용 함수를 await하므로 완료를 기다린다.

    const map = store.getCurrent().maps[mapId];
    expect(map.lowerTiles[2 * map.width + 2]).toBe(TILE.PATH);
    expect(map.lowerTiles[2 * map.width + 3]).toBe(TILE.GRASS);
    expect(findByTestId(panel, "ai-msg-badge-applied")?.textContent).toBe("적용됨");
  });

  it("되돌리기는 시스템 라인과 되돌려짐 배지를 남긴다", async () => {
    const baseline = store.getCurrent();
    const mapId = baseline.startMapId;
    const ctx: ToolContext = { project: structuredClone(baseline) };
    const calls = [runProposed(ctx, "paint_tiles", { mapId, layer: "lower", mode: "cells", tile: TILE.PATH, cells: [{ x: 2, y: 2 }] })];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn({ assistantText: "한 칸 제안입니다.", proposedCalls: calls }));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => structuredClone(ctx.project));
    const panel = renderPanel("side", REVIEW_MODE);
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "한 칸";

    findByTestId(panel, "ai-send")?.click();
    await flushAsync();
    findByTestId(panel, "ai-proposal-accept")?.click();
    await flushAsync(); // todo 4: 수락이 공유 적용 함수를 await하므로 완료를 기다린다.
    findByTestId(panel, "ai-undo-last")?.click();

    expect(findByTestId(panel, "ai-chat-log")?.textContent).toContain("제안 1건");
    expect(findByTestId(panel, "ai-chat-log")?.textContent).toContain("되돌렸습니다");
    expect(findByTestId(panel, "ai-msg-badge-reverted")?.textContent).toBe("되돌려짐");
  });

});

describe("UXD topbar identity chip", () => {
  it("브라우저 기본 라벨을 게스트 세션 라벨로 단일화한다", () => {
    expect(readableTopbarIdentityLabel("브라우저 4547")).toBe("게스트 세션 4547");
  });

  it("menu.ts 상단바 렌더에서 사람 토큰 반복을 제거한다", () => {
    storage.setItem("oprn:editor-session-id", "4547-session");
    const topbar = document.createElement("div");

    renderTopbar(topbar);

    expect(findByTestId(fakeElement(topbar), "topbar-identity-label")?.textContent).toBe("게스트 세션 4547");
    expect(findByTestId(fakeElement(topbar), "topbar-identity")?.textContent).toBe("게스트 세션 4547");
  });
});

describe("proposal thumbnail crop coverage (event-only + new map)", () => {
  it("event-only proposal produces a non-null crop including the event bbox", async () => {
    const { computeMapTileChangeBounds } = await import("@/editor/panels/aiProposalCard");
    const { runTool } = await import("@/editor/tools");
    const { createBlankProject } = await import("@/project/defaults");
    const { TILE } = await import("@/project/defaults/constants");
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "m1", name: "t", width: 20, height: 16 }).ok).toBe(true);
    ctx.project.maps.m1.lowerTiles.fill(TILE.GRASS);
    ctx.project.maps.m1.upperTiles.fill(TILE.EMPTY);
    const after = structuredClone(ctx.project);
    // place one event at (12,9) — no tile change at all
    after.maps.m1.events.push({
      id: "ev1",
      x: 12,
      y: 9,
      trigger: { action: "playerTouch" },
      commands: [],
    } as never);
    const crop = computeMapTileChangeBounds(ctx.project, after, "m1");
    expect(crop).not.toBeNull();
    expect(crop!.x).toBeLessThanOrEqual(12);
    expect(crop!.x + crop!.w).toBeGreaterThan(12);
    expect(crop!.y).toBeLessThanOrEqual(9);
    expect(crop!.y + crop!.h).toBeGreaterThan(9);
  });

  it("new-map proposal renders the 새 맵 placeholder thumbnail", async () => {
    const { computeMapTileChangeBounds } = await import("@/editor/panels/aiProposalCard");
    const { renderProposalMapThumbnail } = await import("@/editor/panels/aiProposalCard");
    const { runTool } = await import("@/editor/tools");
    const { createBlankProject } = await import("@/project/defaults");
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "m1", name: "t", width: 20, height: 16 }).ok).toBe(true);
    const created = structuredClone(ctx.project);
    expect(runTool({ project: created }, "create_map", { id: "m2", name: "new", width: 12, height: 10 }).ok).toBe(true);
    // before lacks m2 entirely
    expect(computeMapTileChangeBounds(ctx.project, created, "m2")).toBeNull();
    const el = renderProposalMapThumbnail(ctx.project, "m2", "after", null);
    expect(el.dataset.testid ?? el.querySelector("[data-testid=ai-proposal-thumb-new-map]") !== null).toBeTruthy();
    expect(el.querySelector('[data-testid="ai-proposal-thumb-new-map"]') !== null
      || el.getAttribute("data-testid") === "ai-proposal-thumb-new-map").toBe(true);
  });
});

// 감독 지시(2026-08-27): "AI 가 생성하고 나서 '이 맵에 넣기' modal 이 뜨는데 이게 좆도 의미가
// 없다. 그냥 바로 집어넣고(approve 없이) 왼쪽 하단에 되돌리기 기능을 활용하게 하는 게 나을듯."
//
// 실측한 결함: autoApprove 는 이미 사실상 켜져 있었는데(agentMode 기본값 "auto") aiChatPanel 의
// 자동 적용 분기가 classifyProposalSafety().safe 와 completenessWarnings.length === 0 을 함께
// 요구했다. safe 판정은 LOW_RISK_SPATIAL_TOOLS(타일만 바꾸는 5개 툴) + "현재 맵 타일 배열만
// 변경" 만 통과시키므로 NPC·이벤트·맵 생성이 섞인 실제 생성 턴은 전부 검토 카드로 갔다.
// 되돌리기가 있는 변경을 승인 카드로 막는 것은 마찰만 남는다 — 경고는 로그로 전달하면 된다.
describe("AI 제안 즉시 적용 (승인 카드 없음)", () => {
  it("비파괴 제안은 안전분류 불통과·린트 경고와 무관하게 승인 없이 바로 적용된다", async () => {
    const baseline = store.getCurrent();
    const mapId = baseline.startMapId;
    const ctx: ToolContext = { project: structuredClone(baseline) };
    const calls = [
      runProposed(ctx, "paint_tiles", { mapId, layer: "lower", mode: "cells", tile: TILE.PATH, cells: [{ x: 2, y: 2 }] }),
      proposed("place_npc", { mapId, x: 1, y: 1 }, { eventsAdded: 1 }, "NPC 1명"),
    ];
    // 이 제안은 예전 게이트를 둘 다 못 넘는다: safety 불통과 + 세계관 미기재 린트 경고.
    expect(classifyProposalSafety({ calls, before: baseline, after: ctx.project, currentMapId: mapId }).safe).toBe(false);
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(
      turn({ assistantText: "NPC 1명과 길 1칸을 놓았습니다.", proposedCalls: calls }),
    );
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => structuredClone(ctx.project));
    editorState.set({ currentMapId: mapId, selection: null });
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "여기 NPC 넣고 길 깔아줘";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    expect(findByTestId(panel, "ai-proposal-card")).toBeNull();
    expect(findByTestId(panel, "ai-change-card")).toBeTruthy();
    expect(findByTestId(panel, "ai-change-undo")).toBeTruthy();
    const map = store.getCurrent().maps[mapId];
    expect(map.lowerTiles[2 * map.width + 2]).toBe(TILE.PATH);
    // 린트 경고는 게이트가 아니라 로그로 전달된다.
    expect(findByTestId(panel, "ai-chat-log")?.textContent).toContain("세계관 미기재");
  });

  it("파괴적 제안은 여전히 검토 카드로 간다", async () => {
    const baseline = store.getCurrent();
    const mapId = baseline.startMapId;
    const calls = [
      { ...proposed("clear_region", { mapId }, { tilesChanged: 24 }, "영역 비우기"), destructive: true },
    ];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(
      turn({ assistantText: "영역을 비웁니다.", proposedCalls: calls }),
    );
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => store.getCurrent());
    editorState.set({ currentMapId: mapId, selection: null });
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "여기 다 지워줘";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    expect(findByTestId(panel, "ai-proposal-card")).toBeTruthy();
    expect(findByTestId(panel, "ai-proposal-accept")?.textContent).toBe("이 맵에 넣기");
    expect(findByTestId(panel, "ai-change-card")).toBeNull();
  });

  it("자동 적용을 끄면 비파괴 제안도 검토 카드로 돌아간다", async () => {
    const baseline = store.getCurrent();
    const mapId = baseline.startMapId;
    const ctx: ToolContext = { project: structuredClone(baseline) };
    const calls = [
      runProposed(ctx, "paint_tiles", { mapId, layer: "lower", mode: "cells", tile: TILE.PATH, cells: [{ x: 2, y: 2 }] }),
    ];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(
      turn({ assistantText: "길 1칸을 제안합니다.", proposedCalls: calls }),
    );
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => structuredClone(ctx.project));
    editorState.set({ currentMapId: mapId, selection: null });
    const panel = renderPanel("side", REVIEW_MODE);
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "길 깔아줘";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    expect(findByTestId(panel, "ai-proposal-card")).toBeTruthy();
    expect(findByTestId(panel, "ai-change-card")).toBeNull();
    const map = store.getCurrent().maps[mapId];
    expect(map.lowerTiles[2 * map.width + 2]).toBe(TILE.GRASS);
  });
  // 즉시 적용은 "적용됐다"고 말하기 전에 실제로 적용됐는지 확인해야 한다. 배치 검증(수관 아래
  // 밑동 없음 등)이 막으면 store 는 그대로이므로 자동 적용 카드를 남기면 거짓말이 된다.
  it("배치 검증이 막은 턴은 자동 적용 카드를 남기지 않는다", async () => {
    const baseline = store.getCurrent();
    const mapId = baseline.startMapId;
    const after = structuredClone(baseline);
    const target = after.maps[mapId];
    const brokenIndex = 3 * target.width + 3;
    target.upperTiles[brokenIndex] = 260;
    const calls = [proposed("place_props", { mapId }, { tilesChanged: 1 }, "나무 1")];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(
      turn({ assistantText: "나무를 놓았습니다.", proposedCalls: calls }),
    );
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => structuredClone(after));
    editorState.set({ currentMapId: mapId, selection: null });

    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "나무 심어줘";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    expect(findByTestId(panel, "ai-chat-log")?.textContent).toContain("배치 검증 실패");
    expect(findByTestId(panel, "ai-change-card")).toBeNull();
    expect(store.getCurrent().maps[mapId].upperTiles[brokenIndex]).not.toBe(260);
  });
});
