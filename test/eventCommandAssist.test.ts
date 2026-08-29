// test/eventCommandAssist.test.ts
// 이벤트 명령 AI Assist — 순수 로직(프롬프트/파싱·검증/자가수정 루프) + UI(fakeDom 최소 렌더).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildEventAssistPrompt,
  parseAndValidate,
  resolveAssistScope,
  runEventCommandAssist,
} from "@/ai/eventCommandAssist";
import type { AiConfig } from "@/ai/llmClient";
import {
  hasEventAiStagedDraft,
  renderEventAiAssist,
  resetEventAiStagedForTest,
} from "@/editor/panels/eventEditor/aiAssist";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage, Project } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const CONFIG: AiConfig = {
  authMode: "apiKey",
  baseUrl: "https://example.invalid/v1",
  model: "minimax/minimax-m3",
  liteModel: "minimax/minimax-m3",
  apiKey: "sk-test",
  maxToolCalls: 8,
  maxTokens: 2048,
};

function testProject(): Project {
  const project = createBlankProject();
  project.switches[0] = { id: "sw_0001", name: "보물상자 열림" };
  return project;
}

function testPage(commands: Command[] = []): EventPage {
  return {
    id: "page-1",
    name: "EV001",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}

// 보물상자 시나리오의 유효한 커맨드 배열(item_potion/sw_0001은 블랭크 프로젝트에 실존).
const CHEST_COMMANDS: Command[] = [
  {
    kind: "fork",
    condition: { kind: "selfSwitch", key: "A", value: true },
    then: [{ kind: "text", body: "비어 있다" }],
    else: [
      { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 2 },
      { kind: "setSelfSwitch", key: "A", value: true },
    ],
  } as Command,
];

// 호출마다 새 Response를 만들어야 한다(Response body는 1회만 읽힘).
function mockFetchSequence(...contents: string[]): ReturnType<typeof vi.fn> {
  let call = 0;
  const mock = vi.fn(async () => {
    const content = contents[Math.min(call++, contents.length - 1)];
    return new Response(
      JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  });
  (globalThis as unknown as { fetch: unknown }).fetch = mock;
  return mock;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildEventAssistPrompt", () => {
  it("kind 목록·factory 기본값 예시·리소스 id 목록·출력 규약을 포함한다", () => {
    const project = testProject();
    const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId, page: testPage() });

    // kind 목록(레지스트리 파생) + m2Command 제외.
    expect(prompt).toContain("setSelfSwitch");
    expect(prompt).not.toContain('"kind":"m2Command"');
    // newCommand 기본값 자동 직렬화 예시.
    expect(prompt).toContain('{"kind":"changeItem","itemId":"","op":"+=","amount":1}');
    expect(prompt).toContain('runControl action variants: start, advance, end, setFlag, resetRoom');
    expect(prompt).toContain('run condition queries: active, floor, flag, result');
    // 참조 가능한 리소스 id:이름.
    expect(prompt).toContain("item_potion: 회복약");
    expect(prompt).toContain("sw_0001: 보물상자 열림");
    // 출력 규약.
    expect(prompt).toContain("JSON 배열");
  });

  it("AI 저작 표면에서 제외된 명령은 kind 목록과 예시에 노출하지 않는다", () => {
    const project = testProject();
    const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId, page: testPage() });

    expect(prompt).not.toContain('"kind":"m2Command"');
    expect(prompt).not.toContain('"kind":"changeFactionStance"');
    expect(prompt.match(/사용 가능한 kind: ([^\n]+)/u)?.[1]?.split(", ")).not.toContain("changeFactionStance");
  });

  it("기존 페이지 커맨드를 요약에 포함한다", () => {
    const project = testProject();
    const page = testPage([{ kind: "text", body: "안녕하세요" }]);
    const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId, page });
    expect(prompt).toContain("안녕하세요");
  });

  it("기본 scope는 page — 고친 뒤 최종 목록 전체를 요구한다", () => {
    const project = testProject();
    const page = testPage([{ kind: "text", body: "안녕하세요" }]);
    expect(resolveAssistScope(page)).toBe("page");
    const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId, page });
    expect(prompt).toContain("최종 커맨드 JSON 배열");
    expect(prompt).toContain("바꾸지 않을 기존 커맨드도 그대로 다시 포함");
    expect(prompt).toContain("지울 커맨드는 출력에서 빼고");
  });

  it("페이지가 예산을 넘으면 append로 내려가 «기존을 손대지 말라»고 지시한다", () => {
    const project = testProject();
    const long = testPage(Array.from({ length: 400 }, (_, index) => (
      { kind: "text", body: `대사 ${index} ${"가".repeat(40)}` } as Command
    )));
    expect(resolveAssistScope(long)).toBe("append");
    const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId, page: long });
    expect(prompt).toContain("뒤에 붙일 새 커맨드 JSON 배열");
    expect(prompt).toContain("기존 명령은 손대지 말고");
    // 잘린 JSON 을 실어 모델이 깨진 목록을 보는 일이 없어야 한다.
    expect(prompt).not.toContain("…(생략)");
  });

  it("선택 위치를 내부 경로 배열로 싣지 않고 사람 말로 싣는다", () => {
    const project = testProject();
    const page = testPage([
      { kind: "text", body: "인사" },
      { kind: "fork", condition: { kind: "selfSwitch", key: "A", value: true }, then: [] } as Command,
    ]);
    const prompt = buildEventAssistPrompt({
      project,
      mapId: project.startMapId,
      page,
      // fork 의 «조건이 맞을 때» 가지 안쪽 — 음수 센티널이 섞인 내부 인코딩.
      selection: [1, -2, 0],
      selectionLabel: "조건 분기",
    });
    expect(prompt).toContain("「조건 분기」");
    expect(prompt).not.toContain("[1,-2,0]");
    expect(prompt).not.toContain("-2");
  });
});

