// player/touchPad.ts
// 모바일/터치 기기 전용 가상 패드 DOM 오버레이.
// - 좌하단: 아날로그식 8방향 D-pad(손가락 위치 → 방향 키 합성)
// - 우하단: 확인(A)/취소(B) 버튼
//
// 게임 로직과의 결합을 최소화하기 위해, 패드는 별도의 입력 주입 API를 쓰지 않고
// document 에 합성 KeyboardEvent(방향키/Enter/Escape)를 디스패치한다.
// 이동(Input), 대사 진행/선택지(dialogue), 메뉴/타이틀 모두 이미 document keydown
// 을 event.key 로 처리하므로, 키 합성만으로 데스크톱과 동일한 경로를 재사용한다.
// 데스크톱(포인터 fine)에서는 env 로 강제 활성화하지 않는 한 아무 것도 렌더링하지
// 않아 영향이 0 이다.

import { el } from "@/util/dom";

export interface TouchPadHandle {
  readonly cleanup: () => void;
}

const DIRECTION_KEYS = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"] as const;
const DIRECTION_THRESHOLD = 0.35;

function safeKnobTravel(baseElement: HTMLElement, knobElement: HTMLElement): number {
  const baseDiameter = Math.min(baseElement.offsetWidth, baseElement.offsetHeight);
  const knobDiameter = Math.max(knobElement.offsetWidth, knobElement.offsetHeight);
  if (!Number.isFinite(baseDiameter) || !Number.isFinite(knobDiameter)) return 0;
  if (baseDiameter <= 0 || knobDiameter <= 0) return 0;
  return Math.max(0, (baseDiameter - knobDiameter) / 2);
}

// 터치 지원 기기에서는 기본 자동 활성화한다. env 로 강제 오버라이드할 수 있다:
// - VITE_TOUCH_CONTROLS(에디터 dev 빌드), OPENRPG_PLAYER_TOUCH_CONTROLS(플레이어 익스포트 빌드)
// - "1|true|on" → 기기와 무관하게 강제 활성, "0|false|off" → 강제 비활성,
//   미설정 → 기기 자동 감지(isTouchDevice).
function touchControlsOverride(): boolean | null {
  const overrides = [
    import.meta.env.VITE_TOUCH_CONTROLS,
    import.meta.env.OPENRPG_PLAYER_TOUCH_CONTROLS,
  ];
  for (const raw of overrides) {
    const setting = raw?.trim().toLowerCase();
    if (setting === "1" || setting === "true" || setting === "on") return true;
    if (setting === "0" || setting === "false" || setting === "off") return false;
  }
  return null;
}

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

