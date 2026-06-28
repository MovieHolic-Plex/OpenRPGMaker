import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { store } from "@/project/store";

export type RuntimeJuiceEvent =
  | "menu-back"
  | "menu-close"
  | "menu-confirm"
  | "menu-open"
  | "menu-select"
  | "title-confirm"
  | "title-enter"
  | "title-select";

export type RuntimeJuiceLogEntry = {
  readonly event: RuntimeJuiceEvent;
  readonly soundResourceId: string;
  readonly motionClass: string;
  readonly durationMs: number;
};

type RuntimeJuiceSpec = RuntimeJuiceLogEntry & {
  readonly durationMs: number;
};

export type RuntimeJuiceOptions = {
  readonly event: RuntimeJuiceEvent;
  readonly target?: HTMLElement | null;
};

const RUNTIME_JUICE_SPECS = {
  "menu-back": { event: "menu-back", soundResourceId: "easyrpg-sound-cancel1", motionClass: "juice-menu-back", durationMs: 220 },
  "menu-close": { event: "menu-close", soundResourceId: "easyrpg-sound-close1", motionClass: "juice-menu-close", durationMs: 240 },
  "menu-confirm": { event: "menu-confirm", soundResourceId: "easyrpg-sound-decision1", motionClass: "juice-menu-confirm", durationMs: 240 },
  "menu-open": { event: "menu-open", soundResourceId: "easyrpg-sound-chime2", motionClass: "juice-menu-open", durationMs: 240 },
  "menu-select": { event: "menu-select", soundResourceId: "easyrpg-sound-cursor1", motionClass: "juice-menu-select", durationMs: 220 },
  "title-confirm": { event: "title-confirm", soundResourceId: "easyrpg-sound-decision2", motionClass: "juice-title-confirm", durationMs: 260 },
  "title-enter": { event: "title-enter", soundResourceId: "easyrpg-sound-chime1", motionClass: "juice-title-enter", durationMs: 260 },
  "title-select": { event: "title-select", soundResourceId: "easyrpg-sound-cursor2", motionClass: "juice-title-select", durationMs: 220 },
} as const satisfies Record<RuntimeJuiceEvent, RuntimeJuiceSpec>;

const RUNTIME_JUICE_CLASSES = Object.values(RUNTIME_JUICE_SPECS).map((spec) => spec.motionClass);

const DEFAULT_VOLUME = 0.35;

export function emitRuntimeJuice(options: RuntimeJuiceOptions): RuntimeJuiceLogEntry {
  const spec = RUNTIME_JUICE_SPECS[options.event];
  writeRuntimeJuiceLog(spec);
  playRuntimeJuiceSound(spec.soundResourceId);
  if (options.target) applyRuntimeJuiceMotion(options.target, spec);
  return spec;
}

export function runtimeJuiceLog(): readonly RuntimeJuiceLogEntry[] {
  return [...runtimeJuiceState().log];
}

function writeRuntimeJuiceLog(entry: RuntimeJuiceLogEntry): void {
  runtimeJuiceState().log.push(entry);
}

function applyRuntimeJuiceMotion(target: HTMLElement, spec: RuntimeJuiceSpec): void {
  target.classList.remove(...RUNTIME_JUICE_CLASSES);
  window.requestAnimationFrame(() => {
    target.classList.add(spec.motionClass);
    window.setTimeout(() => target.classList.remove(spec.motionClass), spec.durationMs);
  });
}

function playRuntimeJuiceSound(soundResourceId: string): void {
  const url = resolveAssetResourceUrl(soundResourceId, { project: store.getCurrent() });
  if (!url) return;
  const audio = new Audio(url);
  audio.volume = DEFAULT_VOLUME;
  void audio.play().catch((error: unknown) => {
    if (error instanceof DOMException) return;
    console.warn("[runtime-juice] sound playback failed", error);
  });
}

function runtimeJuiceState(): { log: RuntimeJuiceLogEntry[] } {
  window.__rpgzzuRuntimeJuice ??= { log: [] };
  window.__rpgzzuJuiceLog ??= runtimeJuiceLog;
  return window.__rpgzzuRuntimeJuice;
}
