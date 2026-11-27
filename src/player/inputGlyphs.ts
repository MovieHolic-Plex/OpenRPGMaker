/**
 * 활성 입력 장치 감지 및 컨트롤러 글리프 표기.
 *
 * desktopShellBridge.ts 에 의존하거나 수정하지 않고 독립적으로 window 의
 * keydown / pointerdown / gamepadconnected / gamepaddisconnected 와
 * navigator.getGamepads() 를 관찰해 현재 입력 장치(keyboard / xbox / playstation / nintendo)를 판별한다.
 */
import {
  formatKeyLabel,
  getCustomKeyBindings,
  getKeysForAction,
  type RemappableAction,
} from "@/player/keyBindings";
import type { SupportedLocale } from "@/i18n/locale";

export type InputDeviceKind = "keyboard" | "xbox" | "playstation" | "nintendo";
export type ControllerDeviceKind = Exclude<InputDeviceKind, "keyboard">;
export type GlyphAction = RemappableAction | "move" | "menu" | "scroll";

export type ControlHintSpec = {
  readonly action: GlyphAction;
  readonly label: string;
};

const CONTROLLER_GLYPHS: Readonly<Record<ControllerDeviceKind, Readonly<Record<GlyphAction, string>>>> = {
  xbox: {
    confirm: "A",
    cancel: "B",
    menu: "Y/Start",
    move: "D-Pad",
    up: "↑",
    down: "↓",
    left: "←",
    right: "→",
    dash: "X/LB",
    skill: "RB",
    skillCycle: "LT",
    guard: "RT",
    autoBattle: "View",
    scroll: "D-Pad",
  },
  playstation: {
    confirm: "✕",
    cancel: "○",
    menu: "△/Options",
    move: "D-Pad",
    up: "↑",
    down: "↓",
    left: "←",
    right: "→",
    dash: "□/L1",
    skill: "R1",
    skillCycle: "L2",
    guard: "R2",
    autoBattle: "Touchpad",
    scroll: "D-Pad",
  },
  nintendo: {
    confirm: "B",
    cancel: "A",
    menu: "X/+",
    move: "D-Pad",
    up: "↑",
    down: "↓",
    left: "←",
    right: "→",
    dash: "Y/L",
    skill: "R",
    skillCycle: "ZL",
    guard: "ZR",
    autoBattle: "-",
    scroll: "D-Pad",
  },
};

/**
 * HTML5 Gamepad `id` 문자열에서 컨트롤러 벤더(PlayStation / Nintendo / Xbox)를 판별한다.
 * DualSense/DualShock/054c → playstation, Switch/Pro Controller/057e → nintendo,
 * 그 외 Xbox/XInput/Steam Deck → xbox.
 */
export function detectGamepadVendor(gamepadId: string | null | undefined): ControllerDeviceKind {
  const id = (gamepadId ?? "").toLowerCase();
  if (/xbox|xinput|steam\s*deck|microsoft|\b045e\b|vendor:\s*045e/iu.test(id)) {
    return "xbox";
  }
  if (/dualsense|dualshock|playstation|\bps[345]\b|sony|\b054c\b|vendor:\s*054c|wireless controller/iu.test(id)) {
    return "playstation";
  }
  if (/nintendo|switch|joy-con|joycon|pro controller|\b057e\b|vendor:\s*057e/iu.test(id)) {
    return "nintendo";
  }
  return "xbox";
}

function readConnectedGamepad(): Gamepad | undefined {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return undefined;
  try {
    const pads = navigator.getGamepads();
    return Array.from(pads ?? []).find((pad): pad is Gamepad => Boolean(pad && pad.connected));
  } catch {
    return undefined;
  }
}

export function detectConnectedGamepadDevice(): ControllerDeviceKind | null {
  const pad = readConnectedGamepad();
  if (pad) return detectGamepadVendor(pad.id);
  if (typeof window !== "undefined") {
    const shell = (window as Window & { __oprnDesktopShellState?: { gamepadConnected?: boolean; gamepadId?: string | null } }).__oprnDesktopShellState;
    if (shell?.gamepadConnected) return detectGamepadVendor(shell.gamepadId);
  }
  return null;
}