describe("parseAndValidate", () => {
  it("```json 펜스가 있는 유효 배열을 커맨드로 파싱한다", () => {
    const text = "```json\n" + JSON.stringify(CHEST_COMMANDS) + "\n```";
    const result = parseAndValidate(testProject(), text);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.errors.join(", "));
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].kind).toBe("fork");
  });

  it("AI 저작 표면에서 제외된 명령은 파싱에서도 거부한다", () => {
    const result = parseAndValidate(
      testProject(),
      '[{"kind":"changeFactionStance","a":"guard","b":"player","op":"+=","value":0.25}]',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("AI 저작 표면");
  });

  it("존재하지 않는 itemId는 참조 에러로 거부한다", () => {
    const bad = [{ kind: "changeItem", itemId: "item_ghost", op: "+=", amount: 2 }];
    const result = parseAndValidate(testProject(), JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("참조 에러를 기대했다");
    expect(result.errors.join(" ")).toContain("item_ghost");
  });

  it("알 수 없는 kind는 shape 에러로 거부한다", () => {
    const result = parseAndValidate(testProject(), '[{"kind":"summonDragon"}]');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("shape 에러를 기대했다");
    expect(result.errors.join(" ")).toContain("summonDragon");
  });

  it("JSON 배열이 없으면 에러를 돌려준다", () => {
    const result = parseAndValidate(testProject(), "회복약을 드릴게요!");
    expect(result.ok).toBe(false);
  });
});

