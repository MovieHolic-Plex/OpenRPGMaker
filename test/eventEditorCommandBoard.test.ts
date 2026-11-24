/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as assistantBridge from "@/editor/aiAssistantBridge";
import type { Command } from "@/project/types";
import { editorState } from "@/editor/editorState";
import { resetEventAiStagedForTest } from "@/editor/panels/eventEditor/aiAssist";
import { eventEditLineChangedPaths, resetEventEditLineForTest } from "@/editor/panels/eventEditor/eventEditLine";
import { clearCommandInspector } from "@/editor/panels/eventEditor/commandInspector";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

const EVENT_ID = "ev_command_board";
const NESTED_EVENT_ID = "ev_command_board_nested";

function seedProject(): string {
  const project = createBlankProject();
  const mapId = project.startMapId;
  project.maps[mapId]!.events = [
    {
      id: EVENT_ID,
      x: 4,
      y: 5,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: "p1",
          name: "안내인",
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          overlapForbidden: true,
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [
            { kind: "text", body: "어서 오세요." },
            { kind: "loop", body: [] },
          ],
        },
      ],
    },
  ];
  store.replace(project);
  editorState.set({ currentMapId: mapId, selectedEventId: EVENT_ID, selectedEventPageId: "p1" });
  return mapId;
}

function seedNestedProject(): string {
  const project = createBlankProject();
  const mapId = project.startMapId;
  project.maps[mapId]!.events = [
    {
      id: NESTED_EVENT_ID,
      x: 4,
      y: 5,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: "p1",
          name: "분기 있는 페이지",
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [
            { kind: "text", body: "어서 오세요." },
            {
              kind: "choices",
              prompt: "도와줄러?",
              options: [
                { text: "예", branch: [{ kind: "text", body: "고마워." }, { kind: "text", body: "가자." }] },
                { text: "아니오", branch: [{ kind: "text", body: "알았어." }] },
              ],
            },
            { kind: "text", body: "끝." },
          ],
        },
      ],
    },
  ];
  store.replace(project);
  editorState.set({ currentMapId: mapId, selectedEventId: NESTED_EVENT_ID, selectedEventPageId: "p1" });
  return mapId;
}

function mockDraft(mapId: string, commands: Command[]): void {
  const before = store.getCurrent();
  const after = structuredClone(before);
  after.maps[mapId]!.events[0]!.pages![0]!.commands = commands;
  vi.spyOn(assistantBridge, "sendAiAssistantMessage").mockResolvedValue({
    ok: true,
    pendingProposal: { before, after, callCount: 1, summary: "초안" },
    status: assistantBridge.getAiAssistantStatus(),
    audit: [],
    harness: null,
  });
}