function keyboardGlyphForAction(action: GlyphAction): string {
  const custom = getCustomKeyBindings();
  switch (action) {
    case "confirm": {
      if (custom.confirm?.length) return custom.confirm.slice(0, 2).map(formatKeyLabel).join("/");
      return "Enter/Z";
    }
    case "cancel":
    case "menu": {
      if (custom.cancel?.length) return custom.cancel.slice(0, 2).map(formatKeyLabel).join("/");
      return "Esc/X";
    }
    case "move": {
      if (custom.up || custom.down || custom.left || custom.right) {
        return [
          formatKeyLabel(getKeysForAction("up")[0] ?? "arrowup"),
          formatKeyLabel(getKeysForAction("down")[0] ?? "arrowdown"),
          formatKeyLabel(getKeysForAction("left")[0] ?? "arrowleft"),
          formatKeyLabel(getKeysForAction("right")[0] ?? "arrowright"),
        ].join("");
      }
      return "↑↓←→";
    }
    case "scroll":
      return "↑↓/PgUp·PgDn";
    case "up":
    case "down":
    case "left":
    case "right":
    case "dash":
    case "skill":
    case "skillCycle":
    case "guard":
    case "autoBattle":
      return getKeysForAction(action).slice(0, 2).map(formatKeyLabel).join("/");
  }
}

/** 액션 + 입력 장치에 맞는 표시용 버튼/키 글리프 문자열을 돌려준다. */
export function glyphForAction(action: GlyphAction, device: InputDeviceKind = activeInputDevice): string {
  if (device === "keyboard") return keyboardGlyphForAction(action);
  return CONTROLLER_GLYPHS[device][action];
}

/** 조작 안내 항목 배열을 현재(또는 지정) 입력 장치 글리프로 포맷한다. */
export function formatControlHints(
  hints: readonly ControlHintSpec[],
  device: InputDeviceKind = activeInputDevice,
  separator = "   ",
): string {
  return hints
    .map((hint) => `${glyphForAction(hint.action, device)} ${hint.label}`)
    .join(separator);
}

let activeInputDevice: InputDeviceKind = "keyboard";
const listeners = new Set<(device: InputDeviceKind) => void>();

export function getActiveInputDevice(): InputDeviceKind {
  return activeInputDevice;
}

export function setActiveInputDevice(device: InputDeviceKind): void {
  if (activeInputDevice === device) return;
  activeInputDevice = device;
  for (const listener of [...listeners]) {
    try {
      listener(device);
    } catch {
      // ignore subscriber failure
    }
  }
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("oprn:input-device", { detail: { device } }));
    }
  } catch {
    // ignore in restricted environments
  }
}

