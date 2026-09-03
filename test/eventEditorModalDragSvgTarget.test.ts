// @vitest-environment happy-dom
// test/eventEditorModalDragSvgTarget.test.ts
//
// 이벤트 편집기 헤더 드래그는 헤더 안 단추 위에서 시작하면 안 된다 — 시작하면 setPointerCapture +
// preventDefault 가 뒤따르는 click 을 삼킨다. 단추 아이콘이 SVG 로 바뀐 뒤(글리프 → SVG 세트)
// 포인터 대상이 `<path>` 가 되면서 `instanceof HTMLElement` 가림막이 비켜났고, 닫기(×)·전체 보기
// 단추가 실제 마우스로는 눌리지 않았다(2026-09-03 실측, e2e event-ai-command-dock «닫기» 단계).
import { describe, expect, it } from "vitest";
import { attachWindowDrag } from "@/editor/panels/eventEditor/modalDrag";

function mount(): { handle: HTMLElement; windowEl: HTMLElement; path: Element; button: HTMLButtonElement } {
  const windowEl = document.createElement("section");
  const handle = document.createElement("header");
  const button = document.createElement("button");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  svg.append(path);
  button.append(svg);
  handle.append(button);
  windowEl.append(handle);
  document.body.append(windowEl);
  handle.setPointerCapture = () => undefined;
  handle.hasPointerCapture = () => false;
  handle.releasePointerCapture = () => undefined;
  attachWindowDrag(handle, windowEl);
  return { handle, windowEl, path, button };
}

function pointerDown(target: Element): PointerEvent {
  const event = new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1, clientX: 10, clientY: 10 });
  target.dispatchEvent(event);
  return event;
}

describe("attachWindowDrag — 단추 위 포인터", () => {
  it("SVG 아이콘(path)을 누르면 드래그를 시작하지 않아 click 이 살아남는다", () => {
    const { windowEl, path } = mount();
    const event = pointerDown(path);
    expect(event.defaultPrevented).toBe(false);
    expect(windowEl.classList.contains("dragging")).toBe(false);
  });

  it("단추 자체를 누를 때도 같다(기존 동작)", () => {
    const { windowEl, button } = mount();
    const event = pointerDown(button);
    expect(event.defaultPrevented).toBe(false);
    expect(windowEl.classList.contains("dragging")).toBe(false);
  });

  it("헤더 빈 곳을 누르면 드래그가 시작된다", () => {
    const { handle, windowEl } = mount();
    const event = pointerDown(handle);
    expect(event.defaultPrevented).toBe(true);
    expect(windowEl.classList.contains("dragging")).toBe(true);
  });
});
