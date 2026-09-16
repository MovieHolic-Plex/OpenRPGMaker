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
// wait 는 «분류 창을 붙잡아 두는» 게이트다 — 그 구간의 패널 상태를 관측하려면 분류가 끝나면 안 된다.
const intentDecl = vi.hoisted(() => ({
  mode: "other" as string, source: "llm", needsPlan: false, clarify: null as string | null,
  error: undefined as string | undefined, calls: 0, wait: null as Promise<void> | null,
}));
vi.mock("@/ai/intentDeclarationClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ai/intentDeclarationClient")>()),
  declareIntentCached: vi.fn(async () => {
    intentDecl.calls += 1;
    if (intentDecl.wait) await intentDecl.wait;
    return {
      intent: { mode: intentDecl.mode, source: intentDecl.source, needsPlan: intentDecl.needsPlan, clarify: intentDecl.clarify },
      error: intentDecl.error, elapsedMs: 1,
    } as never;
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
  intentDecl.calls = 0;
  intentDecl.error = undefined; intentDecl.source = "llm"; intentDecl.needsPlan = false; intentDecl.clarify = null;
  intentDecl.wait = null;
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

  it.each([
    ["modify", "llm", false, null, true],
    ["modify", "llm", true, null, false],
    ["modify", "fallback", false, null, false],
    ["create", "llm", false, null, false],
    ["modify", "llm", false, "어느 집인가요?", false],
  ] as const)("기존 의도 판정을 재사용한다: %s/%s/plan=%s/clarify=%s", async (mode, source, needsPlan, clarify, routineEdit) => {
    Object.assign(intentDecl, { mode, source, needsPlan, clarify });
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    await send(panel, "맵 이름을 숲길로 바꿔줘");
    expect(lastPlan()).toMatchObject({ routineEdit });
    expect(intentDecl.calls).toBe(1);
  });

  it("의도는 수정이어도 분류·감사 오류가 있으면 기존 절차를 유지한다", async () => {
    intentDecl.mode = "modify";
    intentDecl.error = "Request coverage extraction failed";
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    await send(panel, "맵 이름을 숲길로 바꿔줘");
    expect(lastPlan()).toMatchObject({ routineEdit: false });
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

// 2026-09-16 실측 회귀: 의도 분류(plainPiTurn, 최대 6s)가 끝난 뒤에야 turnBusy 가 서서, 그 구간에
// 브리지는 turnBusy=false·전송 버튼은 활성으로 보였고(실측 1.2s~7.5s) 그 창에서 들어온 두 번째 전송은
// input.value="" 를 지난 뒤 가드에 걸려 «입력만 비워진 채» 거부됐다 — 지시가 사라졌다.
describe("의도 분류 구간의 턴 상태와 입력 보존", () => {
  it("분류 중에는 전송이 잠기고, 그 창의 두 번째 지시는 입력을 남긴 채 거부된다", async () => {
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    const sendButton = findByTestId(panel, "ai-send") as unknown as { disabled?: boolean; click: () => void };

    // 분류를 붙잡아 둔다 — 이 창이 관측 대상이다.
    let release!: () => void;
    intentDecl.wait = new Promise<void>((resolve) => { release = resolve; });

    input.value = "집 한 채 지어줘";
    sendButton.click();
    await vi.waitFor(() => expect(intentDecl.calls).toBe(1), { timeout: 2_000, interval: 5 });

    // Break: 여기서 disabled 가 false 면 «턴이 도는데 유휴로 보이는» 창이 다시 생긴다.
    expect(sendButton.disabled).toBe(true);

    input.value = "그리고 우물도 파줘";
    sendButton.click();
    await vi.waitFor(() => expect(sendButton.disabled).toBe(true), { timeout: 2_000, interval: 5 });

    // Break: 예전에는 이 자리에서 입력창이 비워져 사용자가 다시 타이핑해야 했다.
    expect(input.value).toBe("그리고 우물도 파줘");
    // 거부는 «실행하지 않음» 까지 포함한다 — 두 번째 턴이 시작되면 안 된다.
    expect(vi.mocked(runPiCommand).mock.calls.length).toBe(0);

    release();
    await vi.waitFor(() => expect(vi.mocked(runPiCommand).mock.calls.length).toBe(1), { timeout: 2_000, interval: 5 });
  });

  it("분류가 실패해도 턴 슬롯은 풀린다 (패널이 영구히 잠기지 않는다)", async () => {
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    intentDecl.wait = Promise.reject(new Error("분류 실패"));
    intentDecl.wait.catch(() => {});
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    const sendButton = findByTestId(panel, "ai-send") as unknown as { disabled?: boolean; click: () => void };

    input.value = "집 한 채 지어줘";
    sendButton.click();

    await vi.waitFor(() => expect(sendButton.disabled).toBe(false), { timeout: 2_000, interval: 5 });
  });
});
