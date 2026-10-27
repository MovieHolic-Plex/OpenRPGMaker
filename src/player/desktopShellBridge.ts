/**
 * 내보낸 게임 플레이어의 데스크톱 · Steam 셸 브릿지.
 *
 * 1. 로컬 파일 세이브 동기화 (`saves/slot-01.oprn-save.json` 등):
 *    데스크톱 런처(`window.__oprnDesktopPlayer` 또는 Electron/WebView2 호스트 브릿지)가 주입된 경우,
 *    localStorage 세이브 슬롯(1~3, autosave, clear-record)을 `saves/*.oprn-save.json` 파일과
 *    양방향으로 동기화해 **Steam Auto-Cloud** 가 C++ SDK 없이도 세이브 파일을 자동 백업·복원한다.
 *    일반 브라우저에서도 세이브 슬롯 변경 시 메모리 미러(`window.__oprnDesktopShellState.syncedSaveFiles`)를 유지한다.
 *
 * 2. 데스크톱 단축키:
 *    - `F11` 또는 `Alt + Enter`: 전체화면 즉시 전환
 *    - `F12`: 스크린샷 캡처 신호 전달
 *
 * 3. 내장 HTML5 Gamepad API 폴링 루프 (Steam Deck / Xbox / DualSense 컨트롤러):
 *    별도 설정 없이 패드 연결 시 D-Pad / 좌측 스틱 → 방향키, A(0) → Enter/Z, B(1) → Escape/X,
 *    X(2)/LB(4) → Shift, Y(3)/Start(9) → Escape 키 이벤트를 합성해 타이틀·필드·전투·대사창 전체가
 *    패드로 조작된다. 좌측 스틱은 반지름 데드존(진입 0.45, 유지 0.30) 뒤에 터치 스틱과 같은
 *    상하좌우 우선 구역으로 읽는다 — 축마다 0.45 를 보면 45° 로 절반쯤 민 스틱(축 ≈ 0.42)이
 *    아무 방향도 내지 않는다. 방향키를 누르고 있으면 키보드 반복과 같이 `repeat` keydown 을 보낸다
 *    (메뉴 커서가 한 칸에서 멈추지 않게). 확인·취소는 가장자리에서 한 번만 보낸다.
 */
import type { DesktopDisplayMode, DesktopExportPlatform } from "@/project/desktopGameExport";
import { HeldDirectionRepeat } from "@/player/heldDirectionRepeat";
import { stickSector, stickSectorKeys } from "@/player/touchPad";

export interface DesktopShellBootConfig {
  readonly enabled?: boolean;
  readonly platform?: DesktopExportPlatform;
  readonly steamAppId?: number;
  readonly displayMode?: DesktopDisplayMode;
  readonly saveDirectory?: string;
  readonly savePattern?: string;
  readonly pakArchive?: string;
  readonly steamAutoCloud?: boolean;
  readonly gamepadPolling?: boolean;
}

export interface DesktopPlayerHostApi {
  readonly writeSaveFile?: (relativePath: string, content: string) => Promise<void> | void;
  readonly readSaveFile?: (relativePath: string) => Promise<string | null> | string | null;
  readonly listSaveFiles?: () => Promise<readonly string[]> | readonly string[];
  readonly toggleFullscreen?: () => Promise<boolean> | boolean;
  readonly captureScreenshot?: () => Promise<string | null> | string | null;
}

export interface DesktopSaveMirrorEntry {
  readonly filePath: string;
  readonly storageKey: string;
  readonly updatedAt: string;
  readonly bytes: number;
  readonly json: string;
}

export interface DesktopShellRuntimeState {
  active: boolean;
  platform: DesktopExportPlatform;
  steamAppId: number;
  displayMode: DesktopDisplayMode;
  fullscreen: boolean;
  gamepadConnected: boolean;
  gamepadId: string | null;
  saveDirectory: string;
  syncedSaveFiles: Record<string, DesktopSaveMirrorEntry>;
}

declare global {
  interface Window {
    __oprnDesktopPlayer?: DesktopPlayerHostApi;
    __oprnDesktopShellState?: DesktopShellRuntimeState;
  }
}

