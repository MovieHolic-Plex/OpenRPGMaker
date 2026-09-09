// 패널 배선: 컴포저 모드 칩이 작업 접수 payload.turn.composerMode 로 실린다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { clearConversations, loadConversation } from "@/ai/conversationStore";
import { editorState } from "@/editor/editorState";
import {
  renderAiChatPanel,
  teardownAiChatPanel,
  whenAiChatPanelJobResultSettled,
  whenAiChatPanelSettled,
} from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";
import { installAdmitClient, whenDom } from "./aiJobAdmitSupport";

let restoreDom: (() => void) | null = null;
let harness: ReturnType<typeof installAdmitClient>;

function installFakeLocalStorage(): void {
  const storage = new Map<string, string>();
  storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({
    ...defaultAiConfig(),
    authMode: "apiKey",
    apiKey: "sk-test",
    baseUrl: "https://example.test/v1",
    model: "gemini-3.1-pro",
    liteModel: "gemini-2.5-flash-lite",
    agentMode: "chat",
  }));
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

beforeEach(async () => {
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: "load-failed" });
  await store.loadFallbackProject(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  restoreDom = installFakeDom();
  installFakeLocalStorage();
  harness = installAdmitClient();
});

afterEach(async () => {
  teardownAiChatPanel();
  await clearConversations();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("컴포저 모드 → 세션 옵션", () => {
  it.each([
    ["ask", "ai-composer-mode-ask"],
    ["plan", "ai-composer-mode-plan"],
  ] as const)("%s 칩을 고르고 전송하면 접수 payload 에 composerMode 가 실린다", async (mode, testid) => {
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    (findByTestId(panel, testid) as unknown as FakeElement | null)?.click();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "이 맵 크기가 얼마야?";
    const pending = harness.nextAdmitted();
    findByTestId(panel, "ai-send")?.click();
    const admitted = await pending;
    expect(admitted.input.family).toBe("assistant");
    expect((admitted.input.payload.turn as { composerMode?: string } | undefined)?.composerMode).toBe(mode);
  });

  it("기본(지시) 모드는 composerMode:\"do\" 로 실린다", async () => {
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "타이틀 바꿔줘";
    const pending = harness.nextAdmitted();
    findByTestId(panel, "ai-send")?.click();
    const admitted = await pending;
    expect((admitted.input.payload.turn as { composerMode?: string } | undefined)?.composerMode).toBe("do");
  });

  it("계획 모드는 작업 결과의 계획으로 체크리스트를 그린다", async () => {
    const plan = {
      id: "plan-1",
      goal: "타이틀 2단계",
      createdAt: new Date().toISOString(),
      currentLayerIndex: 0,
      currentItemId: "i1",
      layers: [{ id: "l1", title: "타이틀", items: [
        { id: "i1", title: "1차", instruction: "set_title_screen", status: "pending" },
        { id: "i2", title: "2차", instruction: "set_title_screen", status: "pending" },
      ] }],
    };
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    (findByTestId(panel, "ai-composer-mode-plan") as unknown as FakeElement | null)?.click();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "타이틀을 두 단계로";
    const pending = harness.nextAdmitted();
    findByTestId(panel, "ai-send")?.click();
    await pending;
    // 가짜 DOM 은 패널을 document.body 에 달지 않는다 — 관찰 대상은 패널 자신이다.
    const shown = whenDom(panel as unknown as Node, () => Boolean(findByTestId(panel, "ai-work-plan-checklist")));
    await harness.complete({
      assistantText: "계획을 세워두었습니다.",
      workPlan: plan,
      proposedCalls: [],
      stoppedReason: "final",
    });
    await shown;
    expect(findByTestId(panel, "ai-work-plan-checklist")).toBeTruthy();
    expect(findByTestId(panel, "ai-autonomous-budget")).toBeNull();
  });

  it("keeps A's transcript when B is the live job", async () => {
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "첫번째";
    const first = harness.nextAdmitted();
    findByTestId(panel, "ai-send")?.click();
    await first;
    const gate = harness.holdNextArtifact();
    await harness.complete({ assistantText: "A 답변", proposedCalls: [], stoppedReason: "final" });
    await gate.started;
    input.value = "두번째";
    const second = harness.nextAdmitted();
    findByTestId(panel, "ai-send")?.click();
    await second;
    const jobB = harness.lastJob().id;
    const status = findByTestId(panel, "ai-status");
    // 접수 응답이 돌아왔다고 해서 앞면이 이미 B 를 그린 것은 아니다 — 그 상태를 기다렸다가 잡는다.
    await whenDom(panel as unknown as Node, () => (status?.textContent ?? "").includes(jobB));
    const bStatus = status?.textContent ?? "";
    gate.release();
    await gate.idle;
    // 붙잡은 읽기를 놓았으니, 이제는 「그 결과 처리가 끝났다」 신호를 기다릴 수 있다.
    await whenAiChatPanelJobResultSettled();
    const log = findByTestId(panel, "ai-chat-log")?.textContent ?? "";
    expect(log).toContain("A 답변");
    expect(status?.textContent).toBe(bStatus);
    expect(status?.textContent).not.toBe("응답 완료");
  });

  it("keeps A's result in the captured conversation after a new conversation", async () => {
    const surface = renderAiChatPanel({ clock: () => 37_000 });
    const panel = surface as unknown as FakeElement;
    const firstId = surface.conversationId;
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "첫번째";
    const first = harness.nextAdmitted();
    findByTestId(panel, "ai-send")?.click();
    await first;
    const gate = harness.holdNextArtifact();
    await harness.complete({ assistantText: "A 답변", proposedCalls: [], stoppedReason: "final" });
    await gate.started;
    findByTestId(panel, "ai-new-session")?.click();
    await whenAiChatPanelSettled();
    gate.release();
    await gate.idle;
    await whenAiChatPanelJobResultSettled();
    const log = findByTestId(panel, "ai-chat-log")?.textContent ?? "";
    expect(log).not.toContain("A 답변");
    expect(surface.conversationId).not.toBe(firstId);
    expect(findByTestId(panel, "ai-status")?.textContent).not.toBe("응답 완료");
    const record = await loadConversation(firstId);
    expect(record?.entries.some((entry) => entry.kind === "assistant" && entry.text === "A 답변")).toBe(true);
  });

  it("rejected admission after a conversation switch does not paint the new log", async () => {
    const surface = renderAiChatPanel({ clock: () => 37_000 });
    const panel = surface as unknown as FakeElement;
    const firstId = surface.conversationId;
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "첫번째";
    const pending = harness.nextAdmitted();
    void pending.catch(() => undefined);
    const gate = harness.holdNextAdmission();
    findByTestId(panel, "ai-send")?.click();
    await gate.started;
    harness.failNext("접수 거부");
    findByTestId(panel, "ai-new-session")?.click();
    await whenAiChatPanelSettled();
    gate.release();
    await gate.idle;
    // 접수 거부도 이 전송의 결과다 — 마이크로태스크 수 세기 대신 귀속 신호를 기다린다.
    await whenAiChatPanelJobResultSettled();
    const log = findByTestId(panel, "ai-chat-log")?.textContent ?? "";
    expect(log).not.toContain("접수 거부");
    expect(log).not.toContain("AI jobs HTTP 500");
    expect(surface.conversationId).not.toBe(firstId);
    const record = await loadConversation(firstId);
    expect(record?.entries.some((entry) => entry.kind === "status" && entry.text.includes("AI jobs HTTP 500"))).toBe(true);
  });

  it("late A after B in the same conversation then switch keeps both turns", async () => {
    const surface = renderAiChatPanel({ clock: () => 37_000 });
    const panel = surface as unknown as FakeElement;
    const firstId = surface.conversationId;
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "첫번째";
    const first = harness.nextAdmitted();
    findByTestId(panel, "ai-send")?.click();
    await first;
    const jobA = harness.lastJob().id;
    input.value = "두번째";
    const second = harness.nextAdmitted();
    findByTestId(panel, "ai-send")?.click();
    await second;
    const jobB = harness.lastJob().id;
    const shownB = whenDom(panel as unknown as Node, () => (findByTestId(panel, "ai-chat-log")?.textContent ?? "").includes("B 답변"));
    await harness.complete({ assistantText: "B 답변", proposedCalls: [], stoppedReason: "final" }, jobB);
    await shownB;
    await whenAiChatPanelJobResultSettled();
    const gate = harness.holdNextArtifact();
    await harness.complete({ assistantText: "A 답변", proposedCalls: [], stoppedReason: "final" }, jobA);
    await gate.started;
    findByTestId(panel, "ai-new-session")?.click();
    await whenAiChatPanelSettled();
    gate.release();
    await gate.idle;
    await whenAiChatPanelJobResultSettled();
    const log = findByTestId(panel, "ai-chat-log")?.textContent ?? "";
    expect(log).not.toContain("A 답변");
    expect(log).not.toContain("B 답변");
    expect(surface.conversationId).not.toBe(firstId);
    const record = await loadConversation(firstId);
    const entries = record?.entries ?? [];
    expect(entries.filter((entry) => entry.kind === "user" && entry.text === "첫번째")).toHaveLength(1);
    expect(entries.some((entry) => entry.kind === "user" && entry.text === "두번째")).toBe(true);
    expect(entries.some((entry) => entry.kind === "assistant" && entry.text === "A 답변")).toBe(true);
    expect(entries.some((entry) => entry.kind === "assistant" && entry.text === "B 답변")).toBe(true);
  });

  it("releases offscreen A and B together and keeps both identical replies once per job", async () => {
    const surface = renderAiChatPanel({ clock: () => 37_000 });
    const panel = surface as unknown as FakeElement;
    const firstId = surface.conversationId;
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "첫번째";
    const first = harness.nextAdmitted();
    findByTestId(panel, "ai-send")?.click();
    await first;
    const jobA = harness.lastJob().id;
    input.value = "두번째";
    const second = harness.nextAdmitted();
    findByTestId(panel, "ai-send")?.click();
    await second;
    const jobB = harness.lastJob().id;
    findByTestId(panel, "ai-new-session")?.click();
    await whenAiChatPanelSettled();
    const barrier = harness.holdArtifactReads(2);
    await harness.complete({ assistantText: "같은 답", proposedCalls: [], stoppedReason: "final" }, jobA);
    await harness.complete({ assistantText: "같은 답", proposedCalls: [], stoppedReason: "final" }, jobB);
    await barrier.started;
    barrier.release();
    await barrier.idle;
    await whenAiChatPanelJobResultSettled();
    await harness.complete({ assistantText: "같은 답", proposedCalls: [], stoppedReason: "final" }, jobA);
    await whenAiChatPanelJobResultSettled();
    const log = findByTestId(panel, "ai-chat-log")?.textContent ?? "";
    expect(log).not.toContain("같은 답");
    const entries = (await loadConversation(firstId))?.entries ?? [];
    expect(entries.filter((entry) => entry.kind === "user" && entry.text === "첫번째")).toHaveLength(1);
    expect(entries.filter((entry) => entry.kind === "user" && entry.text === "두번째")).toHaveLength(1);
    expect(entries.filter((entry) => entry.kind === "assistant" && entry.text === "같은 답")).toHaveLength(2);
  });
});
