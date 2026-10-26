import { isTextEntryTarget, keyboardEventKey } from "@/player/keyBindings";

export interface EventKeySource {
  readonly key: string;
  readonly code?: string;
  readonly keyCode?: number;
  readonly repeat?: boolean;
  readonly isComposing?: boolean;
  readonly target?: unknown;
}

/**
 * RM2K3 key-input code for one keydown, or null when the event is not a finished key.
 * An IME "Process" key with no physical code used to resolve as 0 and end the wait.
 */
export function eventKeyCodeFromKeyboardEvent(event: EventKeySource): number | null {
  if (event.repeat || isTextEntryTarget(event.target)) return null;
  const key = keyboardEventKey(event);
  if (key === "Process" || key === "Unidentified") return null;
  if (event.isComposing && key === event.key) return null;
  return keyInputCodeFor(key);
}

/** A fresh key belongs to this blocking command, never to the next surface. */
export function waitForEventKey(signal: AbortSignal): Promise<number> {
  if (signal.aborted) return Promise.reject(new DOMException("Input cancelled", "AbortError"));
  return new Promise<number>((resolve, reject) => {
    const cleanup = (): void => {
      document.removeEventListener("keydown", onKey, true);
      signal.removeEventListener("abort", abort);
    };
    const abort = (): void => {
      cleanup();
      reject(new DOMException("Input cancelled", "AbortError"));
    };
    const onKey = (event: KeyboardEvent): void => {
      const code = eventKeyCodeFromKeyboardEvent(event);
      if (code === null) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      cleanup();
      resolve(code);
    };
    signal.addEventListener("abort", abort, { once: true });
    document.addEventListener("keydown", onKey, true);
  });
}

/** RM2K3 key input codes; other fresh keys intentionally map to zero. */
function keyInputCodeFor(key: string): number {
  switch (key) {
    case "ArrowDown": case "s": case "S": return 1;
    case "ArrowLeft": case "a": case "A": return 2;
    case "ArrowRight": case "d": case "D": return 3;
    case "ArrowUp": case "w": case "W": return 4;
    case "Enter": case " ": case "z": case "Z": return 5;
    case "Escape": case "x": case "X": return 6;
    case "Shift": return 7;
    default: return /^[0-9]$/.test(key) ? 10 + Number(key) : 0;
  }
}
