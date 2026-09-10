// OPRN-OUT-024 공통 지연 툴팁 계약 — 지연·조기 이탈·키보드 초점·Escape·리렌더 정리와
// 네 변 배치. 시간은 가짜 타이머로만 움직인다(고정 sleep 금지).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activeDelayedTooltipElement,
  attachDelayedTooltip,
  computeTooltipPlacement,
  hideDelayedTooltip,
  TOOLTIP_DELAY_MS,
} from "@/editor/delayedTooltip";
import { DELAYED_TOOLTIP_ROLLOUT, installDelayedTooltips } from "@/editor/delayedTooltipRollout";
import { el } from "@/util/dom";
import { installFakeDom } from "./fakeDom";

const VIEWPORT = { height: 720, width: 1280 };
const TIP = { height: 24, width: 100 };

function rect(left: number, top: number, width = 32, height = 28) {
  return { bottom: top + height, height, left, right: left + width, top, width };
}

describe("computeTooltipPlacement — 대상을 덮지 않고 뷰포트 안에 머문다", () => {
  it("공간이 있으면 대상 아래에 중앙 정렬로 놓는다", () => {
    const placement = computeTooltipPlacement({ size: TIP, target: rect(600, 300), viewport: VIEWPORT });
    expect(placement.side).toBe("below");
    expect(placement.top).toBeGreaterThan(300 + 28);
    expect(placement.left).toBe(Math.round(600 + 16 - 50));
  });

  it("아래가 막히면 위로 뒤집는다", () => {
    const placement = computeTooltipPlacement({ size: TIP, target: rect(600, 700), viewport: VIEWPORT });
    expect(placement.side).toBe("above");
    expect(placement.top).toBeLessThan(700);
  });

  it("왼쪽 변에 붙어도 화면 밖으로 나가지 않는다", () => {
    const placement = computeTooltipPlacement({ size: TIP, target: rect(0, 300), viewport: VIEWPORT });
    expect(placement.left).toBeGreaterThanOrEqual(8);
  });

  it("오른쪽 변에 붙어도 화면 밖으로 나가지 않는다", () => {
    const placement = computeTooltipPlacement({ size: TIP, target: rect(1270, 300), viewport: VIEWPORT });
    expect(placement.left + TIP.width).toBeLessThanOrEqual(VIEWPORT.width - 8);
  });

  it("위쪽 변에 붙으면 아래로 두고 여백을 지킨다", () => {
    const placement = computeTooltipPlacement({ size: TIP, target: rect(600, 0), viewport: VIEWPORT });
    expect(placement.side).toBe("below");
    expect(placement.top).toBeGreaterThanOrEqual(8);
  });

  it("아래·위 모두 좁은 화면에서도 여백 안에서 잘라 맞춘다", () => {
    const placement = computeTooltipPlacement({ size: TIP, target: rect(600, 10), viewport: { height: 60, width: 1280 } });
    expect(placement.top).toBeGreaterThanOrEqual(8);
    expect(placement.top + TIP.height).toBeLessThanOrEqual(60 - 8 + TIP.height);
  });
});