const BUTTON_KEY_MAP: ReadonlyArray<{
  readonly index: number;
  readonly key: string;
  readonly code: string;
}> = [
  { index: 0, key: "Enter", code: "Enter" },          // South (A / Cross) -> Confirm
  { index: 1, key: "Escape", code: "Escape" },        // East (B / Circle) -> Cancel / Menu
  { index: 2, key: "Shift", code: "ShiftLeft" },      // West (X / Square) -> Dash
  { index: 3, key: "Escape", code: "Escape" },        // North (Y / Triangle) -> Menu
  { index: 4, key: "Shift", code: "ShiftLeft" },      // L1 / LB -> Dash
  { index: 5, key: "q", code: "KeyQ" },               // R1 / RB -> Skill
  { index: 8, key: "Tab", code: "Tab" },              // Select / Back -> Focus group
  { index: 9, key: "Escape", code: "Escape" },        // Start / Options -> Menu
  { index: 12, key: "ArrowUp", code: "ArrowUp" },     // D-Pad Up
  { index: 13, key: "ArrowDown", code: "ArrowDown" }, // D-Pad Down
  { index: 14, key: "ArrowLeft", code: "ArrowLeft" }, // D-Pad Left
  { index: 15, key: "ArrowRight", code: "ArrowRight" }, // D-Pad Right
];

/** 중립에서 방향으로 들어가려면 이 반지름을 넘어야 한다. 옛 축별 문턱과 같은 값이라 정면 민감도는 그대로다. */
const GAMEPAD_STICK_DEADZONE = 0.45;
/** 이미 방향을 내고 있으면 이 반지름 아래로 돌아와야 놓는다. 문턱에 걸친 스틱이 매 프레임 눌림/뗌을 반복하지 않게. */
const GAMEPAD_STICK_DEADZONE_HOLD = 0.3;
/**
 * `stickSector` 는 픽셀 거리(진입 12px)로 중립을 자른다. 축 값(-1..1)을 이 배율로 키우면
 * 그 12px 관문은 반지름 0.12 라, 위의 0.45 관문보다 먼저 방향을 지우지 않는다.
 */
const GAMEPAD_STICK_SECTOR_SCALE = 100;

/**
 * 좌측 스틱 → 터치 스틱과 같은 8구역 번호, 또는 데드존 안이면 null.
 * 축마다 0.45 를 재면 45° 입력은 양쪽 축이 모두 문턱을 넘을 때까지(반지름 ≈ 0.64) 무시된다.
 * 반지름으로 자른 뒤 구역을 고르면 그 입력이 대각선이 되고, 정면에서 조금 비낀 입력은 한 방향만 남는다.
 */
export function gamepadStickSector(axisX: number, axisY: number, previous: number | null): number | null {
  const distance = Math.hypot(axisX, axisY);
  if (!Number.isFinite(distance)) return null;
  if (distance <= (previous === null ? GAMEPAD_STICK_DEADZONE : GAMEPAD_STICK_DEADZONE_HOLD)) return null;
  return stickSector(axisX * GAMEPAD_STICK_SECTOR_SCALE, axisY * GAMEPAD_STICK_SECTOR_SCALE, previous);
}

let activeCleanup: (() => void) | null = null;

/**
 * 로컬 저장소 키(`*:save-slot:v5:1` 등)를 Steam Auto-Cloud 대응 상대 파일 경로(`saves/slot-01.oprn-save.json`)로 변환한다.
 */
export function saveStorageKeyToDesktopFilePath(key: string): string | null {
  const slotMatch = /:save-slot:(?:v[456]:)?([123]|auto)$/u.exec(key);
  if (slotMatch) {
    const token = slotMatch[1];
    if (token === "auto") return "saves/autosave.oprn-save.json";
    return `saves/slot-0${token}.oprn-save.json`;
  }
  if (key.endsWith(":clear-record:v1")) {
    return "saves/clear-record.oprn-save.json";
  }
  if (key.endsWith(":gallery-record:v1")) {
    return "saves/gallery-record.oprn-save.json";
  }
  return null;
}

