// 스코프 턴(선택 영역이 걸린 조수 턴) — 통합의 계약을 조수 패널 위에서 고정한다.
//
// 왜 이 파일이 필요한가 — 예전에는 영역 작업이 `runRegionTask` 라는 **두 번째 실행체**였다.
// 매번 새 세션, lite 고정, 자체 승인 게이트. 통합 후 "영역" 은 엔진이 아니라 그 턴의
// **스코프 제약**(프롬프트 문구 + 하드 클립)일 뿐이고, 실행은 조수 세션 하나가 한다.
// 그래서 여기서 고정하는 것은 다음 다섯 가지다.
//   ① 스코프 없는 턴은 클립하지 않는다(맵 전체 작업이 잘리면 채팅이 망가진다)
//   ② 같은 세션이라 후속 턴이 앞 턴을 기억한다 ← 통합의 핵심 이득. 예전엔 불가능했다
//   ③ 하네스(reviewRegionDraft) 차단 사유는 ⚠ 로 남지만 적용을 막지 않는다(정책: 승인 게이트 없음)
//   ④ 실내·새 맵 의도는 스코프를 풀지만 우회하지 않는다(같은 세션 그대로)
//   ⑤ 캔버스 사각형 배지는 턴 시작에 켜지고 끝에 반드시 꺼진다
//
// 영역 밖 쓰기를 실제로 되돌리는 실측은 test/aiChatPanelUxRepairs.test.ts 가 맡는다
// (칩 → Enter → 스코프 → 영역 밖 1칸 되돌림 + 문구).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { requestAiSelectionContext } from "@/editor/aiSelectionContext";
import { editorState } from "@/editor/editorState";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import {
  REGION_TASK_STATUS_EVENT,
  regionTaskStatusDetail,
  type RegionTaskStatusDetail,
} from "@/editor/regionTask/regionTaskStatus";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;
let restoreWindow: (() => void) | null = null;
let storage: Map<string, string>;
let statuses: RegionTaskStatusDetail[] = [];

function installFakeLocalStorage(): void {
  storage = new Map();
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
}

function installFakeWindow(): void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const target = new EventTarget() as EventTarget & Partial<Window>;
  target.setTimeout = ((..._args: Parameters<typeof setTimeout>) => 0) as typeof setTimeout;
  target.clearTimeout = ((..._args: Parameters<typeof clearTimeout>) => undefined) as typeof clearTimeout;
  target.setInterval = ((..._args: Parameters<typeof setInterval>) => 1) as typeof setInterval;
  target.clearInterval = ((..._args: Parameters<typeof clearInterval>) => undefined) as typeof clearInterval;
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: target });
  target.addEventListener(REGION_TASK_STATUS_EVENT, (event) => {
    const detail = regionTaskStatusDetail(event);
    if (detail) statuses.push(detail);
  });
  restoreWindow = () => {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
    restoreWindow = null;
  };
}

function toolRound(name: string, args: unknown, id: string): ChatResult {
  return {
    message: {
      role: "assistant",
      content: null,
      tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
    },
    finishReason: "tool_calls",
  } as ChatResult;
}

function finalRound(text: string): ChatResult {
  return { message: { role: "assistant", content: text }, finishReason: "stop" } as ChatResult;
}

/** 라운드마다 사용자 발화를 기록하며 스크립트를 소비한다. */
function scriptedChat(steps: readonly ChatResult[]) {
  const userTexts: string[] = [];
  let index = 0;
  const chat = vi.fn(async (_config: unknown, req: ChatRequest): Promise<ChatResult> => {
    for (const message of req.messages) {
      if (message.role === "user" && typeof message.content === "string") {
        if (!userTexts.includes(message.content)) userTexts.push(message.content);
      }
    }
    const next = steps[index];
    index += 1;
    if (!next) throw new Error("scripted chat exhausted");
    return next;
  });
  return { chat, userTexts, rounds: () => index };
}

async function flushAsync(): Promise<void> {
  for (let index = 0; index < 20; index += 1) await Promise.resolve();
}

async function settleTurn(): Promise<void> {
  for (let index = 0; index < 24; index += 1) await flushAsync();
}

function logText(panel: FakeElement): string {
  return findByTestId(panel, "ai-chat-log")?.textContent ?? "";
}

function submit(panel: FakeElement, text: string): void {
  const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
  input.value = text;
  findByTestId(panel, "ai-send")?.click();
}

const REGION = { x: 1, y: 1, width: 3, height: 3 } as const;

