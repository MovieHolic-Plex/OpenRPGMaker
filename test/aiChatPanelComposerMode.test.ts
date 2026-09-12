// 패널 배선: 자율성 다이얼 하나가 Pi 실행 옵션(쓰기 금지·계획만·턴 상한·추론)을 유도한다.
// 예전의 모드 3칩(지시/질문/계획)은 없다 — 「질문」은 다이얼 readonly, 「계획」은 confirm(planOnly).
// 여기서는 `runPiCommand` 를 가로채 **패널이 넘기는 값**만 본다(명령 내부는 piAgentCommandLoop 테스트가 본다).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearConversations } from "@/ai/conversationStore";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig, loadAiConfig, saveAiConfig } from "@/ai/llmClient";
import { editorState } from "@/editor/editorState";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { runPiCommand } from "@/editor/panels/aiPiAgentCommand";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

vi.mock("@/editor/panels/aiPiAgentCommand", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/editor/panels/aiPiAgentCommand")>()),
  runPiCommand: vi.fn(async () => true),
}));

// 의도 선언의 판정만 고정한다 — 나머지(buildIntentFacts·createLlmIntentDeclarer)는 실물을 쓴다.
const intentDecl = vi.hoisted(() => ({ mode: "other" as string, tools: [] as string[], calls: 0 }));
vi.mock("@/ai/intentDeclarationClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ai/intentDeclarationClient")>()),
  declareIntentCached: vi.fn(async () => {
    intentDecl.calls += 1;
    return { intent: { mode: intentDecl.mode, tools: intentDecl.tools }, elapsedMs: 1 } as never;
  }),
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

/** 다이얼을 고른다 — 패널이 저장까지 하는 실제 경로를 그대로 탄다. */
function selectAutonomy(panel: FakeElement, level: string): void {
  const dial = findByTestId(panel, "ai-composer-autonomy");
  if (!dial) throw new Error("ai-composer-autonomy missing");
  dial.value = level;
  dial.dispatchEvent(new Event("change"));
}

/** 전송 한 번 — 호출이 «새로» 일어난 것과 턴이 정산된 것(중단 버튼이 숨은 것)을 둘 다 기다린다. */
async function send(panel: FakeElement, text: string): Promise<void> {
  const before = vi.mocked(runPiCommand).mock.calls.length;
  const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
  input.value = text;
  findByTestId(panel, "ai-send")?.click();
  await vi.waitFor(() => expect(vi.mocked(runPiCommand).mock.calls.length).toBeGreaterThan(before), { timeout: 2_000, interval: 5 });
  await vi.waitFor(() => expect((findByTestId(panel, "ai-abort") as unknown as { hidden?: boolean } | null)?.hidden).toBe(true));
}

const lastCommand = () => vi.mocked(runPiCommand).mock.calls.at(-1)?.[0];
const lastPlan = () => vi.mocked(runPiCommand).mock.calls.at(-1)?.[2];