describe("event editor command board", () => {
  let host: HTMLElement;

  beforeEach(() => {
    resetEventAiStagedForTest();
    resetEventEditLineForTest();
    clearCommandInspector();
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearCommandInspector();
    document.body.replaceChildren();
  });

  // 옛 계약: 개수와 뷰 토글을 페이지바의 `event-command-header` 칩에 올렸다. a87ab4fc 가 크롬을
  // 접으면서 그 헤더를 없앴고(헤더에 짐을 얹으면 상단이 잘렸다), 7a7ce6ae 가 개수의 집을 명령
  // 칼럼 라벨로 확정했다. 페이지바는 이제 페이지 선택만 갖는다.
  it("keeps the command count in the commands column label and the view toggle in the canvas", () => {
    const mapId = seedProject();
    renderEventEditorDynamic(host, mapId, EVENT_ID);

    const pagebar = host.querySelector<HTMLElement>(".event-editor-pagebar");
    const commandsLabel = host.querySelector<HTMLElement>('[data-testid="event-editor-column-label-commands"]');
    const count = host.querySelector<HTMLElement>('[data-testid="event-editor-command-count"]');
    const contents = host.querySelector<HTMLElement>('[data-testid="event-script-canvas"]');

    expect(commandsLabel?.contains(count)).toBe(true);
    expect(count?.textContent).toBe("2개");
    expect(contents?.querySelector('[data-testid="event-view-toggle-list"]')).toBeTruthy();
    expect(contents?.querySelector('[data-testid="event-view-toggle-storyboard"]')).toBeTruthy();
    // 페이지바는 개수도 토글도 다시 가져가지 않는다 — 그게 상단 잘림의 원인이었다.
    expect(pagebar?.querySelector('[data-testid="event-editor-command-count"]')).toBeNull();
    expect(pagebar?.querySelector('[data-testid="event-view-toggle-list"]')).toBeNull();
    expect(contents?.getAttribute("aria-label")).toBe("이 페이지가 하는 일");
    expect(contents?.querySelector(".event-contents-legend")).toBeNull();
  });

  it("adds readable category badges in addition to category color", () => {
    const mapId = seedProject();
    renderEventEditorDynamic(host, mapId, EVENT_ID);

    const dialogue = host.querySelector<HTMLElement>('[data-testid="event-command-text"]');
    const flow = host.querySelector<HTMLElement>('[data-testid="event-command-loop"]');
    const dialogueBadge = dialogue?.querySelector<HTMLElement>(".cmd-cat-icon");
    const flowBadge = flow?.querySelector<HTMLElement>(".cmd-cat-icon");

    expect(dialogue?.dataset.commandCategory).toBe("dialogue");
    expect(flow?.dataset.commandCategory).toBe("flow");
    expect(dialogueBadge?.dataset.label).toBe("대화");
    expect(flowBadge?.dataset.label).toBe("흐름");
    expect(dialogueBadge?.title).toBe("대화 명령");
    expect(flowBadge?.title).toBe("흐름 명령");
  });

  // 칼럼 라벨은 «위에서 아래로 차례대로 실행됩니다» 를 약속하면서 순서를 화면에 적지
  // 않았다. 번호는 자기 컨테이너 안에서 1 부터 다시 시작하고, 분기 범위는 분기 헤더 줄이 말한다.
  it("numbers every command row in execution order, restarting inside each branch", () => {
    const mapId = seedNestedProject();
    renderEventEditorDynamic(host, mapId, NESTED_EVENT_ID);

    const steps = [...host.querySelectorAll<HTMLElement>(".cmd-list .cmd-item > .cmd-head > .cmd-step")]
      .map((node) => node.textContent);

    expect(steps).toEqual(["1", "2", "1", "2", "1", "3"]);
    expect([...host.querySelectorAll<HTMLElement>(".cmd-step")].every((node) => node.getAttribute("aria-hidden") === "true"))
      .toBe(true);
    expect([...host.querySelectorAll<HTMLElement>(".cmd-step")].every((node) => !node.hasAttribute("aria-label")))
      .toBe(true);
  });

  // 분기 마커 줄이 아니라 실제 Command 객체를 세되, 분기 안의 명령은 빠뜨리지 않는다.
  it("counts authored commands including commands nested inside branches", () => {
    const mapId = seedNestedProject();
    renderEventEditorDynamic(host, mapId, NESTED_EVENT_ID);

    const rows = host.querySelectorAll(".cmd-list .cmd-item").length;
    const count = host.querySelector<HTMLElement>('[data-testid="event-editor-command-count"]');

    expect(rows).toBe(6);
    expect(count?.textContent).toBe("6개");
    expect(count?.title).toBe("작성한 명령 6개 (분기 안 명령 포함)");
    expect(count?.getAttribute("aria-label")).toBe("작성한 명령 6개, 분기 안 명령 포함");
  });

  it("applies a one-line edit at once, marks the changed row, and undoes it step by step", async () => {
    const mapId = seedNestedProject();
    const page = store.getCurrent().maps[mapId]!.events[0]!.pages![0]!;
    page.commands = [{ kind: "text", body: "A" }, { kind: "text", body: "B" }];
    store.replace(structuredClone(store.getCurrent()));
    mockDraft(mapId, [{ kind: "text", body: "B" }]);

    renderEventEditorDynamic(host, mapId, NESTED_EVENT_ID);
    const input = host.querySelector<HTMLInputElement>('[data-testid="event-edit-line-input"]')!;
    input.value = "첫 대사를 지워 줘";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    const live = () => store.getCurrent().maps[mapId]!.events[0]!.pages![0]!.commands;
    await vi.waitFor(() => expect(live()).toEqual([{ kind: "text", body: "B" }]));
    expect(eventEditLineChangedPaths(mapId, NESTED_EVENT_ID, "p1").has("[0]")).toBe(true);

    const fresh = document.createElement("div");
    document.body.append(fresh);
    renderEventEditorDynamic(fresh, mapId, NESTED_EVENT_ID);
    expect(fresh.querySelector('[data-testid="event-edit-line-summary"]')?.textContent).toContain("1줄 지움");
    const undo = fresh.querySelector<HTMLButtonElement>('[data-testid="event-edit-line-undo"]')!;
    expect(undo.hidden).toBe(false);
    expect(undo.textContent).toContain("1");
    undo.click();
    expect(live()).toEqual([{ kind: "text", body: "A" }, { kind: "text", body: "B" }]);
  });

  it("changes nothing and says why when the draft reaches outside this event", async () => {
    const mapId = seedNestedProject();
    const before = store.getCurrent();
    const after = structuredClone(before);
    after.maps[mapId]!.events[0]!.pages![0]!.commands = [];
    after.maps[mapId]!.name = "다른 이름";
    vi.spyOn(assistantBridge, "sendAiAssistantMessage").mockResolvedValue({
      ok: true,
      pendingProposal: { before, after, callCount: 1, summary: "초안" },
      status: assistantBridge.getAiAssistantStatus(),
      audit: [],
      harness: null,
    });
    renderEventEditorDynamic(host, mapId, NESTED_EVENT_ID);
    const input = host.querySelector<HTMLInputElement>('[data-testid="event-edit-line-input"]')!;
    input.value = "다 지워";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    const summary = host.querySelector<HTMLElement>('[data-testid="event-edit-line-summary"]')!;
    await vi.waitFor(() => expect(summary.textContent).toContain("못 고쳤어요"));
    expect(store.getCurrent().maps[mapId]!.events[0]!.pages![0]!.commands).toHaveLength(3);
    expect(store.getCurrent().maps[mapId]!.name).toBe(before.maps[mapId]!.name);
  });

  it("opens the command picker from a single click on the append affordance", () => {
    const mapId = seedProject();
    renderEventEditorDynamic(host, mapId, EVENT_ID);

    const append = host.querySelector<HTMLElement>('[data-testid="event-command-empty-line"]');

    expect(append?.textContent).toBe("+ 여기에 명령 추가");
    append?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(document.querySelector('[data-testid="event-command-picker"]')).toBeTruthy();
  });

  it("drops a root command on the empty branch button into that branch", () => {
    const mapId = seedProject();
    renderEventEditorDynamic(host, mapId, EVENT_ID);
    const branchEmpty = host.querySelector<HTMLButtonElement>('[data-testid="event-command-branch-empty-1--5"]')!;
    const payload = JSON.stringify([0]);
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperties(drop, {
      dataTransfer: {
        value: {
          types: ["application/x-oprn-event-command-path", "text/plain"],
          getData: () => payload,
        },
      },
    });

    const source = host.querySelector<HTMLElement>('[data-testid="event-command-text"]')!;
    source.querySelector<HTMLElement>('[data-testid="event-command-drag-handle"]')!
      .dispatchEvent(new Event("pointerdown"));
    source.dispatchEvent(new Event("dragstart"));
    branchEmpty.dispatchEvent(drop);

    const commands = store.getCurrent().maps[mapId]!.events[0]!.pages![0]!.commands;
    expect(commands).toHaveLength(1);
    expect(commands[0]?.kind).toBe("loop");
    if (commands[0]?.kind === "loop") expect(commands[0].body).toEqual([{ kind: "text", body: "어서 오세요." }]);
  });

  it("opens the picker from an empty branch and inserts into that exact container", () => {
    const mapId = seedProject();
    renderEventEditorDynamic(host, mapId, EVENT_ID);

    const branchEmpty = host.querySelector<HTMLButtonElement>('[data-testid="event-command-branch-empty-1--5"]');
    expect(branchEmpty?.textContent).toBe("비어 있음 — 여기에 명령 추가");
    branchEmpty?.click();
    expect(document.querySelector('[data-testid="event-command-picker"]')).toBeTruthy();

    document.querySelector<HTMLButtonElement>('[data-testid="command-picker-add-wait"]')?.click();
    document.querySelector<HTMLButtonElement>('[data-testid="event-command-edit-ok"]')?.click();

    const loop = store.getCurrent().maps[mapId]?.events[0]?.pages?.[0]?.commands[1];
    expect(loop?.kind).toBe("loop");
    if (loop?.kind === "loop") expect(loop.body).toEqual([{ kind: "wait", ms: 500 }]);
  });
});
