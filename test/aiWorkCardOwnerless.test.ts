// 작업 카드가 «진행 중» 이라고 말해도 되는 조건 — 끝내 줄 턴이 있을 때만이다.
//
// 턴이 끝난 뒤 도착한 진행 알림도 `ensureWorkCard()` 를 탄다. 그때 만들어진 카드는
// `finishWorkCard` 가 다시 오지 않아 영영 `data-state=running` 으로 남고, 유휴 화면에
// 「작업 중」과 **누르면 아무 일도 없는 중지 버튼**을 띄운다.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { clearConversations } from "@/ai/conversationStore";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { editorState } from "@/editor/editorState";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { runPiCommand } from "@/editor/panels/aiPiAgentCommand";
import { resetAiWorkStripForTest } from "@/editor/panels/aiWorkStrip";
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
  resetAiWorkStripForTest();
  await clearConversations();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

type LateSurface = { appendProcess?: (text: string) => void };

const cards = (panel: FakeElement): FakeElement[] => panel.querySelectorAll("[data-testid=ai-work-card]");
const settle = async (): Promise<void> => { for (let i = 0; i < 40; i += 1) await new Promise((r) => setTimeout(r, 10)); };

/** 턴 하나를 돌리고, 명령이 받은 표면(늦은 콜백용)을 돌려준다. */
async function runTurn(panel: FakeElement): Promise<LateSurface> {
  let surfaceRef: LateSurface | undefined;
  vi.mocked(runPiCommand).mockImplementationOnce(async (_command, surface) => {
    surface.appendProcess?.("진행 중 알림");
    surfaceRef = surface as unknown as LateSurface;
    return true;
  });
  const before = vi.mocked(runPiCommand).mock.calls.length;
  (findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement).value = "집 한 채 지어줘";
  findByTestId(panel, "ai-send")?.click();
  await vi.waitFor(() => expect(vi.mocked(runPiCommand).mock.calls.length).toBeGreaterThan(before), { timeout: 2_000, interval: 5 });
  await settle();
  return surfaceRef!;
}

it("턴이 끝나면 그 턴의 카드는 결과 카드가 된다 — 중지 버튼도 사라진다", async () => {
  const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;

  await runTurn(panel);

  const [card] = cards(panel);
  expect(card?.getAttribute("data-state")).toBe("done");
  expect(card?.querySelectorAll("button").map((b) => b.textContent)).not.toContain("중지");
});

it("턴이 끝난 뒤 온 알림은 「작업 중」 카드를 만들지 않는다", async () => {
  const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
  const late = await runTurn(panel);

  late.appendProcess?.("늦게 온 알림");
  await settle();

  // 내용은 남되(기록을 버리지 않는다) 진행 중이라고 말하지 않는다.
  const all = cards(panel);
  expect(all.map((c) => c.textContent ?? "").join("\n")).toContain("늦게 온 알림");
  for (const card of all) {
    expect(card.getAttribute("data-state"), "끝난 뒤에는 어떤 카드도 진행 중이 아니다").not.toBe("running");
    expect(card.querySelectorAll("button").map((b) => b.textContent)).not.toContain("중지");
  }
});