beforeEach(() => {
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  vi.mocked(runPiCommand).mockClear();
  intentDecl.mode = "other";
  intentDecl.tools = [];
  intentDecl.calls = 0;
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

describe("자율성 다이얼 → Pi 실행 계획", () => {
  it("모드 3칩은 더 이상 존재하지 않는다", () => {
    // Break: 칩이 남아 있으면 같은 노브를 두 컨트롤이 만지고, 둘이 어긋날 때 어느 쪽이
    // 이기는지 사용자가 알 수 없다.
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    expect(findByTestId(panel, "ai-composer-mode")).toBeNull();
    for (const key of ["do", "ask", "plan"]) {
      expect(findByTestId(panel, `ai-composer-mode-${key}`)).toBeNull();
    }
  });

  it("추론 강도 셀렉트도 없다 — 자율성 레벨이 추론을 정한다", () => {
    // Break: 수동 추론 override 가 남아 있으면 다이얼이 저장한 프리셋 값과 갈라진다.
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    expect(findByTestId(panel, "ai-composer-reasoning")).toBeNull();
  });

  it("경로 셀렉트는 없다 — 루프는 Pi 하나다", () => {
    // Break: 셀렉트가 남으면 «조수» 라는 두 번째 루프가 UI 에 살아 있는 것처럼 보인다(세션 deprecated).
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    expect(findByTestId(panel, "ai-composer-route")).toBeNull();
  });

  it("다이얼의 읽기 전용·계획이 Pi 노브로 실린다", async () => {
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    selectAutonomy(panel, "readonly");
    await send(panel, "이벤트가 몇 개지?");
    expect(lastPlan()).toMatchObject({ readOnly: true, planOnly: false, maxTurns: 4 });
    // 확인(계획만)은 쓰기까지 막는다 — 계획을 세우면서 실행하면 그건 계획이 아니다.
    selectAutonomy(panel, "confirm");
    await send(panel, "마을 계획을 세워줘");
    expect(lastPlan()).toMatchObject({ readOnly: true, planOnly: true, maxTurns: 6 });
    expect(lastCommand()?.mode).toBe("single");
  });

  it("팀 비트가 실행 모드를 정하고, 조회 턴은 단독으로 돈다", async () => {
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    saveAiConfig({ ...loadAiConfig(), piTeam: true });
    await send(panel, "집 한 채 지어줘");
    expect(lastCommand()?.mode).toBe("team");
    // 읽기 전용이면 팀을 켜 둬도 단독이다 — 시공·검수 팀원이 아무것도 못 하는 채로 예산만 탄다.
    selectAutonomy(panel, "readonly");
    await send(panel, "이 맵에 뭐가 있지?");
    expect(lastCommand()?.mode).toBe("single");
  });

  it("명시 /pi 는 다이얼보다 세다", async () => {
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    selectAutonomy(panel, "readonly");
    await send(panel, "/pi 집 한 채 지어줘");
    // 사용자가 직접 쓴 명령이다 — 읽기 전용으로 강등하면 아무 일도 일어나지 않는다.
    expect(lastPlan()).toEqual({});
    expect(lastCommand()?.task).toBe("집 한 채 지어줘");
  });


  it("do 레벨의 질문 발화는 읽기 전용으로 승격하고 사용자에게 알린다", async () => {
    // Break: 「균형」에서 "편집하지 마" 질문에 쓰기 툴이 달려 가면 툴 미사용이 모델 선의일 뿐이다.
    intentDecl.mode = "question";
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    await send(panel, "이 맵의 이름과 크기만 알려줘. 편집하지 마.");
    expect(lastPlan()).toMatchObject({ readOnly: true });
    expect(intentDecl.calls).toBeGreaterThan(0);
    // 사용자가 읽기 전용 강등을 모르면 "왜 편집이 안 되지" 가 된다 — 시스템 줄로 알린다.
    expect(findByTestId(panel, "ai-chat-log")?.textContent ?? "").toContain("읽기 전용");
  });

  it("do 레벨의 수정 발화는 승격하지 않는다 — 오판 역방향 사고 방지", async () => {
    // Break: "편집해줘"가 읽기 전용으로 돌면 아무 일도 안 하는 런이 된다.
    intentDecl.mode = "modify";
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    await send(panel, "집 한 채 지어줘");
    expect(lastPlan()).toMatchObject({ readOnly: false, planOnly: false });
  });

  it("쓰기 발화는 의도가 연 도메인만 초기 노출로 싣는다", async () => {
    // modify 선언은 편집 3도메인을 연다 — 나머지는 find_tools·폴백이 실행 중 얹는다.
    intentDecl.mode = "modify";
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    await send(panel, "집 한 채 지어줘");
    expect(lastPlan()?.toolDomains).toEqual(expect.arrayContaining(["core", "tile", "map", "event"]));
  });

  it("선언한 툴의 도메인도 함께 연다", async () => {
    intentDecl.mode = "other";
    intentDecl.tools = ["place_npc"];
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    await send(panel, "NPC 하나 놓아줘");
    expect(lastPlan()?.toolDomains).toEqual(expect.arrayContaining(["core", "event"]));
  });

  it("선언이 빈 손이면 좁힐 근거가 없다 — 전량 노출로 떨어진다", async () => {
    // Break: 신호 없이 좁히면 필요한 툴이 선언에서 빠진 채 시작한다 — 폴백이 있어도 낭비다.
    intentDecl.mode = "other";
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    await send(panel, "이것저것 해줘");
    expect(lastPlan()?.toolDomains).toBeUndefined();
  });

  it("질문 승격 턴은 도메인을 좁히지 않는다 — 읽기는 넓어야 답한다", async () => {
    intentDecl.mode = "question";
    intentDecl.tools = ["place_npc"];
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    await send(panel, "뭐가 있지?");
    expect(lastPlan()).toMatchObject({ readOnly: true });
    expect(lastPlan()?.toolDomains).toBeUndefined();
  });

  it("읽기 전용 다이얼은 분류 호출 자체를 건너뛴다", async () => {
    // Break: 질문 레벨에서도 선언 LLM 을 부르면 발화당 지연·비용이 이중으로 든다.
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    selectAutonomy(panel, "readonly");
    intentDecl.calls = 0;
    await send(panel, "뭐가 있지?");
    expect(intentDecl.calls).toBe(0);
    expect(lastPlan()).toMatchObject({ readOnly: true });
  });

  it("중단처럼 자격과 무관한 실패에는 설정 열기를 붙이지 않는다", async () => {
    vi.mocked(runPiCommand).mockImplementationOnce(async (_command, surface) => {
      surface.appendBubble("system", "Pi 에이전트를 중단했습니다. 적용된 변경은 없습니다.");
      return false;
    });
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    await send(panel, "집 한 채 지어줘");

    expect(findByTestId(panel, "ai-error-open-settings")).toBeNull();
  });
});