/**
 * 세이브 슬롯 기록 시 데스크톱 `saves/*.oprn-save.json` 미러 및 네이티브 브릿지에 즉시 기록한다.
 */
export function mirrorDesktopSaveFile(storageKey: string, jsonContent: string): DesktopSaveMirrorEntry | null {
  const filePath = saveStorageKeyToDesktopFilePath(storageKey);
  if (!filePath) return null;
  const entry: DesktopSaveMirrorEntry = {
    filePath,
    storageKey,
    updatedAt: new Date().toISOString(),
    bytes: new TextEncoder().encode(jsonContent).length,
    json: jsonContent,
  };
  if (typeof window !== "undefined") {
    const state = ensureDesktopShellState();
    state.syncedSaveFiles[filePath] = entry;
    try {
      void window.__oprnDesktopPlayer?.writeSaveFile?.(filePath, jsonContent);
    } catch {
      // 호스트 파일 쓰기 실패가 인게임 진행을 막지 않는다.
    }
  }
  return entry;
}

function ensureDesktopShellState(config?: DesktopShellBootConfig): DesktopShellRuntimeState {
  if (typeof window !== "undefined" && window.__oprnDesktopShellState) {
    if (config) {
      if (config.platform) window.__oprnDesktopShellState.platform = config.platform;
      if (config.steamAppId) window.__oprnDesktopShellState.steamAppId = config.steamAppId;
      if (config.displayMode) window.__oprnDesktopShellState.displayMode = config.displayMode;
      if (config.saveDirectory) window.__oprnDesktopShellState.saveDirectory = config.saveDirectory;
    }
    return window.__oprnDesktopShellState;
  }
  const initial: DesktopShellRuntimeState = {
    active: Boolean(config?.enabled ?? true),
    platform: config?.platform ?? "win64-steam",
    steamAppId: config?.steamAppId ?? 480,
    displayMode: config?.displayMode ?? "fullscreen",
    fullscreen: typeof document !== "undefined" ? Boolean(document.fullscreenElement) : false,
    gamepadConnected: false,
    gamepadId: null,
    saveDirectory: config?.saveDirectory ?? "saves",
    syncedSaveFiles: {},
  };
  if (typeof window !== "undefined") {
    window.__oprnDesktopShellState = initial;
  }
  return initial;
}

/**
 * 내보낸 플레이어 부팅 시 데스크톱 단축키(`F11`, `Alt+Enter`), 세이브 파일 동기화 브릿지,
 * 그리고 HTML5 Gamepad 폴링 루프를 장착한다.
 */
export function installDesktopShellBridge(
  root: HTMLElement,
  config?: DesktopShellBootConfig,
): () => void {
  activeCleanup?.();
  const state = ensureDesktopShellState(config);
  state.active = true;

  // 1. Hydrate existing localStorage saves into the desktop save mirror (and vice versa)
  syncExistingSavesWithDesktopBridge(state);

  // Intercept Storage.prototype.setItem so any saveToSlot / writeAutosave / recordEndingClear
  // automatically mirrors to `saves/*.oprn-save.json`.
  const restoreStorageHook = installStorageSaveMirrorHook();

  // 2. Keyboard shortcuts: F11 and Alt+Enter for Fullscreen
  const onKeyDown = (event: KeyboardEvent): void => {
    const isF11 = event.key === "F11";
    const isAltEnter = event.altKey && event.key === "Enter";
    if (isF11 || isAltEnter) {
      event.preventDefault();
      void toggleDesktopPlayerFullscreen(root);
      return;
    }
    if (event.key === "F12") {
      try {
        void window.__oprnDesktopPlayer?.captureScreenshot?.();
      } catch {
        // ignore
      }
    }
  };
  window.addEventListener("keydown", onKeyDown);

  const onFullscreenChange = (): void => {
    state.fullscreen = Boolean(document.fullscreenElement);
  };
  document.addEventListener("fullscreenchange", onFullscreenChange);

  // 3. Gamepad polling loop (Steam Deck / XInput / DualSense)
  const stopGamepad = config?.gamepadPolling !== false
    ? startGamepadPolling(state)
    : () => {};

  const cleanup = () => {
    window.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("fullscreenchange", onFullscreenChange);
    restoreStorageHook();
    stopGamepad();
    if (activeCleanup === cleanup) activeCleanup = null;
  };
  activeCleanup = cleanup;
  return cleanup;
}

