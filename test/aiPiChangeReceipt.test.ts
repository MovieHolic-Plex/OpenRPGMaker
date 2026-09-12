// Pi 경로의 적용 영수증 — 조수 세션이 남기던 그 카드(지금 → 적용 후)가 Pi 로 옮겨온 배선.
//
// 카드 자체의 렌더는 `aiChangePreview` 테스트가, 명령 내부는 `piAgentCommand` 테스트가 본다.
// 여기서 보는 것은 하나다: **패널이 명령의 영수증 훅을 받아 로그에 카드를 남기는가**.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearConversations } from "@/ai/conversationStore";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { editorState } from "@/editor/editorState";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { runPiCommand, type PiChangeReceipt } from "@/editor/panels/aiPiAgentCommand";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

vi.mock("@/editor/panels/aiPiAgentCommand", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/editor/panels/aiPiAgentCommand")>()),
  runPiCommand: vi.fn(async () => true),
}));

let restoreDom: (() => void) | null = null;

function installFakeLocalStorage(): void {
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
}

beforeEach(() => {
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  vi.mocked(runPiCommand).mockClear();
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  restoreDom = installFakeDom();
  installFakeLocalStorage();
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(defaultAiConfig()));
});

afterEach(async () => {
  teardownAiChatPanel();
  await clearConversations();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function startTurn(panel: FakeElement, text: string): Promise<void> {
  const before = vi.mocked(runPiCommand).mock.calls.length;
  (findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement).value = text;
  findByTestId(panel, "ai-send")?.click();
  await vi.waitFor(() => expect(vi.mocked(runPiCommand).mock.calls.length).toBeGreaterThan(before), { timeout: 2_000, interval: 5 });
}

const lastSurface = () => vi.mocked(runPiCommand).mock.calls.at(-1)?.[1];

describe("Pi 적용 영수증", () => {
  it("턴을 보내면 패널이 영수증 훅을 넘긴다", async () => {
    // Break: 훅이 빠지면 Pi 적용은 보드 발의 한 줄로 끝나고, 사용자는 «무엇이 바뀌었나» 를
    // 그림으로 볼 수 없다 — 세션 경로가 유일하게 갖고 있던 계약(DESIGN.md 「Receipt card」).
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    await startTurn(panel, "집 한 채 지어줘");
    expect(typeof lastSurface()?.showChangeReceipt).toBe("function");
  });

  it("영수증이 오면 지금/적용 후 카드가 로그에 남는다", async () => {
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    await startTurn(panel, "집 한 채 지어줘");
    const project = store.getCurrent();
    const receipt: PiChangeReceipt = {
      before: project,
      after: project,
      mapId: project.startMapId,
      title: "Pi 에이전트 1개 — map_a",
      detail: "적용했습니다 — 에이전트 1개, 툴콜 12회, 바뀐 맵·항목 3개.",
      chips: ["타일 48"],
      toolNames: ["pi_agent"],
    };

    lastSurface()?.showChangeReceipt?.(receipt);

    const card = findByTestId(panel, "ai-change-card");
    expect(card).not.toBeNull();
    expect(card?.querySelector(".ai-change-title")?.textContent).toBe("Pi 에이전트 1개 — map_a");
    expect(card?.querySelector(".ai-change-chip")?.textContent).toBe("타일 48");
    const labels = card?.querySelectorAll(".ai-change-shot-label").map((node) => node.textContent);
    expect(labels).toEqual(["지금", "적용 후"]);
    expect(findByTestId(panel, "ai-change-undo")).not.toBeNull();
  });

  it("맵이 안 바뀐 영수증은 카드를 만들지 않는다", async () => {
    // 칩만 남은 가짜 카드는 "여기를 봐라" 하는 거짓 표시가 된다 — 그릴 영역이 없으면 만들지 않는다.
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    await startTurn(panel, "이벤트가 몇 개지?");
    const project = store.getCurrent();

    lastSurface()?.showChangeReceipt?.({
      before: project,
      after: project,
      mapId: null,
      title: "Pi 에이전트 — 질문",
      detail: "",
      chips: [],
      toolNames: ["pi_agent"],
    });

    expect(findByTestId(panel, "ai-change-card")).toBeNull();
  });
});
