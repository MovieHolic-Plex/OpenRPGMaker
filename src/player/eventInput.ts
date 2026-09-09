import { isTextEntryTarget } from "@/player/keyBindings";

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
      if (event.repeat || event.isComposing || isTextEntryTarget(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      cleanup();
      resolve(keyInputCodeFor(event));
    };
    signal.addEventListener("abort", abort, { once: true });
    document.addEventListener("keydown", onKey, true);
  });
}

/** RM2K3 key input codes; other fresh keys intentionally map to zero. */
function keyInputCodeFor(event: KeyboardEvent): number {
  switch (event.key) {
    case "ArrowDown": case "s": case "S": return 1;
    case "ArrowLeft": case "a": case "A": return 2;
    case "ArrowRight": case "d": case "D": return 3;
    case "ArrowUp": case "w": case "W": return 4;
    case "Enter": case " ": case "z": case "Z": return 5;
    case "Escape": case "x": case "X": return 6;
    case "Shift": return 7;
    default: return /^[0-9]$/.test(event.key) ? 10 + Number(event.key) : 0;
  }
}