export async function toggleDesktopPlayerFullscreen(root: HTMLElement): Promise<boolean> {
  const hostToggle = typeof window !== "undefined" ? window.__oprnDesktopPlayer?.toggleFullscreen : undefined;
  if (typeof hostToggle === "function") {
    try {
      const toggled = await hostToggle();
      if (typeof window !== "undefined" && window.__oprnDesktopShellState) {
        window.__oprnDesktopShellState.fullscreen = Boolean(toggled);
      }
      return Boolean(toggled);
    } catch {
      // Fall back to standard Fullscreen API
    }
  }
  if (typeof document === "undefined") return false;
  try {
    if (document.fullscreenElement) {
      if (typeof document.exitFullscreen === "function") {
        await document.exitFullscreen();
      }
      return false;
    }
    const target = root.ownerDocument?.documentElement ?? root;
    if (typeof target.requestFullscreen === "function") {
      await target.requestFullscreen();
      return true;
    }
  } catch {
    // Gesture or permission restriction in headless browser
  }
  return Boolean(document.fullscreenElement);
}

function syncExistingSavesWithDesktopBridge(state: DesktopShellRuntimeState): void {
  if (typeof window === "undefined") return;
  try {
    const storage = window.localStorage;
    if (!storage) return;
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key) continue;
      const filePath = saveStorageKeyToDesktopFilePath(key);
      if (!filePath) continue;
      const value = storage.getItem(key);
      if (value) {
        state.syncedSaveFiles[filePath] = {
          filePath,
          storageKey: key,
          updatedAt: new Date().toISOString(),
          bytes: new TextEncoder().encode(value).length,
          json: value,
        };
      }
    }
  } catch {
    // Ignore storage access errors in restricted frames
  }
}

function installStorageSaveMirrorHook(): () => void {
  if (typeof Storage === "undefined" || !Storage.prototype?.setItem) {
    return () => {};
  }
  const originalSetItem = Storage.prototype.setItem;
  const hookedSetItem = function (this: Storage, key: string, value: string): void {
    originalSetItem.call(this, key, value);
    if (saveStorageKeyToDesktopFilePath(key)) {
      mirrorDesktopSaveFile(key, value);
    }
  };
  try {
    Storage.prototype.setItem = hookedSetItem;
  } catch {
    return () => {};
  }
  return () => {
    try {
      if (Storage.prototype.setItem === hookedSetItem) {
        Storage.prototype.setItem = originalSetItem;
      }
    } catch {
      // ignore
    }
  };
}

