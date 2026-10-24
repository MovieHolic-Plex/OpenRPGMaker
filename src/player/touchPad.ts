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
import { getPlayerPreferences, updatePlayerPreferences } from "@/player/playerPreferences";
import { DEFAULT_TOUCH_CONTROLS, type ResolvedTouchControls } from "@/project/touchControls";

export interface TouchPadHandle {
  readonly cleanup: () => void;
}

const DIRECTION_KEYS = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"] as const;

// 8방향 구역(화면 좌표: y 아래가 +). 2026-10-24 모바일 조작감: 예전에는 축마다 0.35 문턱이라 대각선이 구역의 54%(20.5°~69.5°)를
// 차지했다 — 「오른쪽」으로 밀었는데 엄지가 25°만 기울어도 대각선으로 걸어 칸 게임에서 지그재그·벽 미끄럼이 났다.
// 이제 상하좌우가 넓고(각 56°) 대각선은 좁다(각 34°). 한 번 고른 구역은 경계를 8° 넘어야 바뀐다(떨림 방지).
const STICK_SECTORS: readonly { readonly center: number; readonly keys: readonly string[] }[] = [
  { center: 0, keys: ["ArrowRight"] },
  { center: 45, keys: ["ArrowRight", "ArrowDown"] },
  { center: 90, keys: ["ArrowDown"] },
  { center: 135, keys: ["ArrowLeft", "ArrowDown"] },
  { center: 180, keys: ["ArrowLeft"] },
  { center: -135, keys: ["ArrowLeft", "ArrowUp"] },
  { center: -90, keys: ["ArrowUp"] },
  { center: -45, keys: ["ArrowRight", "ArrowUp"] },
];
const DIAGONAL_HALF_WIDTH = 17;
const CARDINAL_HALF_WIDTH = 28;
const SECTOR_HYSTERESIS = 8;
/** 중립 → 방향은 이 거리(px)를 넘어야, 방향 → 중립은 HOLD 아래로 내려와야. */
export const STICK_DEADZONE = 12;
const STICK_DEADZONE_HOLD = 8;

function angleGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** 손가락 위치(중심 기준 dx,dy) → 8방향 구역 번호(STICK_SECTORS 색인) 또는 null(중립). previous 는 직전 구역(떨림 방지). */
export function stickSector(dx: number, dy: number, previous: number | null): number | null {
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance)) return null;
  if (distance <= (previous === null ? STICK_DEADZONE : STICK_DEADZONE_HOLD)) return null;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const halfWidth = (index: number): number => (index % 2 === 1 ? DIAGONAL_HALF_WIDTH : CARDINAL_HALF_WIDTH);
  if (previous !== null && angleGap(angle, STICK_SECTORS[previous]!.center) <= halfWidth(previous) + SECTOR_HYSTERESIS) return previous;
  for (let index = 1; index < STICK_SECTORS.length; index += 2) {
    if (angleGap(angle, STICK_SECTORS[index]!.center) <= DIAGONAL_HALF_WIDTH) return index;
  }
  let best = 0;
  for (let index = 0; index < STICK_SECTORS.length; index += 2) {
    if (angleGap(angle, STICK_SECTORS[index]!.center) < angleGap(angle, STICK_SECTORS[best]!.center)) best = index;
  }
  return best;
}

export function stickSectorKeys(sector: number | null): readonly string[] {
  return sector === null ? [] : STICK_SECTORS[sector]!.keys;
}

function safeKnobTravel(baseElement: HTMLElement, knobElement: HTMLElement): number {
  const baseDiameter = Math.min(baseElement.offsetWidth, baseElement.offsetHeight);
  const knobDiameter = Math.max(knobElement.offsetWidth, knobElement.offsetHeight);
  if (!Number.isFinite(baseDiameter) || !Number.isFinite(knobDiameter)) return 0;
  if (baseDiameter <= 0 || knobDiameter <= 0) return 0;
  return Math.max(0, (baseDiameter - knobDiameter) / 2);
}

// 현재 플레이는 키보드 전용이다. 터치 패드는 모바일 빌드 env가 명시적으로 켠 경우에만 활성화한다:
// - VITE_TOUCH_CONTROLS(에디터 dev 빌드), OPENRPG_PLAYER_TOUCH_CONTROLS(플레이어 익스포트 빌드)
// - "1|true|on" → 강제 활성, "0|false|off" 또는 미설정 → 비활성.
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

