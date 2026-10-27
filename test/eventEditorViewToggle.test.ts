/** @vitest-environment happy-dom */
// 목록 / 스토리 뷰 토글의 측정된 결함 5건에 대한 회귀 테스트.
// 「미리보기」 세그먼트는 PR #3211 이후 토글에 없다(content.ts: 토글은 list/storyboard/flow 뿐,
// 저장된 "preview" 는 목록으로 읽는다). 미리보기는 오른쪽 인스펙터 칼럼이 항상 보여 준다.
//
// 결함은 모두 브라우저에서 재현한 것이고, 원인은 하나씩 다르다:
//  D1 (퇴역) 미리보기 중 편집하면 미리보기가 사라졌다 — 세그먼트가 사라져 이제 「없다」를 단언한다.
//  D2 스토리에서 고른 명령이 인스펙터로 가지 않았다 — 스토리는 인스펙터를 부르지 않았다.
//  D3 툴바의 이동/복사가 스토리에서 조용히 죽어 있었다 — 선택을 `cmdList` DOM 에서 긁었다.
//  D4 검색창 값과 실제 필터가 어긋났다 — 한 번에 한 표시면만 걸렀고 값도 재렌더에 날아갔다.
//  D5 팝오버가 열린 채 Escape 를 누르면 에디터 전체가 닫혔다 — 팝오버가 Escape 층에 없었다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { clearCommandInspector } from "@/editor/panels/eventEditor/commandInspector";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { resetEventViewSession } from "@/editor/panels/eventEditor/storyboardView";
import { registerModal, resetModalStackForTest } from "@/editor/ui/modalStack";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage, GameEvent } from "@/project/types";

const EVENT_ID = "ev_view_toggle";

const COMMANDS: Command[] = [
  { kind: "text", body: "서쪽 길에는 슬라임이 있어." },
  {
    kind: "choices",
    options: [
      { text: "서쪽으로 간다", branch: [{ kind: "text", body: "슬라임을 정리했다." }] },
      { text: "동쪽으로 간다", branch: [{ kind: "text", body: "박쥐를 정리했다." }] },
    ],
  },
  { kind: "wait", ms: 500 },
];

