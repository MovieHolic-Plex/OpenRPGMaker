/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installPlayPointerBlocker, shouldBlockPlayPointerEvent } from "@/player/playInputBlocker";

const FORCE_BLOCK_GLOBAL = globalThis as { __oprnForcePointerBlock?: boolean };

describe("play pointer blocker", () => {
  beforeEach(() => {
    FORCE_BLOCK_GLOBAL.__oprnForcePointerBlock = true;
  });

  afterEach(() => {
    delete FORCE_BLOCK_GLOBAL.__oprnForcePointerBlock;
  });

  it("blocks trusted mouse-style clicks while allowing keyboard-synthetic button clicks", () => {
    expect(shouldBlockPlayPointerEvent({ type: "pointerdown" })).toBe(true);
    expect(shouldBlockPlayPointerEvent({ type: "click", detail: 1 })).toBe(true);
    expect(shouldBlockPlayPointerEvent({ type: "click", detail: 0 })).toBe(false);
    expect(shouldBlockPlayPointerEvent({ type: "click" })).toBe(false);
  });

  it("lets the wheel through over scrollable reading lists and nowhere else", () => {
    for (const className of ["status-menu-detail-list", "dialogue-backlog-list", "dialogue-log-list"]) {
      const list = document.createElement("ol");
      list.className = className;
      const row = document.createElement("li");
      list.append(row);
      expect(shouldBlockPlayPointerEvent({ type: "wheel", target: row })).toBe(false);
      // 목록 위라도 누르기·움직임은 그대로 막는다.
      expect(shouldBlockPlayPointerEvent({ type: "pointerdown", target: row })).toBe(true);
      expect(shouldBlockPlayPointerEvent({ type: "mousemove", target: row })).toBe(true);
    }
    expect(shouldBlockPlayPointerEvent({ type: "wheel", target: document.createElement("div") })).toBe(true);
  });

  it("blocks title-control pointers with the rest of keyboard-only play", () => {
    const g = globalThis as { __oprnForcePointerBlock?: boolean };
    g.__oprnForcePointerBlock = true;
    try {
      const titleControls = document.createElement("section");
      titleControls.dataset.playInputOwner = "title-controls";
      const option = document.createElement("button");
      titleControls.append(option);
      expect(shouldBlockPlayPointerEvent({ type: "click", detail: 1, target: option })).toBe(true);
      expect(shouldBlockPlayPointerEvent({ type: "pointerdown", target: option })).toBe(true);
      // 필드 클릭은 여전히 차단
      expect(
        shouldBlockPlayPointerEvent({ type: "click", detail: 1, target: document.createElement("div") })
      ).toBe(true);
    } finally {
      delete g.__oprnForcePointerBlock;
    }
  });

  it("allows only explicitly owned touch and host-fullscreen descendants", () => {
    const touchOwner = document.createElement("div");
    touchOwner.dataset.playInputOwner = "touch-controls";
    const control = document.createElement("button");
    touchOwner.append(control);
    const fullscreen = document.createElement("button");
    fullscreen.dataset.playInputOwner = "host-fullscreen";
    const ordinaryStage = document.createElement("div");

    expect(shouldBlockPlayPointerEvent({ type: "pointerdown", target: control })).toBe(false);
    expect(shouldBlockPlayPointerEvent({ type: "pointerdown", target: fullscreen })).toBe(false);
    expect(shouldBlockPlayPointerEvent({ type: "pointerdown", target: ordinaryStage })).toBe(true);
  });

  // 사장 1.37 VQA D1(2026-11-05): 데스크톱 1440 에서 전투 커맨드 여섯 개가 모두 마우스로
  // 눌리지 않았다(같은 버튼 Enter 는 대상 선택을 열었다, 아이폰 터치는 동작했다). 원인은 둘이었다 —
  // 09-keyboard-result-panel.css 가 pointer-events:none 을 걸었고, 게다 이 차단기가 capture 단계에서
  // detail>0 인 실제 click 을 막았다. 커맨드·대상은 누름/클릭만 통과하고 나머지 포인터는 그대로 막는지 고정한다.
  it("lets real mouse clicks reach battle commands and enemy targets", () => {
    const scene = document.createElement("div");
    scene.className = "battle-scene";
    const commandHost = document.createElement("div");
    commandHost.className = "battle-command-host";
    const button = document.createElement("button");
    button.className = "battle-command";
    const label = document.createElement("strong");
    commandHost.append(button);
    button.append(label);
    scene.append(commandHost);
    const field = document.createElement("div");
    field.className = "battle-field";
    const sprite = document.createElement("div");
    sprite.dataset.battleTargetable = "true";
    sprite.dataset.battleTargetId = "enemy-1";
    field.append(sprite);
    scene.append(field);

    // 커맨드 단추(안쪽 <strong> 이 실제 target 이다)와 적 스프라이트는 마우스로 눌린다.
    for (const target of [label, button, sprite]) {
      expect(shouldBlockPlayPointerEvent({ type: "click", detail: 1, target })).toBe(false);
      expect(shouldBlockPlayPointerEvent({ type: "pointerdown", target })).toBe(false);
    }
    // 호버·끌기·휠은 전투 패널에서도 그대로 막힌다 — 통과시키는 것은 누름/클릭뿐이다.
    for (const type of ["mouseover", "mousemove", "pointermove", "wheel", "dragstart"]) {
      expect(shouldBlockPlayPointerEvent({ type, target: label })).toBe(true);
    }
    // 맵·스테이지 같은 나머지 누름도 여전히 막힌다.
    const stage = document.createElement("div");
    expect(shouldBlockPlayPointerEvent({ type: "click", detail: 1, target: stage })).toBe(true);

    let activations = 0;
    button.addEventListener("click", () => {
      activations += 1;
    });
    const mouseClick = detailedClick(1);
    label.dispatchEvent(mouseClick);
    expect(mouseClick.defaultPrevented).toBe(false);
    expect(activations).toBe(1);
  });

  it("prevents dispatched mouse clicks from changing state but allows keyboard-synthetic clicks", () => {
    const root = document.createElement("div");
    const cleanup = installPlayPointerBlocker(root);
    let activations = 0;
    root.addEventListener("click", () => {
      activations += 1;
    });

    const mouseClick = detailedClick(1);
    root.dispatchEvent(mouseClick);
    expect(mouseClick.defaultPrevented).toBe(true);
    expect(activations).toBe(0);

    const keyboardClick = detailedClick(0);
    root.dispatchEvent(keyboardClick);
    expect(keyboardClick.defaultPrevented).toBe(false);
    expect(activations).toBe(1);
    cleanup();
  });

  // 실측 2026-09-17: 편집기 타일 검색창에 포커스가 한 번 들어가면 테스트 플레이에서
  // 방향키가 죽는다. input.ts 의 두 이동 경로가 isTextEntryFocused() 로 스스로를 끄기
  // 때문이다. 차단기가 mousedown 을 preventDefault 하므로 브라우저 기본 포커스 이전도
  // 취소된다 — 플레이 화면을 눌러도 영영 복구되지 않는다. 눌림을 가로채는 쪽이 포커스
  // 이전까지 책임진다.
  it("returns keyboard ownership to play when a stranded text field holds focus", () => {
    const stranded = document.createElement("input");
    stranded.type = "search";
    document.body.append(stranded);
    const root = document.createElement("div");
    document.body.append(root);
    const cleanup = installPlayPointerBlocker(root);
    stranded.focus();
    expect(document.activeElement).toBe(stranded);

    root.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
    expect(document.activeElement).not.toBe(stranded);

    cleanup();
    stranded.remove();
    root.remove();
  });

  it("leaves focus alone while the pointer merely moves over play", () => {
    const stranded = document.createElement("input");
    stranded.type = "search";
    document.body.append(stranded);
    const root = document.createElement("div");
    document.body.append(root);
    const cleanup = installPlayPointerBlocker(root);
    stranded.focus();

    for (const type of ["pointermove", "mousemove", "mouseover", "pointerover", "wheel"]) {
      root.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
    }
    expect(document.activeElement).toBe(stranded);

    cleanup();
    stranded.remove();
    root.remove();
  });

  it("automation receives the same production pointer semantics", () => {
    const navigatorPrototype = Object.getPrototypeOf(navigator);
    const original = Object.getOwnPropertyDescriptor(navigatorPrototype, "webdriver");
    Object.defineProperty(navigator, "webdriver", { configurable: true, value: true });
    try {
      expect(shouldBlockPlayPointerEvent({ type: "click", detail: 1 })).toBe(true);
      expect(shouldBlockPlayPointerEvent({ type: "pointerdown" })).toBe(true);
    } finally {
      if (original) Object.defineProperty(navigatorPrototype, "webdriver", original);
      else Object.defineProperty(navigator, "webdriver", { configurable: true, value: undefined });
    }
  });
});

function detailedClick(detail: number): Event {
  const event = new Event("click", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "detail", { configurable: true, value: detail });
  return event;
}