function startGamepadPolling(state: DesktopShellRuntimeState): () => void {
  if (typeof window === "undefined" || typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") {
    return () => {};
  }
  const pressedKeys = new Set<string>();
  const directionRepeat = new HeldDirectionRepeat();
  let stickSectorIndex: number | null = null;
  let rafId = 0;
  let active = true;

  const dispatchSyntheticKey = (type: "keydown" | "keyup", key: string, code: string, repeat = false): void => {
    // One event, on the focused element, so it bubbles through document to window once.
    // A second copy dispatched on window made one pad press confirm twice: the first
    // event already reaches window listeners (battle, tactics). That second event also
    // has target=window, so a text-field guard that looks at event.target let it through
    // while the player was typing. Battle then treated one A press as command + target.
    const target = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
    target.dispatchEvent(new KeyboardEvent(type, {
      key,
      code,
      bubbles: true,
      cancelable: true,
      repeat,
    }));
  };

  const readConnectedGamepad = (): Gamepad | undefined => {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    return Array.from(pads ?? []).find((item): item is Gamepad => Boolean(item && item.connected));
  };

  // Dropping the pad does not deliver keyup. Release every key we synthesized,
  // or the last direction/dash stays down and the character keeps walking.
  const releasePressedKeys = (): void => {
    if (pressedKeys.size === 0) return;
    const tokens = [...pressedKeys];
    pressedKeys.clear();
    for (const token of tokens) {
      const [key, code] = token.split("|");
      if (key && code) dispatchSyntheticKey("keyup", key, code);
    }
  };

  const markDisconnected = (): void => {
    state.gamepadConnected = false;
    state.gamepadId = null;
    releasePressedKeys();
    directionRepeat.clear();
    stickSectorIndex = null;
  };

  const poll = (): void => {
    if (!active) return;
    try {
      const pad = readConnectedGamepad();
      if (pad) {
        state.gamepadConnected = true;
        state.gamepadId = pad.id || "Xbox / Steam Input Controller";
        const nextPressed = new Set<string>();
        for (const mapping of BUTTON_KEY_MAP) {
          const btn = pad.buttons[mapping.index];
          if (btn && btn.pressed) {
            nextPressed.add(`${mapping.key}|${mapping.code}`);
          }
        }
        const axisX = pad.axes[0] ?? 0;
        const axisY = pad.axes[1] ?? 0;
        stickSectorIndex = gamepadStickSector(axisX, axisY, stickSectorIndex);
        for (const key of stickSectorKeys(stickSectorIndex)) {
          nextPressed.add(`${key}|${key}`);
        }

        for (const token of nextPressed) {
          if (!pressedKeys.has(token)) {
            const [key, code] = token.split("|");
            if (key && code) dispatchSyntheticKey("keydown", key, code);
          }
        }
        for (const token of pressedKeys) {
          if (!nextPressed.has(token)) {
            const [key, code] = token.split("|");
            if (key && code) dispatchSyntheticKey("keyup", key, code);
          }
        }
        pressedKeys.clear();
        for (const token of nextPressed) pressedKeys.add(token);
        // Held directions repeat like a keyboard key so a stick in a menu keeps
        // moving the cursor. The first tick only arms the timer. Confirm and
        // cancel are not in this list, so a held A stays one press.
        const heldDirections: string[] = [];
        for (const token of nextPressed) {
          const key = token.split("|")[0] ?? "";
          if (key.startsWith("Arrow")) heldDirections.push(key);
        }
        const now = typeof performance !== "undefined" ? performance.now() : 0;
        for (const key of directionRepeat.tick(heldDirections, now)) {
          dispatchSyntheticKey("keydown", key, key, true);
        }
      } else if (state.gamepadConnected || pressedKeys.size > 0) {
        // `gamepaddisconnected` clears the flag before this poll. Releasing
        // only while the flag is still true left the held key stuck.
        markDisconnected();
      }
    } catch {
      // Ignore gamepad SecurityError in sandboxed contexts
    }
    if (active && typeof window.requestAnimationFrame === "function") {
      rafId = window.requestAnimationFrame(poll);
    }
  };

  const onGamepadConnected = (event: GamepadEvent): void => {
    state.gamepadConnected = true;
    state.gamepadId = event.gamepad?.id || "Steam Input Gamepad";
  };
  const onGamepadDisconnected = (): void => {
    // Another pad may still be held. Let the next poll reconcile that one.
    try {
      if (readConnectedGamepad()) return;
    } catch {
      // Same sandbox miss as the poll: treat the pad as gone.
    }
    markDisconnected();
  };
  window.addEventListener("gamepadconnected", onGamepadConnected as EventListener);
  window.addEventListener("gamepaddisconnected", onGamepadDisconnected as EventListener);

  if (typeof window.requestAnimationFrame === "function") {
    rafId = window.requestAnimationFrame(poll);
  }

  return () => {
    active = false;
    if (rafId && typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(rafId);
    }
    releasePressedKeys();
    directionRepeat.clear();
    window.removeEventListener("gamepadconnected", onGamepadConnected as EventListener);
    window.removeEventListener("gamepaddisconnected", onGamepadDisconnected as EventListener);
  };
}