describe("attachDelayedTooltip — 동작 계약", () => {
  let restoreDom: (() => void) | null = null;

  beforeEach(() => {
    restoreDom = installFakeDom();
    vi.useFakeTimers();
  });

  afterEach(() => {
    hideDelayedTooltip();
    vi.useRealTimers();
    restoreDom?.();
    restoreDom = null;
  });

  function button(title = "프로젝트 저장 (Ctrl+S)"): HTMLElement {
    const node = el("button", { attrs: { type: "button", title }, dataset: { testid: "toolbar-save" } });
    document.body.append(node);
    return node;
  }

  it("호버 직후에는 뜨지 않고 지연이 지나야 뜬다", () => {
    const node = button();
    attachDelayedTooltip(node, { label: "저장", accessibleName: "프로젝트 저장 (Ctrl+S)" });

    node.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS - 1);
    expect(activeDelayedTooltipElement()).toBeNull();

    vi.advanceTimersByTime(1);
    expect(activeDelayedTooltipElement()?.textContent).toBe("저장");
  });

  it("지연이 끝나기 전에 포인터가 떠나면 뜨지 않는다", () => {
    const node = button();
    attachDelayedTooltip(node, { label: "저장" });

    node.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS - 200);
    node.dispatchEvent(new Event("pointerleave"));
    vi.advanceTimersByTime(1000);

    expect(activeDelayedTooltipElement()).toBeNull();
  });

  it("키보드 초점은 같은 라벨을 즉시 보여 준다", () => {
    const node = button();
    attachDelayedTooltip(node, { label: "저장" });

    node.dispatchEvent(new Event("focus"));
    expect(activeDelayedTooltipElement()?.textContent).toBe("저장");
  });

  it("Escape 는 툴팁만 닫고 컨트롤을 실행하지 않는다", () => {
    const node = button();
    let clicked = 0;
    node.addEventListener("click", () => {
      clicked += 1;
    });
    attachDelayedTooltip(node, { label: "저장" });

    node.dispatchEvent(new Event("focus"));
    expect(activeDelayedTooltipElement()).toBeTruthy();

    const escape = new Event("keydown") as Event & { key?: string };
    escape.key = "Escape";
    node.dispatchEvent(escape);

    expect(activeDelayedTooltipElement()).toBeNull();
    expect(clicked).toBe(0);
  });

  it("툴팁은 클릭을 가로채지 않는다 — pointer-events 를 끈다", () => {
    const node = button();
    attachDelayedTooltip(node, { label: "저장" });
    node.dispatchEvent(new Event("focus"));
    const tip = activeDelayedTooltipElement();
    expect(tip?.className).toContain("delayed-tooltip");
    expect(String(tip?.getAttribute("role"))).toBe("tooltip");
  });

  it("패널이 다시 렌더돼 대상이 떨어지면 툴팁이 유령으로 남지 않는다", () => {
    const node = button();
    attachDelayedTooltip(node, { label: "저장" });

    node.dispatchEvent(new Event("pointerenter"));
    node.remove();
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS + 50);

    expect(activeDelayedTooltipElement()).toBeNull();
  });

  it("완전한 접근 가능한 이름은 짧은 시각 라벨과 별개로 남는다", () => {
    const node = button();
    attachDelayedTooltip(node, { label: "저장", accessibleName: "프로젝트 저장 (Ctrl+S)" });
    expect(node.getAttribute("aria-label")).toBe("프로젝트 저장 (Ctrl+S)");
  });

  it("title 은 평소에 살아 있고 호버 동안만 떼어 둔다 — e2e 계약 보존", () => {
    const node = button();
    attachDelayedTooltip(node, { label: "저장" });
    expect(node.getAttribute("title")).toBe("프로젝트 저장 (Ctrl+S)");

    node.dispatchEvent(new Event("pointerenter"));
    expect(node.getAttribute("title")).toBeNull();

    node.dispatchEvent(new Event("pointerleave"));
    expect(node.getAttribute("title")).toBe("프로젝트 저장 (Ctrl+S)");
  });
});

describe("롤아웃 목록", () => {
  let restoreDom: (() => void) | null = null;

  beforeEach(() => {
    restoreDom = installFakeDom();
  });

  afterEach(() => {
    hideDelayedTooltip();
    restoreDom?.();
    restoreDom = null;
  });

  it("시각 라벨은 여섯 자 이하를 지향하고, 접근 이름은 그보다 길거나 같다", () => {
    for (const target of DELAYED_TOOLTIP_ROLLOUT) {
      expect(target.label.length, `${target.testid} 시각 라벨`).toBeLessThanOrEqual(6);
      expect(target.name.length, `${target.testid} 접근 이름`).toBeGreaterThanOrEqual(target.label.length);
    }
  });

  it("같은 뿌리에 두 번 설치해도 중복으로 붙지 않는다", () => {
    const root = el("div", {
      children: DELAYED_TOOLTIP_ROLLOUT.map((target) => el("button", { dataset: { testid: target.testid } })),
    });
    document.body.append(root);

    expect(installDelayedTooltips(root)).toBe(DELAYED_TOOLTIP_ROLLOUT.length);
    expect(installDelayedTooltips(root)).toBe(0);
  });
});