const TOUCH_OVERRIDE_KEY = "oprn-touch-input";

/** 기기가 터치로 쓰였다고 기억한다(첫 실제 터치에서 켬). 다음 부팅부터 터치 UI 로 연다. */
export function rememberTouchInput(): void {
  try { window.localStorage.setItem(TOUCH_OVERRIDE_KEY, "1"); } catch { /* 저장 안 됨 */ }
}

export function rememberedTouchInput(): boolean {
  try { return window.localStorage.getItem(TOUCH_OVERRIDE_KEY) === "1"; } catch { return false; }
}

/** 휴대폰·태블릿 브라우저(UA). 데스크톱 터치 노트북과 구별하는 데 쓴다. iPadOS 는 Mac UA + 터치 점으로 알아본다. */
function isMobileUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|SamsungBrowser/i.test(ua)) return true;
  return /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
}

// 터치 기기 감지(2026-10-24 개정). 갤럭시 폴드처럼 펜 디지타이저가 있는 안드로이드는 `(pointer: fine)` 으로 보고해
// 옛 판정이 키보드 전용으로 열었다 — 그러면 게임 화면 전체가 누름을 막아 「전체 화면」 단추만 반응했다.
// 휴대폰 UA 이거나 거친 포인터가 하나라도 있으면(any-pointer) 터치로 연다. 데스크톱 터치 노트북(정밀 포인터 + 데스크톱 UA)은 그대로 키보드다.
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  const hasPointerQueries = typeof window.matchMedia === "function";
  const query = (q: string): boolean => hasPointerQueries && window.matchMedia(q).matches;
  const touchPoints = typeof navigator !== "undefined" ? navigator.maxTouchPoints ?? 0 : 0;
  if (query("(pointer: coarse)")) return true;
  // 휴대폰·태블릿 UA 는 그 자체로 터치다(iframe 안에서 터치 점·포인터 질의가 비어 오는 브라우저가 있다).
  if (isMobileUserAgent() || rememberedTouchInput()) return true;
  if (touchPoints > 0 && query("(any-pointer: coarse)") && query("(hover: none)")) return true;
  // Hybrid laptops and desktop browsers can expose touch APIs while their primary
  // interaction remains a mouse. Avoid covering the play surface there.
  if (query("(pointer: fine)")) return false;
  return "ontouchstart" in window || touchPoints > 0;
}

function localized(ko: string, ja: string, zh: string, en: string): string {
  const lang = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase();
  if (lang.startsWith("ko")) return ko;
  if (lang.startsWith("ja")) return ja;
  if (lang.startsWith("zh")) return zh;
  return en;
}

function menuLabel(): string {
  return localized("메뉴", "メニュー", "菜单", "Menu");
}

function runLabel(): string {
  return localized("달리기", "ダッシュ", "奔跑", "Run");
}

/** 짧은 진동(지원 기기만). iOS 사파리는 navigator.vibrate 가 없다 — 조용히 넘어간다. */
function buzz(ms: number): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(ms);
  } catch { /* 권한·정책 */ }
}

/** 키보드와 같은 곳(초점 요소)에 보낸다 — 상점처럼 자기 상자에 keydown 을 거는 화면도 패드를 받는다. 거품은 document 까지 올라간다. */
export function keyTarget(): EventTarget {
  const active = typeof document !== "undefined" ? document.activeElement : null;
  if (active && active !== document.body && active !== document.documentElement && active.isConnected) return active;
  return document;
}

function dispatchKey(type: "keydown" | "keyup", key: string): void {
  keyTarget().dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }));
}

// host(플레이 스테이지)에 가상 패드를 부착한다.
// env 오버라이드가 명시적으로 true일 때만 부착한다. 그 외에는 no-op.
export interface TouchPadOptions {
  /** 호출부가 켠다(기기 판정 포함). 없으면 env 오버라이드만 따른다. */
  readonly enabled?: boolean;
  /** `gba`: 480×320 스테이지에 맞춘 작은 패드(D15). */
  readonly skin?: "gba" | "touch";
  /** `touch`: 일반 게임용 — gba 와 같은 뷰포트 배치, 손가락 크기. */
  /** 조이스틱 방식·진동·달리기 단추. 매 누름마다 다시 읽는다(옵션을 바꾸면 바로 듣는다). 없으면 기본값. */
  readonly settings?: () => ResolvedTouchControls;
}

