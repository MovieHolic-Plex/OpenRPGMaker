// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";

import { installEventEditorCustomSelects } from "@/editor/panels/eventEditor/customSelect";
import { modalStackDepthForTest, registerModal, resetModalStackForTest } from "@/editor/ui/modalStack";

/**
 * 왜 이 테스트가 있는가 (실측): modalStack 은 keydown 을 document 캡처 단계에서 잡아
 * stopPropagation 한다(src/editor/ui/modalStack.ts). 캡처는 document -> root 순으로 흐르므로
 * 열린 드롭다운을 층으로 등록하지 않으면 Esc 가 customSelect 의 핸들러에 도달하기 전에 모달
 * 전체를 닫는다 — 드롭다운과 모달이 한 번에 사라진다. 이것이 "한 층에 Esc 하나" 라는
 * modalStack 의 존재 이유를 깨는 상태였다.
 *
 * 기존 test/aiSettingsModalLayout.test.ts 는 깊이가 1인 것만 단정하고 드롭다운을 열어놓고
 * Esc 를 누르는 경로를 전혀 실행하지 않았다 — 그래서 이 결함이 통과했다.
 */

function buildModalWithSelect(): { modal: HTMLElement; trigger: HTMLButtonElement; closed: string[] } {
  const closed: string[] = [];
  const modal = document.createElement("div");
  modal.setAttribute("role", "dialog");
  const select = document.createElement("select");
  select.setAttribute("aria-label", "추론 강도");
  for (const value of ["낮음", "보통", "높음"]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
  modal.append(select);
  document.body.append(modal);
  registerModal(modal, () => {
    closed.push("modal");
    modal.remove();
  });
  installEventEditorCustomSelects(modal);
  const trigger = modal.querySelector<HTMLButtonElement>(".event-custom-select-trigger");
  if (!trigger) throw new Error("트리거가 만들어지지 않았다");
  return { modal, trigger, closed };
}

function pressEscape(): void {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
}

describe("커스텀 셀렉트 Esc 층 소유", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    resetModalStackForTest();
  });

  it("드롭다운을 열면 modalStack 최상위 층이 팝오버다", () => {
    const { trigger } = buildModalWithSelect();
    expect(modalStackDepthForTest()).toBe(1);
    trigger.click();
    expect(modalStackDepthForTest()).toBe(2);
  });

  it("Esc 한 번은 드롭다운만 닫고 모달은 남긴다", () => {
    const { modal, trigger, closed } = buildModalWithSelect();
    trigger.click();
    expect(document.querySelector(".event-custom-select-popover")).not.toBeNull();

    pressEscape();

    expect(document.querySelector(".event-custom-select-popover")).toBeNull();
    expect(closed).toEqual([]);
    expect(modal.isConnected).toBe(true);
    expect(modalStackDepthForTest()).toBe(1);
  });

  it("드롭다운이 닫힌 뒤의 Esc 는 모달을 닫는다", () => {
    const { modal, trigger, closed } = buildModalWithSelect();
    trigger.click();
    pressEscape();
    pressEscape();

    expect(closed).toEqual(["modal"]);
    expect(modal.isConnected).toBe(false);
  });

  it("옵션을 골라 닫아도 층이 남지 않는다", () => {
    const { trigger } = buildModalWithSelect();
    trigger.click();
    const option = document.querySelector<HTMLButtonElement>(".event-custom-select-option");
    if (!option) throw new Error("옵션이 없다");
    option.click();
    expect(modalStackDepthForTest()).toBe(1);
  });
});
