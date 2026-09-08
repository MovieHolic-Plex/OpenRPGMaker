// @vitest-environment happy-dom
// test/moveRouteEventTargetPicker.test.ts
//
// OPRN-OUT-012 — 「누구에게」 수동 저작 경로. 예전에는 자유 입력 텍스트 상자 하나였고,
// 사용자가 대상 NPC 의 내부 id(`ev_npc_…`)를 스스로 찾아 붙여넣는 것이 유일한 복구였다.
//
// 여기서 못 박는 것: 검색 가능한 목록으로 고를 수 있고, 검색은 이름과 id 둘 다 맞으며,
// 고른 결과는 정본 id 로 저장되고, 특수값 둘(이 이벤트·주인공)의 의미는 그대로다.
// 그리고 알 수 없는 레거시 값은 **조용히 덮어쓰지 않고** 경고 + 복구 경로로 남는다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { moveEventBody } from "@/editor/panels/eventEditor/commandBodyRoute";
import { openEventCommandEditDialog } from "@/editor/panels/eventEditor/commandEditDialog";
import { modalStackDepthForTest } from "@/editor/ui/modalStack";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { store } from "@/project/store";
import type { CommandEditContext, CommandListActions } from "@/editor/panels/eventEditor/types";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";

type Replaced = { readonly path: readonly number[]; readonly command: Command };

function pageNamed(name: string): EventPage {
  return {
    id: `pg_${name}`,
    name,
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
  };
}

function eventNamed(id: string, name: string, x: number, y: number): GameEvent {
  return { id, x, y, trigger: { kind: "action" }, commands: [], pages: [pageNamed(name)] };
}

function seedProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.events = [
    eventNamed("ev_npc_gate", "문지기", 3, 4),
    eventNamed("ev_npc_merchant", "상인", 8, 2),
  ];
  store.replace(project);
  editorState.set({ currentMapId: project.startMapId });
  return project;
}

function renderRoute(eventId: string): { root: HTMLElement; replaced: Replaced[] } {
  const replaced: Replaced[] = [];
  const actions = {
    addCommand: () => undefined,
    insertCommand: () => undefined,
    replaceCommand: (path: readonly number[], command: Command) => {
      replaced.push({ path, command });
    },
    deleteCommand: () => undefined,
    moveCommand: () => undefined,
    moveCommandTo: () => undefined,
  } as unknown as CommandListActions;
  const context: CommandEditContext = { path: [0], actions };
  const root = moveEventBody(context, {
    kind: "moveEvent",
    eventId,
    route: { moves: [], repeat: false },
  });
  document.body.append(root);
  return { root, replaced };
}

function byTestId(root: ParentNode, testid: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(`[data-testid="${testid}"]`);
  if (!found) throw new Error(`missing testid: ${testid}`);
  return found;
}

function optionIds(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-testid^="move-route-event-option-"]')).map(
    (node) => node.dataset.eventId ?? "",
  );
}

function lastEventId(replaced: readonly Replaced[]): string {
  const last = replaced[replaced.length - 1];
  if (!last || last.command.kind !== "moveEvent") throw new Error("no moveEvent replacement recorded");
  return last.command.eventId;
}