export function createTouchPad(host: HTMLElement, options?: TouchPadOptions): TouchPadHandle {
  if (options?.enabled !== true && touchControlsOverride() !== true) {
    return { cleanup: () => {} };
  }

  const controller = new AbortController();
  const listenerOptions = { signal: controller.signal };
  const settings = (): ResolvedTouchControls => options?.settings?.() ?? DEFAULT_TOUCH_CONTROLS;
  const haptic = (ms: number): void => { if (settings().haptics) buzz(ms); };
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

  // ── 조이스틱(왼쪽) ──
  // 떠다니는 조이스틱: 왼쪽 조작 영역(zone) 어디를 눌러도 그 자리가 중심이 되고, 손가락을 따라 방향을 낸다.
  // 손을 떼면 쉬는 자리(CSS)로 돌아간다. zone 이 없는 옛 배치(무대 안 패드)에서는 base 를 그대로 누른다.
  const base = el("div", { class: "touch-dpad-base" });
  const knob = el("div", { class: "touch-dpad-knob" });
  base.append(knob);
  const dpad = el("div", {
    class: "touch-dpad",
    dataset: { testid: "touch-dpad" },
    children: [base],
  });

  let dpadPointerId: number | null = null;
  let center: { x: number; y: number } | null = null;
  let sector: number | null = null;
  /** fixed 방식: 판은 쉬는 자리에 그대로 있고 손가락이 멀리 가도 따라오지 않는다. */
  let anchored = false;

  const applyPointer = (clientX: number, clientY: number): void => {
    let cx: number;
    let cy: number;
    if (center) {
      cx = center.x;
      cy = center.y;
    } else {
      const rect = base.getBoundingClientRect();
      cx = rect.left + rect.width / 2;
      cy = rect.top + rect.height / 2;
    }
    const dx = clientX - cx;
    const dy = clientY - cy;
    const measuredDistance = Math.hypot(dx, dy);
    const distance = Number.isFinite(measuredDistance) ? measuredDistance : 0;
    const unitX = distance > 0 ? dx / distance : 0;
    const unitY = distance > 0 ? dy / distance : 0;
    const next = stickSector(dx, dy, sector);
    if (next !== sector) {
      // 방향이 처음 잡히거나 바뀔 때 짧게 떤다 — 눈을 화면에 둔 채 엄지로 방향을 느낀다.
      if (next !== null) haptic(sector === null ? 8 : 5);
      sector = next;
    }
    const held = stickSectorKeys(sector);
    for (const key of DIRECTION_KEYS) if (!held.includes(key)) setKeyHeld(key, false);
    for (const key of held) setKeyHeld(key, true);
    // knob 시각 이동(반경 제한).
    const maxTravel = safeKnobTravel(base, knob);
    const visualTravel = Math.min(distance, maxTravel);
    knob.style.transform = `translate(${unitX * visualTravel}px, ${unitY * visualTravel}px)`;
    // 손가락이 반경 밖으로 멀리 끌면 조이스틱 중심이 따라온다(엄지가 미끄러져도 방향이 살아 있다).
    if (center && !anchored && maxTravel > 0 && distance > maxTravel * 1.6) {
      const pull = distance - maxTravel * 1.6;
      center = { x: center.x + unitX * pull, y: center.y + unitY * pull };
      placeBase(center.x, center.y);
    }
  };

  const zone = el("div", {
    class: "touch-stick-zone",
    dataset: { testid: "touch-stick-zone" },
    children: [dpad],
  });

  const placeBase = (clientX: number, clientY: number): void => {
    const zoneRect = zone.getBoundingClientRect();
    if (zoneRect.width <= 0 || zoneRect.height <= 0) return;
    dpad.style.left = `${clientX - zoneRect.left}px`;
    dpad.style.top = `${clientY - zoneRect.top}px`;
    dpad.dataset.floating = "true";
  };

  const resetKnob = (): void => {
    knob.style.transform = "translate(0px, 0px)";
    dpad.style.removeProperty("left");
    dpad.style.removeProperty("top");
    delete dpad.dataset.floating;
    delete zone.dataset.active;
    center = null;
    sector = null;
    anchored = false;
  };

  const releaseDpadPointer = (): void => {
    const pointerId = dpadPointerId;
    dpadPointerId = null;
    if (pointerId !== null && zone.hasPointerCapture?.(pointerId)) {
      zone.releasePointerCapture(pointerId);
    }
    releaseDirectionKeys();
    resetKnob();
  };

  const onDpadDown = (event: PointerEvent): void => {
    if (dpadPointerId !== null) return;
    event.preventDefault();
    dpadPointerId = event.pointerId;
    try { zone.setPointerCapture(event.pointerId); } catch { /* 합성 이벤트 */ }
    zone.dataset.active = "true";
    // 방식(system.touchControls.stick / 플레이어 옵션):
    //  auto — 판 위나 판 곁(반지름 1.7배 안)을 누르면 판 중심 기준으로 곧장 방향이 나간다. 판에서 먼 곳이면 엄지 밑으로 판이 온다.
    //         (예전에는 판 밖을 누르면 늘 그 자리가 중심이 돼 「오른쪽을 눌렀는데 안 움직인다」 — 손가락을 다시 밀어야 했다.)
    //  fixed — 영역 어디를 눌러도 판 중심 기준. 판은 움직이지 않는다.
    //  floating — 누른 자리가 늘 중심.
    const mode = settings().stick;
    const rect = base.getBoundingClientRect();
    const baseCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const fromBase = Math.hypot(event.clientX - baseCenter.x, event.clientY - baseCenter.y);
    const nearBase = fromBase <= (rect.width / 2) * 1.7;
    const canFloat = zone.isConnected && zone.getBoundingClientRect().width > 0;
    if (!canFloat || mode === "fixed" || (mode === "auto" && nearBase)) {
      center = baseCenter;
      anchored = mode === "fixed";
    } else {
      center = { x: event.clientX, y: event.clientY };
      placeBase(event.clientX, event.clientY);
    }
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
  zone.addEventListener("pointerdown", onDpadDown, listenerOptions);
  zone.addEventListener("pointermove", onDpadMove, listenerOptions);
  zone.addEventListener("pointerup", onDpadUp, listenerOptions);
  zone.addEventListener("pointercancel", onDpadUp, listenerOptions);
  zone.addEventListener("lostpointercapture", onDpadCaptureLost, listenerOptions);

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
      try { btn.setPointerCapture(event.pointerId); } catch { /* 합성 이벤트 */ }
      btn.classList.add("active");
      haptic(10);
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
  // 메뉴 단추 — 필드에서 메뉴를 연다(Esc 와 같은 길). B 와 같은 키지만 「메뉴」라고 써 있어야 찾는다.
  const menuButton = makeActionButton(menuLabel(), "Escape", "touch-menu");
  menuButton.classList.add("touch-menu-btn");

  // 달리기 단추 — 누를 때마다 걷기/달리기(플레이어 옵션 「항상 달리기」와 같은 값). 키보드의 Shift 는 이 값을 뒤집는다.
  const runButton = el("button", {
    class: "touch-run-btn",
    text: runLabel(),
    attrs: { type: "button", "aria-label": runLabel() },
    dataset: { testid: "touch-run" },
  });
  const syncRun = (): void => {
    const on = getPlayerPreferences().alwaysRun === true;
    runButton.setAttribute("aria-pressed", on ? "true" : "false");
    runButton.classList.toggle("on", on);
  };
  syncRun();
  window.addEventListener("oprn:player-preferences", syncRun, listenerOptions);
  runButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    updatePlayerPreferences({ alwaysRun: getPlayerPreferences().alwaysRun !== true });
    haptic(10);
    syncRun();
  }, listenerOptions);
  const runVisible = settings().runButton;
  if (!runVisible) runButton.hidden = true;

  const pad = el("div", {
    class: "touch-pad",
    dataset: { testid: "touch-pad", playInputOwner: "touch-controls", ...(options?.skin ? { skin: options.skin } : {}) },
    children: [zone, actions, menuButton, runButton],
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
