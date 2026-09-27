/** @vitest-environment happy-dom */
// 툴바 팝오버(「편집 ▾」 등 `<details>`)는 바깥을 누르면 닫혀야 한다.
//
// 실측 2026-09-03(제안서 §4): 팝오버가 열린 채 목록을 클릭해도 `details.open` 이 유지돼
// 우클릭 메뉴와 두 메뉴가 동시에 떠 있었다. Escape 층 등록(registerModal)은 있었지만
// 포인터 경로가 없었다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { clearCommandInspector } from "@/editor/panels/eventEditor/commandInspector";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { resetEventViewSession } from "@/editor/panels/eventEditor/storyboardView";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage, GameEvent } from "@/project/types";

const EVENT_ID = "ev_popover_probe";

function page(commands: Command[]): EventPage {
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

function seed(): string {
  const project = createBlankProject();
  const mapId = project.startMapId;
  const ev: GameEvent = {
    id: EVENT_ID,
    x: 3,
    y: 3,
    trigger: { kind: "action" },
    commands: [],
    pages: [page([{ kind: "text", body: "서쪽 길에는 슬라임이 있어." }, { kind: "wait", ms: 500 }])],
  };
  project.maps[mapId]!.events = [ev];
  store.replace(project);
  editorState.set({ currentMapId: mapId, selectedEventId: EVENT_ID, selectedEventPageId: "p1" });
  return mapId;
}

function pointerDownOn(target: Element): void {
  target.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
}

describe("툴바 팝오버 닫힘", () => {
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
    renderEventEditorDynamic(host, mapId, EVENT_ID);
  });

  afterEach(() => {
    clearCommandInspector();
    resetEventViewSession();
    resetModalStackForTest();
    host.remove();
  });

  const menu = (): HTMLDetailsElement => {
    const node = host.querySelector<HTMLDetailsElement>('[data-testid="event-command-edit-menu"]');
    if (!node) throw new Error("편집 팝오버가 없다");
    return node;
  };

  const open = (details: HTMLDetailsElement): void => {
    details.open = true;
    details.dispatchEvent(new Event("toggle"));
  };

  it("바깥(명령 목록)을 누르면 닫힌다", () => {
    const details = menu();
    open(details);
    expect(details.open).toBe(true);
    const list = host.querySelector(".cmd-list");
    if (!list) throw new Error("명령 목록이 없다");
    pointerDownOn(list);
    expect(details.open).toBe(false);
  });

  it("팝오버 안을 누르면 열린 채다", () => {
    const details = menu();
    open(details);
    const inside = details.querySelector('[data-testid="event-command-toolbar-move-up"]');
    if (!inside) throw new Error("팝오버 안 버튼이 없다");
    pointerDownOn(inside);
    expect(details.open).toBe(true);
  });

  it("닫힌 뒤에는 바깥 클릭 리스너가 남지 않는다 — 다시 열면 다시 닫힌다", () => {
    const details = menu();
    open(details);
    pointerDownOn(document.body);
    expect(details.open).toBe(false);
    open(details);
    expect(details.open).toBe(true);
    pointerDownOn(document.body);
    expect(details.open).toBe(false);
  });

  it("도구 팝오버도 같은 규칙을 따른다", () => {
    const tools = host.querySelector<HTMLDetailsElement>('[data-testid="event-editor-aux-tools"]');
    if (!tools) throw new Error("도구 팝오버가 없다");
    open(tools);
    pointerDownOn(document.body);
    expect(tools.open).toBe(false);
  });
});