function page(commands: Command[] = COMMANDS): EventPage {
  return {
    id: "p1",
    name: "안내인",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}

function seed(commands: Command[] = COMMANDS): string {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const ev: GameEvent = {
    id: EVENT_ID,
    x: 3,
    y: 3,
    trigger: { kind: "action" },
    commands: [],
    pages: [page(commands)],
  };
  project.maps[mapId]!.events = [ev];
  store.replace(project);
  editorState.set({ currentMapId: mapId, selectedEventId: EVENT_ID, selectedEventPageId: "p1" });
  return mapId;
}

function click(root: ParentNode, testId: string): void {
  const node = root.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (!node) throw new Error(`missing control ${testId}`);
  node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

describe("이벤트 에디터 뷰 토글", () => {
  let host: HTMLElement;
  let mapId: string;

  beforeEach(() => {
    resetModalStackForTest();
    clearCommandInspector();
    resetEventViewSession();
    localStorage.clear();
    host = document.createElement("div");
    document.body.append(host);
    mapId = seed();
  });

  afterEach(() => {
    clearCommandInspector();
    resetEventViewSession();
    resetModalStackForTest();
    host.remove();
    document.querySelector('[data-testid="event-command-edit-dialog"]')?.remove();
    document.querySelector('[data-testid="event-command-picker"]')?.remove();
  });

  const rerender = (): void => {
    host.replaceChildren();
    renderEventEditorDynamic(host, mapId, EVENT_ID);
  };

  // (d) 퇴역: 「미리보기」 세그먼트는 의도적으로 제거됐다(content.ts, PR #3211). 옛 D1 은 그 세그먼트를
  // 눌러 재렌더 후 유지를 봤다. 지금은 토글이 세 모드만 내놓고 "preview" 는 저장되지 않으며 재렌더 뒤에도 목록이다.
  it("D1 — 토글에 미리보기 세그먼트가 없고 재렌더 뒤에도 선택 보기가 유지된다", () => {
    renderEventEditorDynamic(host, mapId, EVENT_ID);
    expect(host.querySelector('[data-testid="event-view-toggle-preview"]')).toBeNull();
    expect(["list", "storyboard", "flow"].every((mode) => host.querySelector(`[data-testid="event-view-toggle-${mode}"]`))).toBe(true);
    click(host, "event-view-toggle-storyboard");

    // modal.ts 의 store.subscribe(refresh) 가 하는 일 — 본문을 통째로 다시 그린다.
    rerender();

    expect(host.querySelector('[data-testid="event-view-toggle-storyboard"]')?.getAttribute("aria-selected")).toBe("true");
    expect(localStorage.getItem("oprn:storyboard-mode")).not.toBe("preview");
  });

  it("D2 — 스토리 카드를 한 번 클릭하면 오른쪽 「선택한 명령」이 채워진다", () => {
    renderEventEditorDynamic(host, mapId, EVENT_ID);
    click(host, "event-view-toggle-storyboard");
    const inspector = host.querySelector<HTMLElement>('[data-testid="event-editor-inspector"]');
    // 인스펙터 칼럼은 미리보기 우선(PR #3211): 선택 전에도 숨지 않고 미리보기를 보여 준다.
    expect(inspector?.hidden).toBe(false);
    // 작업대는 미리보기 칸이 보이면 has-command-inspector 를 달고 태어난다 — 선택 전 상태는 commandPath 로 본다.
    expect(inspector?.dataset.commandPath).toBeUndefined();

    click(host, "event-storyboard-card-1");

    expect(inspector?.hidden).toBe(false);
    expect(inspector?.dataset.commandPath).toBe("[1]");
    // 미리보기 우선 칼럼은 명령 폼(event-inspector-title) 대신 미리보기를 그린다.
    expect(inspector?.querySelector('[data-testid="event-inspector-title"]')).toBeNull();
    // 편집 창은 열리지 않는다 — 한 번 클릭은 선택뿐이다.
    expect(document.querySelector('[data-testid="event-command-edit-dialog"]')).toBeNull();
  });

  it("D2 — 분기 안쪽 줄도 같은 방식으로 선택된다", () => {
    renderEventEditorDynamic(host, mapId, EVENT_ID);
    click(host, "event-view-toggle-storyboard");
    const leaf = host.querySelector<HTMLElement>('.event-storyboard-branch-command[data-cmd-path="[1,0,0]"]');
    expect(leaf).toBeTruthy();
    leaf!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    const inspector = host.querySelector<HTMLElement>('[data-testid="event-editor-inspector"]');
    expect(inspector?.dataset.commandPath).toBe("[1,0,0]");
  });

  it("D3 — 스토리에서 고른 명령에 툴바 위로 이동이 실제로 걸린다", () => {
    renderEventEditorDynamic(host, mapId, EVENT_ID);
    click(host, "event-view-toggle-storyboard");
    click(host, "event-storyboard-card-1");

    click(host, "event-command-toolbar-move-up");

    const commands = store.getCurrent().maps[mapId]!.events
      .find((event) => event.id === EVENT_ID)!.pages![0]!.commands;
    expect(commands[0]?.kind).toBe("choices");
    expect(commands[1]?.kind).toBe("text");
  });

  it("D3 — 고른 명령이 없으면 편집 도구가 disabled 이고 이유를 말한다", () => {
    renderEventEditorDynamic(host, mapId, EVENT_ID);
    const menu = host.querySelector<HTMLDetailsElement>('[data-testid="event-command-edit-menu"]')!;
    menu.open = true;
    menu.dispatchEvent(new Event("toggle"));

    const target = host.querySelector<HTMLElement>('[data-testid="event-command-edit-target"]');
    expect(target?.dataset.state).toBe("empty");
    expect(target?.textContent).toContain("먼저 명령을");
    for (const testId of [
      "event-command-toolbar-move-up",
      "event-command-toolbar-move-down",
      "event-command-toolbar-copy",
      "event-command-toolbar-cut",
    ]) {
      expect(host.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)?.disabled).toBe(true);
    }
  });

  it("D3 — 첫 명령을 고르면 위로 이동만 막히고 나머지는 살아난다", () => {
    renderEventEditorDynamic(host, mapId, EVENT_ID);
    click(host, "event-view-toggle-storyboard");
    click(host, "event-storyboard-card-0");
    const menu = host.querySelector<HTMLDetailsElement>('[data-testid="event-command-edit-menu"]')!;
    menu.open = true;
    menu.dispatchEvent(new Event("toggle"));

    expect(host.querySelector<HTMLElement>('[data-testid="event-command-edit-target"]')?.dataset.state).toBe("selected");
    expect(host.querySelector<HTMLButtonElement>('[data-testid="event-command-toolbar-move-up"]')?.disabled).toBe(true);
    expect(host.querySelector<HTMLButtonElement>('[data-testid="event-command-toolbar-move-down"]')?.disabled).toBe(false);
    expect(host.querySelector<HTMLButtonElement>('[data-testid="event-command-toolbar-copy"]')?.disabled).toBe(false);
  });

  // 스토리는 보기 전환 때 처음 그려진다(content.ts applyViewMode, 목록으로 나가면 해체). 그래서 스토리 검사는
  // 먼저 스토리로 넘어간 뒤에 한다. 검색어는 세션에 남아 전환 뒤에도 같은 필터가 걸린다.
  it("D4 — 검색은 목록과 스토리 양쪽에 같이 걸리고 개수를 말한다", () => {
    renderEventEditorDynamic(host, mapId, EVENT_ID);
    const search = host.querySelector<HTMLInputElement>('[data-testid="event-command-search"]')!;
    search.value = "박쥐";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    const listVisible = Array.from(host.querySelectorAll<HTMLElement>(".cmd-list [data-cmd-path]")).filter((node) => !node.hidden).length;
    expect(listVisible).toBeGreaterThan(0);
    expect(listVisible).toBeLessThan(host.querySelectorAll(".cmd-list [data-cmd-path]").length);
    click(host, "event-view-toggle-storyboard");

    const visible = (selector: string): number =>
      Array.from(host.querySelectorAll<HTMLElement>(selector)).filter((node) => !node.hidden).length;
    expect(visible('.event-storyboard [data-cmd-path]')).toBeGreaterThan(0);
    // 목록에서도 스토리에서도 걸러졌다 — 한쪽만 필터가 걸리는 일이 없다.
    expect(visible('.event-storyboard [data-cmd-path]')).toBeLessThan(
      host.querySelectorAll('.event-storyboard [data-cmd-path]').length
    );
    expect(host.querySelector('[data-testid="event-command-search-count"]')?.textContent).toContain("일치");
  });

  it("D4 — 일치한 줄의 부모 분기는 함께 남는다", () => {
    renderEventEditorDynamic(host, mapId, EVENT_ID);
    const search = host.querySelector<HTMLInputElement>('[data-testid="event-command-search"]')!;
    search.value = "박쥐";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    click(host, "event-view-toggle-storyboard"); // 스토리는 전환 때 처음 그려진다.

    const parent = host.querySelector<HTMLElement>('.event-storyboard [data-cmd-path="[1]"]');
    const child = host.querySelector<HTMLElement>('.event-storyboard [data-cmd-path="[1,1,0]"]');
    expect(child?.hidden).toBe(false);
    expect(parent?.hidden).toBe(false);
  });

  it("D4 — 검색어는 재렌더를 넘어 살아남고 지우기 버튼이 비운다", () => {
    renderEventEditorDynamic(host, mapId, EVENT_ID);
    const search = host.querySelector<HTMLInputElement>('[data-testid="event-command-search"]')!;
    search.value = "박쥐";
    search.dispatchEvent(new Event("input", { bubbles: true }));

    rerender();
    expect(host.querySelector<HTMLInputElement>('[data-testid="event-command-search"]')?.value).toBe("박쥐");
    expect(host.querySelector('[data-testid="event-command-search-count"]')?.textContent).toContain("일치");

    click(host, "event-command-search-clear");
    expect(host.querySelector<HTMLInputElement>('[data-testid="event-command-search"]')?.value).toBe("");
    expect(host.querySelector('[data-testid="event-command-search-count"]')?.textContent).toBe("");
  });

  // (d) 퇴역: 미리보기 세그먼트가 없으므로 「미리보기에서 검색 비활성」 경로에 들어갈 길이 없다.
  // 남은 계약: 지원하는 어느 보기(목록·스토리)에서도 검색창은 켜져 있다.
  it("D4 — 목록과 스토리에서 검색창은 항상 켜져 있다", () => {
    renderEventEditorDynamic(host, mapId, EVENT_ID);
    const search = (): HTMLInputElement => host.querySelector<HTMLInputElement>('[data-testid="event-command-search"]')!;
    expect(search().disabled).toBe(false);
    click(host, "event-view-toggle-storyboard");
    expect(search().disabled).toBe(false);
    expect(search().title).not.toContain("미리보기");
  });

  it("D5 — 편집 팝오버가 열려 있으면 Escape 가 팝오버만 닫는다", () => {
    renderEventEditorDynamic(host, mapId, EVENT_ID);
    const editorLayerClosed: string[] = [];
    // 에디터 본문 자체도 Escape 층에 있다 (modal.ts 가 backdrop 을 등록한다).
    registerModal(host, () => editorLayerClosed.push("editor"));

    const menu = host.querySelector<HTMLDetailsElement>('[data-testid="event-command-edit-menu"]')!;
    menu.open = true;
    menu.dispatchEvent(new Event("toggle"));

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

    expect(menu.open).toBe(false);
    expect(editorLayerClosed).toEqual([]);

    // 팝오버가 닫힌 뒤의 Escape 는 다시 에디터 차례다.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(editorLayerClosed).toEqual(["editor"]);
  });
});
