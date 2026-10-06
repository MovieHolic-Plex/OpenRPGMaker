import { getPlayerPreferences } from '@/player/playerPreferences';
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { store } from "@/project/store";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";
import type { SystemSeCue } from "@/project/systemAudioOverrides";
import { playAudioCommand } from "@/player/audio";
import { animateStatusMenuFeedback } from "@/player/playerStatusMenuMotion";
import { preparedRuntimeAudioUrl } from './runtimeAudioWarmup';

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
  readonly project?: Project;
  readonly session?: PlaySession;
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
const MENU_SE_CUE: Partial<Record<RuntimeJuiceEvent, SystemSeCue>> = {
  "menu-back": "cancel", "menu-close": "cancel", "menu-confirm": "confirm",
  "menu-invalid": "buzzer", "menu-open": "confirm", "menu-select": "cursor",
};

export function emitRuntimeJuice(options: RuntimeJuiceOptions): RuntimeJuiceLogEntry {
  const spec = RUNTIME_JUICE_SPECS[options.event];
  const cue = MENU_SE_CUE[options.event];
  const authored = cue === 'cursor' || cue === 'confirm' || cue === 'cancel' ? options.project?.meta.oprnMenuSounds?.[cue] : undefined;
  const override = options.soundResourceId?.trim() || authored;
  const selected = cue ? options.session?.systemAudioOverrides?.se?.[cue] : undefined;
  const soundResourceId = selected?.resourceId ?? (override || spec.soundResourceId);
  const entry: RuntimeJuiceLogEntry = {
    event: spec.event,
    soundResourceId,
    motionClass: spec.motionClass,
    durationMs: spec.durationMs,
  };
  writeRuntimeJuiceLog(entry);
  if (selected) {
    if (soundResourceId) playAudioCommand({ ...selected, loop: false, channel: "se" }, options.project ?? store.getCurrent());
  } else playRuntimeJuiceSound(soundResourceId);
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
  if (target.classList.contains("oprn-status-menu")) {
    animateStatusMenuFeedback(target, spec.event);
    return;
  }
  target.classList.remove(...RUNTIME_JUICE_CLASSES);
  // window 가 없으면(node 환경) 모션은 건너뛰고 클래스만 즉시 얹는다 — 단위 테스트가
  // 모션 클래스 부착을 검사할 수 있게 하면서 rAF 부재로 죽지 않게 한다.
  if (typeof window === "undefined") {
    target.classList.add(spec.motionClass);
    return;
  }
  window.requestAnimationFrame(() => {
    target.classList.add(spec.motionClass);
    window.setTimeout(() => target.classList.remove(spec.motionClass), spec.durationMs);
  });
}

function playRuntimeJuiceSound(soundResourceId: string): void {
  // 헤드리스 가드. vitest 는 environment:"node" 가 전역 기본값이고 test/fakeDom.ts 는
  // document 만 깔고 Audio 는 안 깐다. 가드가 없으면 emitRuntimeJuice 를 부르는 코드가
  // node 환경 테스트에서 전부 ReferenceError 로 죽는다 — 그래서 지금까지 UI 피드백을
  // 붙일 수 있는 자리가 사실상 브라우저 전용으로 묶여 있었다.
  if (typeof Audio === "undefined") return;
  const url = resolveAssetResourceUrl(soundResourceId, { project: store.getCurrent() });
  if (!url) return;
  const audio = new Audio(preparedRuntimeAudioUrl(url));
  audio.volume = DEFAULT_VOLUME * getPlayerPreferences().se;
  void audio.play().catch((error: unknown) => {
    if (error instanceof DOMException) return;
    console.warn("[runtime-juice] sound playback failed", error);
  });
}

/** window 가 없는 환경에서도 로그가 쌓이도록 하는 대체 저장소(단위 테스트 관찰용). */
const headlessJuiceState: { log: RuntimeJuiceLogEntry[] } = { log: [] };

function runtimeJuiceState(): { log: RuntimeJuiceLogEntry[] } {
  if (typeof window === "undefined") return headlessJuiceState;
  window.__oprnRuntimeJuice ??= { log: [] };
  window.__oprnJuiceLog ??= runtimeJuiceLog;
  return window.__oprnRuntimeJuice;
}