describe("이동 경로 대상 픽커", () => {
  beforeEach(() => {
    seedProject();
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("특정 이벤트 대상에서 검색 목록을 열면 이름과 id 를 함께 보여준다", () => {
    const { root } = renderRoute("ev_npc_gate");
    byTestId(root, "move-route-event-picker-open").click();
    const picker = byTestId(root, "move-route-event-picker");
    expect(picker.hidden).toBe(false);
    expect(optionIds(picker)).toEqual(["ev_npc_gate", "ev_npc_merchant"]);
    const row = byTestId(picker, "move-route-event-option-ev_npc_merchant");
    expect(row.textContent).toContain("상인");
    expect(row.textContent).toContain("ev_npc_merchant");
  });

  it("이름으로 검색해 고르면 정본 id 가 저장된다 — 내부 id 를 손으로 붙여넣지 않는다", () => {
    const { root, replaced } = renderRoute("");
    const select = byTestId(root, "move-route-target-select") as HTMLSelectElement;
    select.value = "event";
    select.dispatchEvent(new Event("change"));

    const input = byTestId(root, "move-route-event-id-input") as HTMLInputElement;
    input.value = "상인";
    input.dispatchEvent(new Event("input"));
    const picker = byTestId(root, "move-route-event-picker");
    expect(optionIds(picker)).toEqual(["ev_npc_merchant"]);

    byTestId(picker, "move-route-event-option-ev_npc_merchant").click();
    expect(lastEventId(replaced)).toBe("ev_npc_merchant");
    expect(input.value).toBe("ev_npc_merchant");
    expect(picker.hidden).toBe(true);
    expect(byTestId(root, "move-route-event-name").textContent).toContain("상인");
  });

  it("keeps searched options alive through pointer focus/change ordering until click", () => {
    const project = createBlankProject();
    project.maps[project.startMapId].events = [
      eventNamed("ev_sora_first", "소라", 3, 4),
      eventNamed("ev_sora_second", "소라", 8, 2),
    ];
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId });
    const { root, replaced } = renderRoute("this");
    byTestId(root, "move-route-event-picker-open").click();
    const input = byTestId(root, "move-route-event-id-input") as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    input.value = "소라";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const picker = byTestId(root, "move-route-event-picker");
    expect(optionIds(picker)).toEqual(["ev_sora_first", "ev_sora_second"]);
    const option = byTestId(picker, "move-route-event-option-ev_sora_first");
    const label = option.querySelector<HTMLElement>(".move-route-target-option-name")!;

    label.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 }));
    const press = new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 });
    label.dispatchEvent(press);
    // Happy DOM does not implement the mouse-press focus default or the text
    // input's native change-on-focus-loss. Model that browser default only when
    // the press permits it; a detached row must not receive a synthetic click.
    if (!press.defaultPrevented) {
      input.dispatchEvent(new Event("change", { bubbles: true }));
      option.focus();
    }
    expect(picker.hidden).toBe(false);
    expect(option.isConnected).toBe(true);
    expect(replaced).toEqual([]);
    label.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0 }));
    label.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0 }));
    label.click();

    expect(replaced).toHaveLength(1);
    expect(lastEventId(replaced)).toBe("ev_sora_first");
    expect(input.value).toBe("ev_sora_first");
    expect(document.activeElement).toBe(input);
    expect(byTestId(root, "move-route-event-name").dataset.state).toBe("resolved");
    expect(picker.hidden).toBe(true);
    expect(optionIds(picker)).toEqual([]);
  });

  it.each(["pointercancel", "pointerup"])("does not commit a press ending with %s outside, or retain it across blur/reopen", (endEvent) => {
    const { root, replaced } = renderRoute("this");
    byTestId(root, "move-route-event-picker-open").click();
    const input = byTestId(root, "move-route-event-id-input") as HTMLInputElement;
    input.value = "상인";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const picker = byTestId(root, "move-route-event-picker");
    const option = byTestId(picker, "move-route-event-option-ev_npc_merchant");
    option.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 }));
    option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
    document.body.dispatchEvent(new PointerEvent(endEvent, { bubbles: true, button: 0 }));
    expect(replaced).toEqual([]);
    expect(input.value).toBe("상인");

    input.blur();
    expect(picker.hidden).toBe(true);
    expect(optionIds(picker)).toEqual([]);
    input.focus();
    expect(picker.hidden).toBe(false);
    expect(optionIds(picker)).toEqual(["ev_npc_gate", "ev_npc_merchant"]);

    // A cancelled press must not suppress the existing direct-ID change path.
    input.value = "ev_npc_gate";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(replaced).toHaveLength(1);
    expect(lastEventId(replaced)).toBe("ev_npc_gate");
    expect(picker.hidden).toBe(true);
    expect(optionIds(picker)).toEqual([]);
    expect(byTestId(root, "move-route-event-name").dataset.state).toBe("resolved");
  });

  it("preserves arrow selection, Enter, Escape and Tab with input focus", () => {
    const { root, replaced } = renderRoute("this");
    byTestId(root, "move-route-event-picker-open").click();
    const input = byTestId(root, "move-route-event-id-input") as HTMLInputElement;
    const picker = byTestId(root, "move-route-event-picker");
    const key = (value: string): KeyboardEvent => {
      const event = new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true });
      input.dispatchEvent(event);
      return event;
    };
    key("ArrowDown");
    key("ArrowDown");
    key("ArrowUp");
    expect(byTestId(picker, "move-route-event-option-ev_npc_gate").getAttribute("aria-selected")).toBe("true");
    key("ArrowDown");
    expect(key("Enter").defaultPrevented).toBe(true);
    expect(lastEventId(replaced)).toBe("ev_npc_merchant");
    expect(picker.hidden).toBe(true);
    expect(document.activeElement).toBe(input);

    key("ArrowDown");
    expect(picker.hidden).toBe(false);
    expect(key("Escape").defaultPrevented).toBe(true);
    expect(picker.hidden).toBe(true);
    key("ArrowDown");
    expect(picker.hidden).toBe(false);
    expect(key("Tab").defaultPrevented).toBe(false);
    expect(picker.hidden).toBe(true);
    expect(replaced).toHaveLength(1);
  });

  it("Escape dismisses the picker before its real parent command dialog, including after reopen", () => {
    const applied: Command[] = [];
    openEventCommandEditDialog({
      initial: { kind: "moveEvent", eventId: "this", route: { moves: [], repeat: false } },
      onApply: (command) => applied.push(command),
    });
    const dialog = byTestId(document, "event-command-edit-dialog");
    const input = byTestId(dialog, "move-route-event-id-input");
    const picker = byTestId(dialog, "move-route-event-picker");
    for (let attempt = 0; attempt < 2; attempt += 1) {
      byTestId(dialog, "move-route-event-picker-open").click();
      expect(picker.hidden).toBe(false);
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      expect(dialog.isConnected).toBe(true);
      expect(picker.hidden).toBe(true);
      expect(document.activeElement).toBe(input);
      expect(modalStackDepthForTest()).toBe(1);
    }
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(dialog.isConnected).toBe(false);
    expect(modalStackDepthForTest()).toBe(0);
    expect(applied).toEqual([]);
  });

  it.each(["click", "Tab", "blur", "outside pointer"])("releases picker Escape ownership after %s", (dismissal) => {
    openEventCommandEditDialog({
      initial: { kind: "moveEvent", eventId: "this", route: { moves: [], repeat: false } },
      onApply: () => undefined,
    });
    const dialog = byTestId(document, "event-command-edit-dialog");
    byTestId(dialog, "move-route-event-picker-open").click();
    const input = byTestId(dialog, "move-route-event-id-input");
    if (dismissal === "click") byTestId(dialog, "move-route-event-option-ev_npc_gate").click();
    else if (dismissal === "Tab") input.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    else if (dismissal === "blur") input.blur();
    else document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(byTestId(dialog, "move-route-event-picker").hidden).toBe(true);
    expect(modalStackDepthForTest()).toBe(1);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(dialog.isConnected).toBe(false);
    expect(modalStackDepthForTest()).toBe(0);
  });

  it("id 조각으로도 검색된다", () => {
    const { root } = renderRoute("ev_npc_gate");
    const input = byTestId(root, "move-route-event-id-input") as HTMLInputElement;
    input.value = "merchant";
    input.dispatchEvent(new Event("input"));
    expect(optionIds(byTestId(root, "move-route-event-picker"))).toEqual(["ev_npc_merchant"]);
  });

  it("이 이벤트·주인공 대상은 기존 저장 의미를 그대로 지킨다", () => {
    const { root, replaced } = renderRoute("ev_npc_gate");
    const select = byTestId(root, "move-route-target-select") as HTMLSelectElement;
    select.value = "player";
    select.dispatchEvent(new Event("change"));
    expect(lastEventId(replaced)).toBe(PLAYER_MOVE_TARGET);
    expect(byTestId(root, "move-route-event-picker").hidden).toBe(true);

    select.value = "this";
    select.dispatchEvent(new Event("change"));
    expect(lastEventId(replaced)).toBe("");
  });

  it("알 수 없는 레거시 id 는 값이 보존되고 경고가 보이며 열자마자 다시 쓰이지 않는다", () => {
    const { root, replaced } = renderRoute("ev_npc_cb33408d-0bc0-4582-993f-bf8550e230e0");
    // 옛 프로젝트를 여는 것만으로 명령이 바뀌면 안 된다 — 조용한 데이터 변형 금지.
    expect(replaced).toEqual([]);
    const input = byTestId(root, "move-route-event-id-input") as HTMLInputElement;
    expect(input.value).toBe("ev_npc_cb33408d-0bc0-4582-993f-bf8550e230e0");
    const status = byTestId(root, "move-route-event-name");
    expect(status.dataset.state).toBe("unresolved");
    expect(status.textContent).toContain("없음");
    // 복구 경로가 눌러서 닿는 곳에 있다.
    expect(byTestId(root, "move-route-event-picker-open")).toBeTruthy();
  });

  it("보고된 «this» 값은 고쳐진 척하지 않는다 — 저장 문자열이 정본이 아니면 경고다", () => {
    // 실측 결함 값. 카탈로그는 뜻을 알아보지만 저장된 문자열은 그대로 "this" 이고
    // 런타임은 그런 이벤트를 못 찾는다. 「이 이벤트로 읽힙니다」라고 안심시키면 안 된다.
    const { root, replaced } = renderRoute("this");
    expect(replaced).toEqual([]);
    const status = byTestId(root, "move-route-event-name");
    expect(status.dataset.state).toBe("unresolved");
    expect(status.textContent).toContain("이 이벤트");
    expect((byTestId(root, "move-route-event-id-input") as HTMLInputElement).value).toBe("this");

    // 안내대로 대상 종류를 바꾸면 정본 빈 문자열로 고쳐진다.
    const select = byTestId(root, "move-route-target-select") as HTMLSelectElement;
    select.value = "this";
    select.dispatchEvent(new Event("change"));
    expect(lastEventId(replaced)).toBe("");
  });

  it("이름이 저장된 값도 경고하고 목록 선택으로 ID 로 고쳐진다", () => {
    const { root, replaced } = renderRoute("상인");
    const status = byTestId(root, "move-route-event-name");
    expect(status.dataset.state).toBe("unresolved");
    expect(status.textContent).toContain("상인");
    byTestId(root, "move-route-event-picker-open").click();
    byTestId(root, "move-route-event-option-ev_npc_merchant").click();
    expect(lastEventId(replaced)).toBe("ev_npc_merchant");
    expect(byTestId(root, "move-route-event-name").dataset.state).toBe("resolved");
  });

  it("레거시 값은 목록에서 고르는 것으로 복구된다", () => {
    const { root, replaced } = renderRoute("ev_gone");
    byTestId(root, "move-route-event-picker-open").click();
    const picker = byTestId(root, "move-route-event-picker");
    byTestId(picker, "move-route-event-option-ev_npc_gate").click();
    expect(lastEventId(replaced)).toBe("ev_npc_gate");
    expect(byTestId(root, "move-route-event-name").dataset.state).toBe("resolved");
  });

  it("원시 id 직접 입력 경로(e2e 계약)는 그대로 살아 있다", () => {
    const { root, replaced } = renderRoute("");
    const input = byTestId(root, "move-route-event-id-input") as HTMLInputElement;
    input.value = "ev_npc_merchant";
    input.dispatchEvent(new Event("change"));
    expect(lastEventId(replaced)).toBe("ev_npc_merchant");
    expect((byTestId(root, "move-route-target-select") as HTMLSelectElement).value).toBe("event");
  });

  it("현재 맵에 이벤트가 없으면 목록이 그 사실을 말한다", () => {
    const project = createBlankProject();
    project.maps[project.startMapId].events = [];
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId });
    const { root } = renderRoute("ev_gone");
    byTestId(root, "move-route-event-picker-open").click();
    const picker = byTestId(root, "move-route-event-picker");
    expect(optionIds(picker)).toEqual([]);
    expect(picker.textContent).toContain("이벤트");
  });
});
