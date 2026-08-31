// 조수 패널 모던 셸 계약: 대화 유무를 패널 상태 속성으로 노출하고, 빈 화면의 시작 추천은
// 컴포저 칩(`ai-composer-chip-*`)으로 낸다. 이 두 값이 CSS 레이아웃의 입력이다.
// (갑갑한 패널 재디자인 — 빈 로그 껍데기 접기 + 시작 블록 중앙 정렬이 이 속성에 걸려 있다.)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { directorStartPrompts, readAgentBrief } from "@/editor/panels/aiAgentBrief";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { editorState } from "@/editor/editorState";
import { saveConversation, conversationScopeKey } from "@/ai/conversationStore";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

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

function renderPanel(): FakeElement {
  return renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
}

beforeEach(() => {
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  restoreDom = installFakeDom();
  installFakeLocalStorage();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// 도크 축 삭제(float 단일) — `ai-authoring-examples` 4칩 격자는 glass/side 전용 표면이었다.
// 같은 추천을 컴포저 칩 3개가 내므로 그쪽 계약으로 뒤집었다.
describe("조수 패널 모던 셸", () => {
  it("대화가 비어 있으면 패널이 empty 대화 상태를 노출한다", () => {
    const panel = renderPanel();

    // CSS 가 빈 로그 껍데기(.ai-glass-log/.ai-history-log-mount)를 접고 시작 블록을
    // 가운데로 올리는 유일한 훅이다. 클래스 목록이 아니라 상태 속성으로 읽는다.
    expect(panel.dataset.aiConversation).toBe("empty");
  });

  it("시작 추천은 추천 팝오버 한 곳에 모인다 — 감독 칩 3개 + 저작 예제 6개", () => {
    // Break: 추천이 두 군데(팝오버 + 카드 본문)로 갈라지거나, 컴포저 칩이 비어
    // 빈 화면에 아무 진입점도 남지 않는다.
    const panel = renderPanel();
    const expected = directorStartPrompts(readAgentBrief());
    const chipsHost = findByTestId(panel, "ai-composer-chips");
    const chips = chipsHost?.querySelectorAll("button") ?? [];
    const popover = findByTestId(panel, "ai-suggest-popover");

    // 저작 예제 카드는 없어지지 않았다 — 유리 카드 본문에서 이 팝오버로 이사했다.
    const examples = findByTestId(panel, "ai-authoring-examples");
    expect(examples).toBeTruthy();
    expect(popover?.contains(examples!)).toBe(true);
    expect(popover?.contains(chipsHost!)).toBe(true);
    expect(examples?.querySelectorAll(".ai-authoring-example-chip").length).toBe(6);
    expect(expected.length).toBe(3);
    expect(chips.length).toBe(expected.length);
    expect(chips.map((chip) => chip.dataset.testid)).toEqual(
      expected.map((prompt) => `ai-composer-chip-${prompt.id}`),
    );
    expect(chipsHost?.hidden).toBe(false);
  });

  it("복원된 대화가 있으면 active 다 — 턴 행 testid 가 없다고 로그를 수집하면 안 된다", () => {
    saveConversation({
      id: "conv_shell",
      title: "마을",
      model: "m",
      savedAt: 100,
      projectContextKey: conversationScopeKey(store.getProjectIdentity(), store.getCurrent()),
      entries: [
        { kind: "user", text: "마을 만들어줘" },
        { kind: "assistant", text: "초안을 준버했습니다." },
      ],
    });

    const panel = renderPanel();

    expect(panel.dataset.aiConversation).toBe("active");
  });
});
