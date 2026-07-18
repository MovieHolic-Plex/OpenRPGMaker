import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { store } from "@/project/store";

export type RuntimeJuiceEvent =
  | "menu-back"
  | "menu-close"
  | "menu-confirm"
  | "menu-invalid"
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
  /** Optional SE override (e.g. titleScreen.sounds.cursor/confirm). */
  readonly soundResourceId?: string;
};

const RUNTIME_JUICE_SPECS = {
  // RM2k3-ish UI SFX: cursor/decision/cancel only — avoid long chimes on every open.
  "menu-back": { event: "menu-back", soundResourceId: "easyrpg-sound-cancel1", motionClass: "juice-menu-back", durationMs: 160 },
  "menu-close": { event: "menu-close", soundResourceId: "easyrpg-sound-cancel2", motionClass: "juice-menu-close", durationMs: 160 },
  "menu-confirm": { event: "menu-confirm", soundResourceId: "easyrpg-sound-decision1", motionClass: "juice-menu-confirm", durationMs: 180 },
  "menu-invalid": { event: "menu-invalid", soundResourceId: "easyrpg-sound-buzzer1", motionClass: "juice-menu-invalid", durationMs: 140 },
  "menu-open": { event: "menu-open", soundResourceId: "easyrpg-sound-decision1", motionClass: "juice-menu-open", durationMs: 160 },
  "menu-select": { event: "menu-select", soundResourceId: "easyrpg-sound-cursor1", motionClass: "juice-menu-select", durationMs: 120 },
  "title-confirm": { event: "title-confirm", soundResourceId: "easyrpg-sound-decision1", motionClass: "juice-title-confirm", durationMs: 180 },
  "title-enter": { event: "title-enter", soundResourceId: "easyrpg-sound-decision2", motionClass: "juice-title-enter", durationMs: 180 },
  "title-select": { event: "title-select", soundResourceId: "easyrpg-sound-cursor1", motionClass: "juice-title-select", durationMs: 120 },
} as const satisfies Record<RuntimeJuiceEvent, RuntimeJuiceSpec>;

const RUNTIME_JUICE_CLASSES = Object.values(RUNTIME_JUICE_SPECS).map((spec) => spec.motionClass);

const DEFAULT_VOLUME = 0.35;

export function emitRuntimeJuice(options: RuntimeJuiceOptions): RuntimeJuiceLogEntry {
  const spec = RUNTIME_JUICE_SPECS[options.event];
  const override = options.soundResourceId?.trim();
  const soundResourceId = override || spec.soundResourceId;
  const entry: RuntimeJuiceLogEntry = {
    event: spec.event,
    soundResourceId,
    motionClass: spec.motionClass,
    durationMs: spec.durationMs,
  };
  writeRuntimeJuiceLog(entry);
  playRuntimeJuiceSound(soundResourceId);
  if (options.target) applyRuntimeJuiceMotion(options.target, { ...spec, soundResourceId });
  return entry;
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