describe("runEventCommandAssist 자가수정 루프", () => {
  it("보조 모델(liteModel)로 chatCompletion 요청을 만든다", async () => {
    const fetchMock = mockFetchSequence(JSON.stringify(CHEST_COMMANDS));
    const project = testProject();
    await runEventCommandAssist({
      config: { ...CONFIG, model: "main-model", liteModel: "event-lite-model" },
      prompt: "보물상자",
      context: { project, mapId: project.startMapId, page: testPage() },
    });

    const firstBody = (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body;
    expect(JSON.parse(firstBody).model).toBe("event-lite-model");
  });

  it("정상 JSON이면 1회 시도로 커맨드를 돌려준다", async () => {
    const fetchMock = mockFetchSequence(JSON.stringify(CHEST_COMMANDS));
    const project = testProject();
    const result = await runEventCommandAssist({
      config: CONFIG,
      prompt: "보물상자",
      context: { project, mapId: project.startMapId, page: testPage() },
    });
    expect(result.attempts).toBe(1);
    expect(result.commands[0].kind).toBe("fork");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("1회 불량 JSON이면 에러를 되돌려 재시도해 성공한다", async () => {
    const fetchMock = mockFetchSequence(
      "죄송해요, 커맨드는 이렇습니다: 회복약 2개!",
      JSON.stringify(CHEST_COMMANDS)
    );
    const project = testProject();
    const result = await runEventCommandAssist({
      config: CONFIG,
      prompt: "보물상자",
      context: { project, mapId: project.startMapId, page: testPage() },
    });
    expect(result.attempts).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // 2번째 호출의 요청 본문에 검증 에러 피드백이 포함되어야 한다.
    const secondBody = (fetchMock.mock.calls[1] as unknown as [string, { body: string }])[1].body;
    expect(secondBody).toContain("검증에 실패");
  });

  it("3회 모두 실패하면 마지막 에러로 던진다", async () => {
    mockFetchSequence(
      '[{"kind":"changeItem","itemId":"item_ghost","op":"+=","amount":2}]'
    );
    const project = testProject();
    await expect(
      runEventCommandAssist({
        config: CONFIG,
        prompt: "보물상자",
        context: { project, mapId: project.startMapId, page: testPage() },
      })
    ).rejects.toThrow(/item_ghost/);
  });
});

describe("AI Assist 패널 UI (fakeDom)", () => {
  let restoreFakeDom: () => void = () => undefined;

  beforeEach(() => {
    restoreFakeDom = installFakeDom();
    resetEventAiStagedForTest();
    store.replace(testProject());
  });

  afterEach(() => {
    restoreFakeDom();
  });

  type Harness = {
    readonly panel: FakeElement;
    readonly stagedHost: FakeElement;
    readonly replaced: Command[][];
    readonly page: EventPage;
    readonly eventId: string;
  };

  function renderPanel(apiKey = "sk-test", page: EventPage = testPage()): Harness {
    return renderPanelFor("event-1", apiKey, page);
  }

  function renderPanelFor(eventId: string, apiKey = "sk-test", page: EventPage = testPage()): Harness {
    const cmdList = new FakeElement("div") as unknown as HTMLElement;
    const stagedHost = new FakeElement("div");
    const replaced: Command[][] = [];
    const mapId = store.getCurrent().startMapId;
    const panel = renderEventAiAssist({
      mapId,
      eventId,
      page,
      cmdList,
      stagedHost: stagedHost as unknown as HTMLElement,
      refreshListVisibility: () => undefined,
      replaceAll: (commands) => void replaced.push(structuredClone(commands) as Command[]),
      loadConfig: () => ({ ...CONFIG, apiKey }),
    }) as unknown as FakeElement;
    return { panel, stagedHost, replaced, page, eventId };
  }

  async function generate(harness: Harness, prompt: string): Promise<void> {
    findByTestId(harness.panel, "ai-event-input")!.value = prompt;
    findByTestId(harness.panel, "ai-event-generate")!.click();
    await vi.waitFor(() => expect(findByTestId(harness.panel, "ai-event-result")!.hidden).toBe(false));
  }

  it("같은 ids를 가진 다른 프로젝트로 바꾸면 초안과 열린 상태를 공유하지 않는다", () => {
    const panelA = renderPanelFor("shared-event").panel;
    const inputA = findByTestId(panelA, "ai-event-input")!;
    inputA.value = "Project A private draft";
    inputA.dispatchEvent(new Event("input"));
    (panelA as unknown as HTMLDetailsElement).open = true;
    panelA.dispatchEvent(new Event("toggle"));

    const projectB = createBlankProject();
    store.replaceProject(projectB);
    const panelB = renderPanelFor("shared-event").panel;

    expect(findByTestId(panelB, "ai-event-input")!.value).toBe("");
    expect((panelB as unknown as HTMLDetailsElement).open).toBe(false);
  });

  it("프롬프트 입력과 생성 상태, 결과 영역을 보이는 레이블로 연결한다", () => {
    const { panel } = renderPanel();

    const input = findByTestId(panel, "ai-event-input")!;
    const promptLabel = findByTestId(panel, "ai-event-prompt-label")!;
    const status = findByTestId(panel, "ai-event-status")!;
    const result = findByTestId(panel, "ai-event-result")!;
    const resultTitle = findByTestId(panel, "ai-event-result-title")!;

    expect(promptLabel.tagName).toBe("LABEL");
    expect(promptLabel.getAttribute("for")).toBe(input.getAttribute("id"));
    expect(status.getAttribute("role")).toBe("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(result.getAttribute("role")).toBe("region");
    expect(result.getAttribute("aria-labelledby")).toBe(resultTitle.getAttribute("id"));
    expect(result.hidden).toBe(true);
  });

  it("초안은 도크 카드가 아니라 목록 자리(stagedHost)에 유령 행으로 그려진다", async () => {
    mockFetchSequence(JSON.stringify(CHEST_COMMANDS));
    const harness = renderPanel();
    expect(findByTestId(harness.panel, "ai-event-assist")).not.toBeNull();

    await generate(harness, "보물상자: 열면 회복약 2개");

    const staged = findByTestId(harness.stagedHost, "ai-event-staged")!;
    expect(staged.textContent).toContain("조건 분기");
    expect(staged.textContent).toContain("비어 있다");
    // 새로 생기는 행은 add 로 표시된다.
    expect(findByTestId(harness.stagedHost, "ai-event-staged-row-add")).not.toBeNull();
    // 초안이 있는 동안 content.ts 는 목록 대신 초안을 보여야 한다.
    expect(hasEventAiStagedDraft(store.getCurrent().startMapId, "event-1", "page-1")).toBe(true);
  });

  it("적용은 목록 전체 교체 한 번이다 — 되돌리기 스냅샷이 한 칸만 쌓인다", async () => {
    mockFetchSequence(JSON.stringify(CHEST_COMMANDS));
    const harness = renderPanel();
    await generate(harness, "보물상자");

    findByTestId(harness.panel, "ai-event-apply")!.click();

    // 명령 3개를 만들었어도 replaceAll 은 딱 한 번(예전에는 insertCommand 를 개수만큼 불렀다).
    expect(harness.replaced).toHaveLength(1);
    expect(harness.replaced[0]).toHaveLength(1);
    expect(harness.replaced[0][0].kind).toBe("fork");
    expect(findByTestId(harness.panel, "ai-event-result")!.hidden).toBe(true);
    expect(harness.panel.textContent).toContain("↶ 되돌리기 한 번");
  });

  it("기존 명령이 있는 페이지에서 «고쳐 달라»고 하면 덧붙이지 않고 바뀜으로 표시한다", async () => {
    // 모델이 최종 목록을 돌려준다: 대사 문구만 달라졌다.
    mockFetchSequence(JSON.stringify([{ kind: "text", body: "낡은 상자다" }]));
    const page = testPage([{ kind: "text", body: "상자다" }]);
    const harness = renderPanel("sk-test", page);

    await generate(harness, "대사를 «낡은 상자다»로 고쳐 줘");

    // 예전 계약(삽입)이면 명령이 2개가 됐다. 이제는 1개가 «바뀜» 으로 표시된다.
    expect(findByTestId(harness.stagedHost, "ai-event-staged-row-change")).not.toBeNull();
    expect(findByTestId(harness.stagedHost, "ai-event-staged-row-add")).toBeNull();

    findByTestId(harness.panel, "ai-event-apply")!.click();
    expect(harness.replaced[0]).toHaveLength(1);
    expect(harness.replaced[0][0]).toMatchObject({ kind: "text", body: "낡은 상자다" });
  });

  it("행마다 «이건 빼기»로 골라 적용할 수 있다", async () => {
    mockFetchSequence(JSON.stringify([
      { kind: "text", body: "안녕" },
      { kind: "text", body: "새 대사" },
    ]));
    const page = testPage([{ kind: "text", body: "안녕" }]);
    const harness = renderPanel("sk-test", page);

    await generate(harness, "대사 한 줄 더 붙여 줘");
    const addRow = findByTestId(harness.stagedHost, "ai-event-staged-row-add")!;
    const toggle = findByTestId(addRow, `ai-event-staged-toggle-${addRow.dataset.stagedId}`)!;
    toggle.click();

    // 전부 뺐으므로 적용할 것이 없다.
    expect(findByTestId(harness.panel, "ai-event-result-meta")!.textContent).toContain("모두 뺐어요");
    expect((findByTestId(harness.panel, "ai-event-apply") as unknown as HTMLButtonElement).disabled).toBe(true);
  });

  it("취소를 누르면 초안만 지우고 목록을 건드리지 않는다", async () => {
    mockFetchSequence(JSON.stringify(CHEST_COMMANDS));
    const harness = renderPanel();
    await generate(harness, "보물상자");

    findByTestId(harness.panel, "ai-event-discard")!.click();
    expect(findByTestId(harness.panel, "ai-event-result")!.hidden).toBe(true);
    expect(harness.replaced).toHaveLength(0);
    expect(hasEventAiStagedDraft(store.getCurrent().startMapId, "event-1", "page-1")).toBe(false);
  });

  it("연결이 안 됐으면 연결 방식을 완료하라고 안내한다", () => {
    const { panel } = renderPanel("");
    findByTestId(panel, "ai-event-input")!.value = "보물상자";
    findByTestId(panel, "ai-event-generate")!.click();
    // 옛 문구는 "API 키와 baseUrl을 입력하세요" 였다 — 그 두 입력은 설정 모달에서 걷었고
    // 자격은 동반 서비스가 보관한다. 없는 입력을 가리키는 안내를 남기지 않는다.
    expect(panel.textContent).toContain("연결 방식");
    expect(panel.textContent).not.toContain("baseUrl");
  });

  it("ChatGPT 모드(apiKey 없음)에서는 생성을 막지 않고 초안을 보여준다", async () => {
    mockFetchSequence(JSON.stringify(CHEST_COMMANDS));
    const cmdList = new FakeElement("div") as unknown as HTMLElement;
    const stagedHost = new FakeElement("div");
    const mapId = store.getCurrent().startMapId;
    const panel = renderEventAiAssist({
      mapId,
      eventId: "event-1",
      page: testPage(),
      cmdList,
      stagedHost: stagedHost as unknown as HTMLElement,
      refreshListVisibility: () => undefined,
      replaceAll: () => undefined,
      loadConfig: () => ({ ...CONFIG, authMode: "chatgpt", apiKey: "", baseUrl: "/v1" }),
    }) as unknown as FakeElement;
    findByTestId(panel, "ai-event-input")!.value = "보물상자";
    findByTestId(panel, "ai-event-generate")!.click();
    await vi.waitFor(() => {
      expect(findByTestId(panel, "ai-event-result")!.hidden).toBe(false);
      expect(stagedHost.textContent).toContain("조건 분기");
    });
    expect(panel.textContent).not.toContain("API 키");
    // 후속 테스트가 동일 panelState 키를 공유하므로 초안을 정리한다.
    findByTestId(panel, "ai-event-discard")!.click();
  });

  it("존재하지 않는 itemId만 계속 돌아오면 에러를 표시한다", async () => {
    mockFetchSequence(
      '[{"kind":"changeItem","itemId":"item_ghost","op":"+=","amount":2}]'
    );
    const harness = renderPanel();
    findByTestId(harness.panel, "ai-event-input")!.value = "유령 아이템";
    findByTestId(harness.panel, "ai-event-generate")!.click();

    await vi.waitFor(() => expect(harness.panel.textContent).toContain("item_ghost"));
    expect(findByTestId(harness.panel, "ai-event-result")!.hidden).toBe(true);
    expect(harness.replaced).toHaveLength(0);
  });
});
