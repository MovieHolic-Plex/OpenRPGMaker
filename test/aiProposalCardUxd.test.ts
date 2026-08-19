import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type ProposedCall, type TurnResult } from "@/ai/assistantSession";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import {
  enforceProposalDependencies,
  proposalDependencyIndexes,
  proposalHasMapTileChanges,
  proposalHumanSummaryLine,
  proposalPreviewMapId,
  proposalSummaryLines,
  proposalTechnicalDetailLines,
  reassembleSelectedProposalProject,
  renderAiChatPanel,
} from "@/editor/panels/aiChatPanel";
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

function renderPanel(): FakeElement {
  storage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), apiKey: "sk-test", baseUrl: "x", model: "m" }));
  return renderAiChatPanel({ clock: () => 1_000, getChatDock: () => "side" }) as unknown as FakeElement;
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

    expect(proposalHumanSummaryLine(calls)).toBe("집 2채 · 길 33칸 · 나무 16그루 · 세계관 1건");
  });

  it("세계관 추가와 수정이 함께 있으면 추가/수정 수를 보존한다", () => {
    const calls = [proposed("upsert_world_entities", {}, { worldEntitiesAdded: 1, worldEntitiesModified: 1 }, "세계관 추가 1/수정 1")];

    expect(proposalSummaryLines(calls)[0]).toContain("세계관 추가 1/수정 1");
  });

  it("완성도 경고는 사람 요약 뒤에 붙인다", () => {
    const calls = [proposed("build_house", { mapId: "m1" }, { tilesChanged: 12 }, "집")];

    expect(proposalSummaryLines(calls, ["⚠ 미이행: 길 영역 미변경"])).toEqual(["집 1채", "⚠ 미이행: 길 영역 미변경"]);
  });

  it("기술 상세 라인은 원시 도구명을 별도로 유지한다", () => {
    const calls = [proposed("paint_road", { mapId: "m1" }, { tilesChanged: 3 }, "도로 3칸")];

    expect(proposalHumanSummaryLine(calls)).not.toContain("paint_road");
    expect(proposalTechnicalDetailLines(calls)[0]).toContain("paint_road — 도로 3칸");
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
  it("제안 카드에 요약, 미니맵, 항목 체크박스, 제안 배지를 렌더한다", async () => {
    const baseline = store.getCurrent();
    const mapId = baseline.startMapId;
    const ctx: ToolContext = { project: structuredClone(baseline) };
    const calls = [runProposed(ctx, "paint_tiles", { mapId, layer: "lower", mode: "cells", tile: TILE.PATH, cells: [{ x: 2, y: 2 }] })];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn({ assistantText: "길 초안을 제안합니다.", proposedCalls: calls }));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => structuredClone(ctx.project));
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "길 깔아줘";

    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    expect(findByTestId(panel, "ai-proposal-summary")?.textContent).toContain("타일 1칸");
    expect(findByTestId(panel, "ai-proposal-thumb-before")).toBeTruthy();
    expect(findByTestId(panel, "ai-proposal-thumb-after")).toBeTruthy();
    expect(findByTestId(panel, "ai-proposal-item-1")).toBeTruthy();
    expect(findByTestId(panel, "ai-msg-badge-proposal")?.textContent).toBe("제안");
  });

  it("사이드 워크 로그는 idle 페이드로 숨기지 않고 제안 카드는 남는다", async () => {
    const mapId = store.getCurrent().startMapId;
    const calls = [proposed("paint_tiles", { mapId }, { tilesChanged: 1 }, "타일 1칸")];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn({ assistantText: "초안입니다.", proposedCalls: calls }));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => store.getCurrent());
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "초안";

    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    expect(findByTestId(panel, "ai-rising-overlay")).toBeTruthy();
    expect(findByTestId(panel, "ai-rising-volatile-zone")?.className).not.toContain("is-faded");
    expect(findByTestId(panel, "ai-rising-volatile-zone")?.hidden).toBe(false);
    expect(findByTestId(panel, "ai-proposal-accept")).toBeTruthy();
    expect(findByTestId(panel, "ai-proposal-host")?.textContent).toContain("변경 제안");
  });

  it("제안이 오면 몰입 모달이 열리고, '나중에'는 pill로 최소화, 수락하면 닫힌다", async () => {
    const mapId = store.getCurrent().startMapId;
    const calls = [proposed("paint_tiles", { mapId }, { tilesChanged: 1 }, "타일 1칸")];
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn({ assistantText: "초안입니다.", proposedCalls: calls }));
    vi.spyOn(AssistantSession.prototype, "getProposedProject").mockImplementation(() => store.getCurrent());
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "초안";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    // 제안 렌더 → 모달 자동 오픈(+건수), pill 숨김
    const modal = findByTestId(panel, "ai-proposal-modal") as FakeElement;
    const pill = findByTestId(panel, "ai-proposal-reopen") as FakeElement;
    expect(modal.hidden).toBe(false);
    expect(findByTestId(panel, "ai-proposal-modal-count")?.textContent).toBe("1건");
    expect(pill.hidden).toBe(true);
    // 카드 본체(수락 버튼)는 모달 안에 있다
    expect(findByTestId(modal, "ai-proposal-accept")).toBeTruthy();

    // '나중에' → 최소화: 모달 숨고 pill 등장(승인 대기 유지)
    findByTestId(panel, "ai-proposal-modal-later")?.click();
    expect(modal.hidden).toBe(true);
    expect(pill.hidden).toBe(false);
    expect(pill.textContent).toContain("변경 제안 1건");

    // pill 클릭 → 재오픈
    pill.click();
    expect(modal.hidden).toBe(false);
    expect(pill.hidden).toBe(true);

    // 수락 → 모달/pill 모두 정리
    findByTestId(panel, "ai-proposal-accept")?.click();
    await flushAsync();
    expect(modal.hidden).toBe(true);
    expect(pill.hidden).toBe(true);
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
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as FakeElement;

    input.value = "맵 고쳐줘";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    const modal = findByTestId(panel, "ai-proposal-modal") as FakeElement;
    expect(modal.hidden).toBe(false);
    expect(findByTestId(panel, "ai-proposal-modal-count")?.textContent).toBe("2건");
    expect(findByTestId(modal, "ai-proposal-accept")).toBeTruthy();
    expect(findByTestId(modal, "ai-proposal-item-1")).toBeTruthy();
    expect(findByTestId(modal, "ai-proposal-item-2")).toBeTruthy();

    // 제안 대기 중 후속 질문(쓰기 툴 없음) — 예전 버그는 host를 비우고 헤더(2건)만 남김.
    input.value = "왜 이렇게 했어?";
    findByTestId(panel, "ai-send")?.click();
    await flushAsync();

    expect(modal.hidden).toBe(false);
    expect(findByTestId(panel, "ai-proposal-modal-count")?.textContent).toBe("2건");
    expect(findByTestId(modal, "ai-proposal-accept")).toBeTruthy();
    // testid는 체크박스에 붙으므로 본문 문구는 host 텍스트로 확인한다.
    const hostText = findByTestId(panel, "ai-proposal-host")?.textContent ?? "";
    expect(hostText).toContain("타일 2칸");
    expect(hostText).toContain("NPC 1명");
    expect(findByTestId(modal, "ai-proposal-item-1")).toBeTruthy();
    expect(findByTestId(modal, "ai-proposal-item-2")).toBeTruthy();
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
    const panel = renderPanel();
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
    const panel = renderPanel();
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
    const panel = renderPanel();
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

  it("스킬 실행 사용자 메시지는 실제 지시 보기 토글을 포함한다", async () => {
    // Break: slash-running map-audit no longer attaches the raw-prompt toggle.
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue(turn({ assistantText: "검증하겠습니다." }));
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input") as FakeElement;
    input.value = "/검증";
    input.dispatchEvent(new Event("input"));
    findByTestId(panel, "ai-slash-item-map-audit")?.click();
    await flushAsync();

    expect(findByTestId(panel, "ai-skill-prompt-toggle")?.textContent).toBe("실제 지시 보기");
    expect(findByTestId(panel, "ai-skill-prompt-raw")?.textContent).toContain("현재 맵(빈 맵)을 전면 검증해 주세요");
  });
});

describe("UXD topbar identity chip", () => {
  it("브라우저 기본 라벨을 게스트 세션 라벨로 단일화한다", () => {
    expect(readableTopbarIdentityLabel("브라우저 4547")).toBe("게스트 세션 4547");
  });

  it("menu.ts 상단바 렌더에서 사람 토큰 반복을 제거한다", () => {
    storage.setItem("rpg-zzu-editor-session-id", "4547-session");
    const topbar = document.createElement("div");

    renderTopbar(topbar);

    expect(findByTestId(fakeElement(topbar), "topbar-identity-label")?.textContent).toBe("게스트 세션 4547");
    expect(findByTestId(fakeElement(topbar), "topbar-identity")?.textContent).toBe("게스트 세션 4547");
  });
});