// host(플레이 스테이지)에 가상 패드를 부착한다.
// env 오버라이드가 있으면 그 값을, 없으면 터치 기기 자동 감지를 따른다. 비활성이면 no-op.
export function createTouchPad(host: HTMLElement): TouchPadHandle {
  if (!(touchControlsOverride() ?? isTouchDevice())) {
    return { cleanup: () => {} };
  }

  const controller = new AbortController();
  const listenerOptions = { signal: controller.signal };
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
  const releaseAllKeys = (): void => {
    for (const key of [...heldKeys]) setKeyHeld(key, false);
  };
  const releaseDirectionKeys = (): void => {
    for (const key of DIRECTION_KEYS) setKeyHeld(key, false);
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
  let dpadPointerId: number | null = null;

  const applyPointer = (clientX: number, clientY: number): void => {
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const measuredDistance = Math.hypot(dx, dy);
    const distance = Number.isFinite(measuredDistance) ? measuredDistance : 0;
    const unitX = distance > 0 ? dx / distance : 0;
    const unitY = distance > 0 ? dy / distance : 0;
    const outsideDeadzone = distance > DEADZONE;
    // 축별 데드존 판정 → 상/하/좌/우 조합으로 8방향.
    const right = outsideDeadzone && unitX > DIRECTION_THRESHOLD;
    const left = outsideDeadzone && unitX < -DIRECTION_THRESHOLD;
    const down = outsideDeadzone && unitY > DIRECTION_THRESHOLD;
    const up = outsideDeadzone && unitY < -DIRECTION_THRESHOLD;
    setKeyHeld("ArrowRight", right);
    setKeyHeld("ArrowLeft", left);
    setKeyHeld("ArrowDown", down);
    setKeyHeld("ArrowUp", up);
    // knob 시각 이동(반경 제한).
    const maxTravel = safeKnobTravel(base, knob);
    const visualTravel = Math.min(distance, maxTravel);
    knob.style.transform = `translate(${unitX * visualTravel}px, ${unitY * visualTravel}px)`;
  };

  const resetKnob = (): void => {
    knob.style.transform = "translate(0px, 0px)";
  };

  const releaseDpadPointer = (): void => {
    const pointerId = dpadPointerId;
    dpadPointerId = null;
    if (pointerId !== null && base.hasPointerCapture(pointerId)) {
      base.releasePointerCapture(pointerId);
    }
    releaseDirectionKeys();
    resetKnob();
  };

  const onDpadDown = (event: PointerEvent): void => {
    if (dpadPointerId !== null) return;
    event.preventDefault();
    dpadPointerId = event.pointerId;
    base.setPointerCapture(event.pointerId);
    applyPointer(event.clientX, event.clientY);
  };
  const onDpadMove = (event: PointerEvent): void => {
    if (dpadPointerId !== event.pointerId) return;
    event.preventDefault();
    applyPointer(event.clientX, event.clientY);
  };
  const onDpadUp = (event: PointerEvent): void => {
    if (dpadPointerId !== event.pointerId) return;
    event.preventDefault();
    releaseDpadPointer();
  };
  const onDpadCaptureLost = (event: PointerEvent): void => {
    if (dpadPointerId !== event.pointerId) return;
    dpadPointerId = null;
    releaseDirectionKeys();
    resetKnob();
  };
  base.addEventListener("pointerdown", onDpadDown, listenerOptions);
  base.addEventListener("pointermove", onDpadMove, listenerOptions);
  base.addEventListener("pointerup", onDpadUp, listenerOptions);
  base.addEventListener("pointercancel", onDpadUp, listenerOptions);
  base.addEventListener("lostpointercapture", onDpadCaptureLost, listenerOptions);

  // ── 확인/취소 버튼(우하단) ──
  const releaseActionPointers: Array<() => void> = [];
  const makeActionButton = (label: string, key: string, testid: string): HTMLElement => {
    const btn = el("button", {
      class: "touch-action-btn",
      text: label,
      attrs: { type: "button", "aria-label": label },
      dataset: { testid },
    });
    let pointerId: number | null = null;
    const reset = (): void => {
      const activePointerId = pointerId;
      pointerId = null;
      if (activePointerId !== null && btn.hasPointerCapture(activePointerId)) {
        btn.releasePointerCapture(activePointerId);
      }
      btn.classList.remove("active");
      setKeyHeld(key, false);
    };
    const press = (event: PointerEvent): void => {
      if (pointerId !== null) return;
      event.preventDefault();
      pointerId = event.pointerId;
      btn.setPointerCapture(event.pointerId);
      btn.classList.add("active");
      setKeyHeld(key, true);
    };
    const release = (event: PointerEvent): void => {
      if (pointerId !== event.pointerId) return;
      event.preventDefault();
      reset();
    };
    const captureLost = (event: PointerEvent): void => {
      if (pointerId !== event.pointerId) return;
      pointerId = null;
      btn.classList.remove("active");
      setKeyHeld(key, false);
    };
    btn.addEventListener("pointerdown", press, listenerOptions);
    btn.addEventListener("pointerup", release, listenerOptions);
    btn.addEventListener("pointercancel", release, listenerOptions);
    btn.addEventListener("lostpointercapture", captureLost, listenerOptions);
    btn.addEventListener("pointerleave", (event) => {
      if (btn.classList.contains("active")) release(event);
    }, listenerOptions);
    releaseActionPointers.push(reset);
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
    dataset: { testid: "touch-pad", playInputOwner: "touch-controls" },
    children: [dpad, actions],
  });
  host.append(pad);

  const releaseAllInteractions = (): void => {
    releaseDpadPointer();
    for (const release of releaseActionPointers) release();
    releaseAllKeys();
  };
  const releaseOnVisibilityLoss = (): void => {
    if (document.visibilityState !== "visible") releaseAllInteractions();
  };
  window.addEventListener("blur", releaseAllInteractions, listenerOptions);
  document.addEventListener("visibilitychange", releaseOnVisibilityLoss, listenerOptions);

  let cleanedUp = false;

  return {
    cleanup: () => {
      if (cleanedUp) return;
      cleanedUp = true;
      releaseAllInteractions();
      controller.abort();
      pad.remove();
    },
  };
}
