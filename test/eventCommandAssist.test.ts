// test/eventCommandAssist.test.ts
// 이벤트 명령 AI Assist — 순수 로직(프롬프트/파싱·검증/자가수정 루프) + UI(fakeDom 최소 렌더).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildEventAssistPrompt, parseAndValidate, runEventCommandAssist } from "@/ai/eventCommandAssist";
import type { AiConfig } from "@/ai/llmClient";
import { renderEventAiAssist } from "@/editor/panels/eventEditor/aiAssist";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage, Project } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const CONFIG: AiConfig = {
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
    // 참조 가능한 리소스 id:이름.
    expect(prompt).toContain("item_potion: 회복약");
    expect(prompt).toContain("sw_0001: 보물상자 열림");
    // 출력 규약.
    expect(prompt).toContain("JSON 배열");
  });

  it("기존 페이지 커맨드를 요약에 포함한다", () => {
    const project = testProject();
    const page = testPage([{ kind: "text", body: "안녕하세요" }]);
    const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId, page });
    expect(prompt).toContain("안녕하세요");
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
    store.replace(testProject());
  });

  afterEach(() => {
    restoreFakeDom();
  });

  function recordingActions(): { actions: CommandListActions; added: Command[]; inserted: { path: readonly number[]; command: Command }[] } {
    const added: Command[] = [];
    const inserted: { path: readonly number[]; command: Command }[] = [];
    const actions: CommandListActions = {
      addCommand: (_containerPath, command) => void added.push(command),
      insertCommand: (path, command) => void inserted.push({ path, command }),
      replaceCommand: () => undefined,
      deleteCommand: () => undefined,
      moveCommand: () => undefined,
      moveCommandTo: () => undefined,
    };
    return { actions, added, inserted };
  }

  function renderPanel(actions: CommandListActions, apiKey = "sk-test"): FakeElement {
    const cmdList = new FakeElement("div") as unknown as HTMLElement;
    const mapId = store.getCurrent().startMapId;
    return renderEventAiAssist({
      mapId,
      eventId: "event-1",
      page: testPage(),
      actions,
      cmdList,
      loadConfig: () => ({ ...CONFIG, apiKey }),
    }) as unknown as FakeElement;
  }

  it("생성 → 프리뷰 → 삽입 → 프리뷰 정리 흐름이 동작한다", async () => {
    mockFetchSequence(JSON.stringify(CHEST_COMMANDS));
    const { actions, added } = recordingActions();
    const panel = renderPanel(actions);

    expect(findByTestId(panel, "ai-event-assist")).not.toBeNull();
    const input = findByTestId(panel, "ai-event-input")!;
    input.value = "보물상자: 열면 회복약 2개";
    findByTestId(panel, "ai-event-generate")!.click();

    await vi.waitFor(() => {
      const preview = findByTestId(panel, "ai-event-preview")!;
      expect(preview.hidden).toBe(false);
      expect(preview.textContent).toContain("조건 분기");
      expect(preview.textContent).toContain("비어 있다");
    });

    // 선택이 없으므로 addCommand(페이지 끝)로 삽입된다.
    findByTestId(panel, "ai-event-insert")!.click();
    expect(added).toHaveLength(1);
    expect(added[0].kind).toBe("fork");
    expect(findByTestId(panel, "ai-event-preview")!.hidden).toBe(true);
  });

  it("버리기를 누르면 프리뷰만 지우고 삽입하지 않는다", async () => {
    mockFetchSequence(JSON.stringify(CHEST_COMMANDS));
    const { actions, added, inserted } = recordingActions();
    const panel = renderPanel(actions);
    findByTestId(panel, "ai-event-input")!.value = "보물상자";
    findByTestId(panel, "ai-event-generate")!.click();
    await vi.waitFor(() => expect(findByTestId(panel, "ai-event-preview")!.hidden).toBe(false));

    findByTestId(panel, "ai-event-discard")!.click();
    expect(findByTestId(panel, "ai-event-preview")!.hidden).toBe(true);
    expect(added).toHaveLength(0);
    expect(inserted).toHaveLength(0);
  });

  it("API 키가 없으면 설정 안내를 표시한다", () => {
    const { actions } = recordingActions();
    const panel = renderPanel(actions, "");
    findByTestId(panel, "ai-event-input")!.value = "보물상자";
    findByTestId(panel, "ai-event-generate")!.click();
    expect(panel.textContent).toContain("AI 설정에서 API 키를 입력하세요");
  });

  it("존재하지 않는 itemId만 계속 돌아오면 에러를 표시한다", async () => {
    mockFetchSequence(
      '[{"kind":"changeItem","itemId":"item_ghost","op":"+=","amount":2}]'
    );
    const { actions, added } = recordingActions();
    const panel = renderPanel(actions);
    findByTestId(panel, "ai-event-input")!.value = "유령 아이템";
    findByTestId(panel, "ai-event-generate")!.click();

    await vi.waitFor(() => expect(panel.textContent).toContain("item_ghost"));
    expect(findByTestId(panel, "ai-event-preview")!.hidden).toBe(true);
    expect(added).toHaveLength(0);
  });
});