export function subscribeInputDevice(listener: (device: InputDeviceKind) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let trackerRefs = 0;
let teardownTracker: (() => void) | null = null;

/**
 * window 의 키보드/포인터/게임패드 이벤트와 navigator.getGamepads() 를 관찰해
 * 활성 입력 장치를 자동 전환한다. 참조 카운트로 중복 장착을 안전하게 관리한다.
 */
export function installInputDeviceTracker(): () => void {
  if (typeof window === "undefined") return () => {};
  trackerRefs += 1;
  if (!teardownTracker) {
    let rafId = 0;
    let active = true;

    const initialPad = detectConnectedGamepadDevice();
    if (initialPad && activeInputDevice === "keyboard") {
      // 이미 연결된 패드가 있어도 실제 패드 입력이 들어올 때 전환하되, 연결 이벤트에는 바로 반영한다.
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.isTrusted) {
        setActiveInputDevice("keyboard");
        return;
      }
      // desktopShellBridge 등이 합성한 게임패드 keydown 은 isTrusted === false 이다.
      const padDevice = detectConnectedGamepadDevice();
      if (padDevice) setActiveInputDevice(padDevice);
    };

    const onPointerDown = (): void => {
      setActiveInputDevice("keyboard");
    };

    const onGamepadConnected = (event: Event): void => {
      const pad = (event as GamepadEvent).gamepad;
      setActiveInputDevice(detectGamepadVendor(pad?.id));
      ensurePadPoll();
    };

    const onGamepadDisconnected = (): void => {
      const remaining = detectConnectedGamepadDevice();
      if (remaining) setActiveInputDevice(remaining);
      else setActiveInputDevice("keyboard");
    };

    const pollGamepadActivity = (): void => {
      rafId = 0;
      if (!active) return;
      const pad = readConnectedGamepad();
      if (!pad) return;
      const pressed = pad.buttons.some((button) => Boolean(button && (button.pressed || button.value > 0.5)));
      const moved = pad.axes.some((axis) => Number.isFinite(axis) && Math.abs(axis) > 0.5);
      if (pressed || moved) setActiveInputDevice(detectGamepadVendor(pad.id));
      if (typeof window.requestAnimationFrame === "function") {
        rafId = window.requestAnimationFrame(pollGamepadActivity);
      }
    };

    const ensurePadPoll = (): void => {
      if (rafId || !active || typeof window.requestAnimationFrame !== "function") return;
      if (readConnectedGamepad()) {
        rafId = window.requestAnimationFrame(pollGamepadActivity);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("gamepadconnected", onGamepadConnected);
    window.addEventListener("gamepaddisconnected", onGamepadDisconnected);
    ensurePadPoll();

    teardownTracker = () => {
      active = false;
      if (rafId && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("gamepadconnected", onGamepadConnected);
      window.removeEventListener("gamepaddisconnected", onGamepadDisconnected);
    };
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    trackerRefs = Math.max(0, trackerRefs - 1);
    if (trackerRefs === 0 && teardownTracker) {
      teardownTracker();
      teardownTracker = null;
    }
  };
}

type ControlsCopy = {
  readonly move: string;
  readonly menuMove: string;
  readonly itemMove: string;
  readonly select: string;
  readonly confirm: string;
  readonly adjust: string;
  readonly back: string;
  readonly close: string;
  readonly toGame: string;
  readonly menu: string;
};

const CONTROLS_COPY: Readonly<Record<SupportedLocale, ControlsCopy>> = {
  ko: {
    move: "이동",
    menuMove: "메뉴 이동",
    itemMove: "항목 이동",
    select: "선택",
    confirm: "결정",
    adjust: "조절",
    back: "뒤로",
    close: "닫기",
    toGame: "게임으로",
    menu: "메뉴",
  },
  en: {
    move: "move",
    menuMove: "menu",
    itemMove: "move",
    select: "select",
    confirm: "confirm",
    adjust: "adjust",
    back: "back",
    close: "close",
    toGame: "to game",
    menu: "menu",
  },
  ja: {
    move: "移動",
    menuMove: "メニュー移動",
    itemMove: "項目移動",
    select: "選択",
    confirm: "決定",
    adjust: "調整",
    back: "戻る",
    close: "閉じる",
    toGame: "ゲームへ",
    menu: "メニュー",
  },
  zh: {
    move: "移动",
    menuMove: "菜单移动",
    itemMove: "移动项目",
    select: "选择",
    confirm: "确定",
    adjust: "调整",
    back: "返回",
    close: "关闭",
    toGame: "回到游戏",
    menu: "菜单",
  },
};

/**
 * 메뉴 하단 조작 안내를 활성 장치(컨트롤러 글리프 또는 커스텀 키보드 바인딩)에 맞춰 생성한다.
 * 기본 키보드(커스텀 confirm/cancel 없음)에서는 null 을 돌려 기존 현지화 문자열을 그대로 유지한다.
 */
export function formatStatusMenuControlsForDevice(
  mode: "main" | "function",
  options: {
    readonly railColumns?: number;
    readonly compact?: boolean;
    readonly adjustable?: boolean;
    readonly locale?: SupportedLocale;
    readonly device?: InputDeviceKind;
  } = {},
): string | null {
  const device = options.device ?? activeInputDevice;
  const custom = getCustomKeyBindings();
  const hasCustomMenuKeys = Boolean(custom.confirm?.length || custom.cancel?.length);
  if (device === "keyboard" && !hasCustomMenuKeys) return null;

  const copy = CONTROLS_COPY[options.locale ?? "ko"];
  const confirmGlyph = glyphForAction("confirm", device);
  const cancelGlyph = glyphForAction("cancel", device);
  const navGlyph = device === "keyboard" ? "↑↓" : "D-Pad";
  const gridNavGlyph = device === "keyboard" ? "↑↓←→" : "D-Pad";
  const adjustGlyph = device === "keyboard" ? "←→" : "◀▶";

  if (options.compact && mode === "main") {
    return `${navGlyph} ${copy.move} · ${confirmGlyph} ${copy.select}\n${cancelGlyph} ${copy.close}`;
  }
  if (mode === "function" && options.adjustable) {
    return `${navGlyph} ${copy.itemMove}   ${adjustGlyph} ${copy.adjust}   ${cancelGlyph} ${copy.back}`;
  }
  if (mode === "function") {
    return device === "keyboard"
      ? `${navGlyph} ${copy.itemMove}   ${confirmGlyph} ${copy.confirm}   ← ${copy.menu}   ${cancelGlyph} ${copy.back}`
      : `${navGlyph} ${copy.itemMove}   ${confirmGlyph} ${copy.confirm}   ${cancelGlyph} ${copy.back}`;
  }
  if ((options.railColumns ?? 1) > 1) {
    return `${gridNavGlyph} ${copy.move}   ${confirmGlyph} ${copy.select}   ${cancelGlyph} ${copy.toGame}`;
  }
  return `${navGlyph} ${copy.menuMove}   ${confirmGlyph} ${copy.select}   ${cancelGlyph} ${copy.toGame}`;
}