beforeEach(() => {
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  statuses = [];
  restoreDom = installFakeDom();
  installFakeLocalStorage();
  storage.set(
    AI_CONFIG_STORAGE_KEY,
    JSON.stringify({ ...defaultAiConfig(), agentMode: "chat", model: "m", liteModel: "m", apiKey: "sk-test" }),
  );
  installFakeWindow();
});

afterEach(() => {
  teardownAiChatPanel();
  restoreWindow?.();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("스코프 없는 턴", () => {
  it("선택이 없으면 맵 전체 쓰기를 클립하지 않고 영역 문구도 붙이지 않는다", async () => {
    const mapId = store.getCurrent().startMapId;
    editorState.set({ currentMapId: mapId, selection: null });
    const script = scriptedChat([
      // 선택이 없으면 암묵적 명세도 없으므로 공간 쓰기는 스펙 게이트를 먼저 통과해야 한다
      // (세션의 기존 계약 — 영역 턴은 선택 사각형이 명세를 대신했다).
      toolRound("set_build_spec", {
        mapId,
        title: "맵 전체 지형",
        assets: [{ id: "terrain_1", kind: "terrain", x: 0, y: 0, w: 10, h: 10, layer: "lower", overExisting: "keep" }],
      }, "s1"),
      toolRound("paint_tiles", {
        mapId, layer: "lower", mode: "cells", tile: 5,
        cells: [{ x: 0, y: 0 }, { x: 9, y: 9 }],
      }, "c1"),
      finalRound("전체를 칠했습니다."),
    ]);
    const panel = renderAiChatPanel({ getChatDock: () => "side", sessionChat: script.chat }) as unknown as FakeElement;

    submit(panel, "맵 전체를 풀로 덮어줘");
    await settleTurn();

    // 턴이 실제로 돌았다 — 가이드가 합성문에 섞여도 되묻기로 세워지지 않는다. 통합 직후
    // 실측: 가이드 고정 문구의 실내·야외 표지 때문에 "집을 어떻게 만들까요?" 로 되물어지고
    // 툴이 0건이었다. 라운드 수가 그 회귀를 잡는 자리다.
    expect(script.rounds()).toBe(3);
    expect(logText(panel)).not.toContain("집/건물을 어떻게 만들까요");
    // 스코프 문구는 없다 — 사각형이 없으면 "여기만" 이라는 제약 자체가 성립하지 않는다.
    expect(script.userTexts[0]).not.toContain("선택 영역 안에서만");
    expect(script.userTexts[0]).not.toContain("사용자 선택 영역:");
    // 클립도 없다: 서로 멀리 떨어진 두 칸이 모두 남는다.
    const map = store.getCurrent().maps[mapId]!;
    expect(map.lowerTiles[0]).toBe(5);
    expect(map.lowerTiles[9 * map.width + 9]).toBe(5);
    expect(logText(panel)).not.toContain("되돌렸습니다");
    // 스코프가 없으면 캔버스 배지도 뜨지 않는다.
    expect(statuses).toHaveLength(0);
  });
});

describe("세션 기억", () => {
  it("스코프 턴 다음의 후속 턴이 앞 턴을 기억한다 (예전 영역 경로는 매번 새 세션이었다)", async () => {
    const mapId = store.getCurrent().startMapId;
    editorState.set({ currentMapId: mapId, selection: { mapId, ...REGION } });
    const script = scriptedChat([
      toolRound("paint_tiles", { mapId, layer: "lower", mode: "cells", tile: 5, cells: [{ x: 1, y: 1 }] }, "c1"),
      finalRound("한 칸 깔았습니다."),
      toolRound("paint_tiles", { mapId, layer: "lower", mode: "cells", tile: 5, cells: [{ x: 2, y: 2 }] }, "c2"),
      finalRound("더 깔았습니다."),
    ]);
    const panel = renderAiChatPanel({ getChatDock: () => "side", sessionChat: script.chat }) as unknown as FakeElement;

    requestAiSelectionContext(editorState.get().selection);
    submit(panel, "여기에 길 깔아줘");
    await settleTurn();
    submit(panel, "좀 더 많이");
    await settleTurn();

    // 후속 턴의 요청 메시지 목록에 **앞 턴의 발화가 그대로 남아 있어야** 한다.
    // 세션이 새로 만들어졌다면 첫 발화는 사라진다 — 그것이 예전 영역 경로의 결함이었다.
    expect(script.userTexts.some((text) => text.includes("여기에 길 깔아줘"))).toBe(true);
    expect(script.userTexts.some((text) => text.includes("좀 더 많이"))).toBe(true);
    expect(script.rounds()).toBe(4);
    const map = store.getCurrent().maps[mapId]!;
    expect(map.lowerTiles[1 * map.width + 1]).toBe(5);
    expect(map.lowerTiles[2 * map.width + 2]).toBe(5);
  });
});

describe("플레이 가능성 하네스", () => {
  it("차단 사유가 있어도 적용은 되고 ⚠ 경고만 남는다", async () => {
    const mapId = store.getCurrent().startMapId;
    editorState.set({ currentMapId: mapId, selection: { mapId, ...REGION } });
    // 시간 시스템이 꺼진 채 스케줄 NPC를 넣으면 하네스가 error 급 차단 사유를 낸다.
    const script = scriptedChat([
      toolRound("make_villager", {
        mapId,
        name: "농부",
        home: { x: 2, y: 2 },
        schedule: [{ when: { hourRange: [6, 18] }, at: { mapId, x: 2, y: 2 } }],
      }, "c1"),
      finalRound("주민을 넣었습니다."),
    ]);
    const panel = renderAiChatPanel({ getChatDock: () => "side", sessionChat: script.chat }) as unknown as FakeElement;

    requestAiSelectionContext(editorState.get().selection);
    submit(panel, "여기 주민 한 명 넣고 시간표 줘");
    await settleTurn();

    const text = logText(panel);
    // 적용은 됐다 — 정책은 "승인 게이트 없음, 복구는 되돌리기" 다.
    expect(text).toContain("프로젝트에 적용했습니다");
    // 그리고 삼키지도 않는다.
    expect(text).toContain("플레이 가능성 경고");
    expect(text).toContain("적용은 유지됨");
    expect(store.getCurrent().maps[mapId]!.events.length).toBeGreaterThan(0);
  });
});

describe("실내·새 맵 의도", () => {
  it("스코프를 풀지만 같은 세션에서 그대로 진행한다(우회·재라우팅 없음)", async () => {
    const mapId = store.getCurrent().startMapId;
    editorState.set({ currentMapId: mapId, selection: { mapId, ...REGION } });
    const script = scriptedChat([finalRound("실내 맵을 준비하겠습니다.")]);
    const panel = renderAiChatPanel({ getChatDock: () => "side", sessionChat: script.chat }) as unknown as FakeElement;

    requestAiSelectionContext(editorState.get().selection);
    submit(panel, "연금술사의 집 이라는 실내 를 하나 만들어줘");
    await settleTurn();

    // 스코프가 풀렸으니 "이 영역 안에서만" 은 붙지 않는다 — 새 맵은 사각형 밖이 본업이다.
    expect(script.userTexts[0]).not.toContain("선택 영역 안에서만");
    // 그래도 같은 세션에서 턴이 돌았고 사용자에게 되묻거나 다른 창으로 보내지 않는다.
    expect(script.rounds()).toBe(1);
    expect(logText(panel)).toContain("실내 맵을 준비하겠습니다.");
    // 스코프가 없으므로 캔버스 배지도 뜨지 않는다.
    expect(statuses).toHaveLength(0);
  });
});

describe("캔버스 사각형 배지", () => {
  it("스코프 턴 시작에 켜지고 턴이 끝나면 반드시 꺼진다", async () => {
    const mapId = store.getCurrent().startMapId;
    editorState.set({ currentMapId: mapId, selection: { mapId, ...REGION } });
    const script = scriptedChat([finalRound("확인했습니다.")]);
    const panel = renderAiChatPanel({ getChatDock: () => "side", sessionChat: script.chat }) as unknown as FakeElement;

    requestAiSelectionContext(editorState.get().selection);
    submit(panel, "여기 나무 좀 심어줘");
    await settleTurn();

    expect(statuses.length).toBeGreaterThanOrEqual(2);
    expect(statuses[0]).toMatchObject({ mapId, region: REGION, running: true });
    expect(statuses.at(-1)).toMatchObject({ mapId, region: REGION, running: false });
    // 같은 턴의 켜기/끄기는 같은 runId 여야 한다 — 남의 턴 배지를 지우면 안 된다.
    expect(statuses.at(-1)?.runId).toBe(statuses[0]?.runId);
  });

  it("턴이 오류로 끝나도 배지는 꺼진다", async () => {
    const mapId = store.getCurrent().startMapId;
    editorState.set({ currentMapId: mapId, selection: { mapId, ...REGION } });
    const chat = vi.fn(async (): Promise<ChatResult> => { throw new Error("모델이 끊겼습니다"); });
    const panel = renderAiChatPanel({ getChatDock: () => "side", sessionChat: chat }) as unknown as FakeElement;

    requestAiSelectionContext(editorState.get().selection);
    submit(panel, "여기 나무 좀 심어줘");
    await settleTurn();

    expect(statuses.at(-1)).toMatchObject({ running: false });
  });
});
