// player/touchPad.ts
// 모바일/터치 기기 전용 가상 패드 DOM 오버레이.
// - 좌하단: 아날로그식 8방향 D-pad(손가락 위치 → 방향 키 합성)
// - 우하단: 확인(A)/취소(B) 버튼
//
// 게임 로직과의 결합을 최소화하기 위해, 패드는 별도의 입력 주입 API를 쓰지 않고
// document 에 합성 KeyboardEvent(방향키/Enter/Escape)를 디스패치한다.
// 이동(Input), 대사 진행/선택지(dialogue), 메뉴/타이틀 모두 이미 document keydown
// 을 event.key 로 처리하므로, 키 합성만으로 데스크톱과 동일한 경로를 재사용한다.
// 데스크톱(포인터 fine)에서는 아무 것도 렌더링하지 않아 영향이 0 이다.

import { el } from "@/util/dom";

export interface TouchPadHandle {
  readonly cleanup: () => void;
}

// 모바일 터치 조작은 현재 후순위(비활성). touchPad 코드/CSS/testid 는 그대로 두고
// 마운트만 막는다. VITE_TOUCH_CONTROLS=1 로 빌드하면 다시 활성화된다.
export const ENABLE_TOUCH_CONTROLS: boolean =
  import.meta.env.VITE_TOUCH_CONTROLS === "1" || import.meta.env.VITE_TOUCH_CONTROLS === "true";

// 터치/coarse 포인터 기기 감지.
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  const coarse =
    typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const touchPoints = typeof navigator !== "undefined" ? navigator.maxTouchPoints ?? 0 : 0;
  return coarse || "ontouchstart" in window || touchPoints > 0;
}

function dispatchKey(type: "keydown" | "keyup", key: string): void {
  document.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
}

// host(플레이 스테이지)에 가상 패드를 부착한다. 터치 기기가 아니면 no-op.
export function createTouchPad(host: HTMLElement): TouchPadHandle {
  if (!ENABLE_TOUCH_CONTROLS || !isTouchDevice()) {
    return { cleanup: () => {} };
  }

  const heldKeys = new Set<string>();
  const setKeyHeld = (key: string, held: boolean): void => {
    if (held && !heldKeys.has(key)) {
      heldKeys.add(key);
      dispatchKey("keydown", key);
    } else if (!held && heldKeys.has(key)) {
      heldKeys.delete(key);
      dispatchKey("keyup", key);
    }
  };
  const releaseAll = (): void => {
    for (const key of [...heldKeys]) setKeyHeld(key, false);
  };

  // ── D-pad(좌하단) ──
  const base = el("div", { class: "touch-dpad-base" });
  const knob = el("div", { class: "touch-dpad-knob" });
  base.append(knob);
  const dpad = el("div", {
    class: "touch-dpad",
    dataset: { testid: "touch-dpad" },
    children: [base],
  });

  const DEADZONE = 14; // px: 중앙 근처는 중립(방향 없음)
  let dragging = false;

  const applyPointer = (clientX: number, clientY: number): void => {
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    // 축별 데드존 판정 → 상/하/좌/우 조합으로 8방향.
    const right = dx > DEADZONE;
    const left = dx < -DEADZONE;
    const down = dy > DEADZONE;
    const up = dy < -DEADZONE;
    setKeyHeld("ArrowRight", right);
    setKeyHeld("ArrowLeft", left);
    setKeyHeld("ArrowDown", down);
    setKeyHeld("ArrowUp", up);
    // knob 시각 이동(반경 제한).
    const radius = rect.width / 2;
    const dist = Math.hypot(dx, dy);
    const scale = dist > radius ? radius / dist : 1;
    knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
  };

  const resetKnob = (): void => {
    knob.style.transform = "translate(0px, 0px)";
  };

  const onDpadDown = (event: PointerEvent): void => {
    event.preventDefault();
    dragging = true;
    base.setPointerCapture(event.pointerId);
    applyPointer(event.clientX, event.clientY);
  };
  const onDpadMove = (event: PointerEvent): void => {
    if (!dragging) return;
    event.preventDefault();
    applyPointer(event.clientX, event.clientY);
  };
  const onDpadUp = (event: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    if (base.hasPointerCapture(event.pointerId)) base.releasePointerCapture(event.pointerId);
    releaseAll();
    resetKnob();
  };
  base.addEventListener("pointerdown", onDpadDown);
  base.addEventListener("pointermove", onDpadMove);
  base.addEventListener("pointerup", onDpadUp);
  base.addEventListener("pointercancel", onDpadUp);

  // ── 확인/취소 버튼(우하단) ──
  const makeActionButton = (label: string, key: string, testid: string): HTMLElement => {
    const btn = el("button", {
      class: "touch-action-btn",
      text: label,
      attrs: { type: "button", "aria-label": label },
      dataset: { testid },
    });
    const press = (event: PointerEvent): void => {
      event.preventDefault();
      btn.classList.add("active");
      dispatchKey("keydown", key);
    };
    const release = (event: PointerEvent): void => {
      event.preventDefault();
      btn.classList.remove("active");
      dispatchKey("keyup", key);
    };
    btn.addEventListener("pointerdown", press);
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("pointerleave", (event) => {
      if (btn.classList.contains("active")) release(event as PointerEvent);
    });
    return btn;
  };

  const actionA = makeActionButton("A", "Enter", "touch-action-a");
  const actionB = makeActionButton("B", "Escape", "touch-action-b");
  const actions = el("div", {
    class: "touch-actions",
    dataset: { testid: "touch-actions" },
    children: [actionB, actionA],
  });

  const pad = el("div", {
    class: "touch-pad",
    dataset: { testid: "touch-pad" },
    children: [dpad, actions],
  });
  host.append(pad);

  return {
    cleanup: () => {
      releaseAll();
      pad.remove();
    },
  };
}
