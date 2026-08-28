/**
 * 계약: **명령 행 한 번 클릭 = 선택(세 번째 칼럼 인스펙터 채움), 두 번 클릭 = 편집 모달.**
 *
 * 회귀 배경: content.ts 는 "선택한 명령" 인스펙터 칼럼을 만들고
 * setCommandInspectorHost() 로 등록하지만, commandList.ts 의 행 클릭이 곧바로
 * 편집 모달을 열어버려서 인스펙터가 열릴 경로가 없었다. showCommandInspector() 는
 * 재렌더 복원 분기(`sameInspectorPath(path, selectedCommandPath())`) 안에서만
 * 불렸고, 그 조건은 showCommandInspector() 자신이 세우는 값이라 영원히 거짓이었다.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import {
  clearCommandInspector,
  resetCommandInspectorView,
  setCommandInspectorHost,
} from "@/editor/panels/eventEditor/commandInspector";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const noopActions: CommandListActions = {
  addCommand: () => {},
  insertCommand: () => {},
  replaceCommand: () => {},
  deleteCommand: () => {},
  moveCommand: () => {},
  moveCommandTo: () => {},
};

const COMMANDS: Command[] = [
  { kind: "text", body: "약초를 고르고 계신가요?" },
  { kind: "text", body: "오늘 약초는 다 팔렸어요." },
];

const EDIT_DIALOG = '[data-testid="event-command-edit-dialog"]';

describe("이벤트 편집기 — 명령 선택과 인스펙터", () => {
  let restoreDom: (() => void) | undefined;
  let inspectorHost: FakeElement;
  let listRoot: FakeElement;

  function renderList(): void {
    renderCommandList(listRoot as unknown as HTMLElement, COMMANDS, [], noopActions);
  }

  function headAt(index: number): FakeElement {
    const head = listRoot.querySelectorAll(".cmd-head")[index];
    if (!head) throw new Error(`expected .cmd-head at ${index}`);
    return head;
  }

  function selectedPaths(): string[] {
    // fakeDom 셀렉터는 복합 클래스(.cmd-item.selected)를 모른다 — 클래스 목록으로 직접 고른다.
    return listRoot
      .querySelectorAll(".cmd-item")
      .filter((item) => item.className.split(/\s+/u).includes("selected"))
      .map((item) => item.dataset.cmdPath ?? "");
  }

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
    // content.ts 와 같은 순서: 인스펙터 칼럼 등록 → 화면 비우기 → 리스트 렌더.
    inspectorHost = new FakeElement("div");
    inspectorHost.dataset.testid = "event-editor-inspector";
    document.body.append(inspectorHost as unknown as HTMLElement);
    setCommandInspectorHost(inspectorHost as unknown as HTMLElement);
    resetCommandInspectorView();
    listRoot = new FakeElement("div");
    document.body.append(listRoot as unknown as HTMLElement);
    renderList();
  });

  afterEach(() => {
    clearCommandInspector();
    setCommandInspectorHost(undefined);
    restoreDom?.();
  });

  it("한 번 클릭하면 인스펙터가 채워지고 편집 모달은 열리지 않는다", () => {
    expect(inspectorHost.hidden).toBe(true);

    headAt(0).dispatchEvent(new Event("click"));

    expect(inspectorHost.hidden).toBe(false);
    expect(inspectorHost.childNodes.length).toBeGreaterThan(0);
    expect(findByTestId(inspectorHost, "event-inspector-body")).toBeTruthy();
    expect(inspectorHost.dataset.commandPath).toBe("[0]");
    expect(document.querySelector(EDIT_DIALOG)).toBeNull();
    // 툴바 이동/복사가 쓰는 선택 표시도 같이 선다.
    expect(selectedPaths()).toEqual(["[0]"]);
  });

  it("두 번 클릭하면 편집 모달이 열린다", () => {
    headAt(0).dispatchEvent(new Event("dblclick"));

    expect(document.querySelector(EDIT_DIALOG)).not.toBeNull();
  });

  it("다른 행을 클릭하면 인스펙터가 그 행으로 옮겨간다", () => {
    headAt(0).dispatchEvent(new Event("click"));
    headAt(1).dispatchEvent(new Event("click"));

    expect(inspectorHost.dataset.commandPath).toBe("[1]");
    expect(document.querySelector(EDIT_DIALOG)).toBeNull();
    expect(selectedPaths()).toEqual(["[1]"]);
  });

  it("재렌더 후에도 선택한 행의 인스펙터가 복원된다", () => {
    headAt(0).dispatchEvent(new Event("click"));

    resetCommandInspectorView();
    renderList();

    expect(inspectorHost.hidden).toBe(false);
    expect(findByTestId(inspectorHost, "event-inspector-body")).toBeTruthy();
    expect(inspectorHost.dataset.commandPath).toBe("[0]");
  });

  it("닫기 버튼은 인스펙터를 다시 비운다", () => {
    headAt(0).dispatchEvent(new Event("click"));
    findByTestId(inspectorHost, "event-inspector-close")?.click();

    expect(inspectorHost.hidden).toBe(true);
    expect(inspectorHost.childNodes.length).toBe(0);
  });
});
