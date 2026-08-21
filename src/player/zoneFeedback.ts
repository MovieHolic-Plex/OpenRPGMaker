import type { M2UiCommandState } from "@/project/sessionRuntimeTypes"
import type { EventPage } from "@/project/types";

const BANNER_DURATION_MS = 1500;

type TimedMessage = {
  readonly message: string;
  readonly expiresAtMs: number;
};

export type ZoneFeedbackEffect = { readonly kind: "checkpointChime" };

export type ZoneFeedbackView = {
  readonly banner: string | null;
  readonly toast: string | null;
  readonly objective: string | null;
  readonly prompt: string | null;
  readonly suppressed: boolean;
};

export type ZoneFeedbackModel = {
  readonly source: readonly M2UiCommandState[];
  readonly cursor: number;
  readonly seen: ReadonlySet<string>;
  readonly seenCount: number;
  readonly banner: TimedMessage | null;
  readonly toast: TimedMessage | null;
  readonly objective: string | null;
};

export type ZoneFeedbackInput = {
  readonly entries: readonly M2UiCommandState[];
  readonly nowMs: number;
  readonly prompt: string | null;
  readonly suppressed: boolean;
  /**
   * 씬 로컬 임시 토스트. m2Runtime.ui 를 거치지 않는 반복 가능한 안내(농사 실패 사유 등)가
   * 여기로 들어온다. entries 기반 토스트가 살아 있으면 그 뒤로 밀린다 — 농사 안내는 A 를 다시
   * 눌러 언제든 되살릴 수 있지만 체크포인트 안내는 한 번뿐이라 가려지면 영구히 사라진다.
   */
  readonly transientToast?: string | null;
};

export type ZoneFeedbackUpdate = {
  readonly model: ZoneFeedbackModel;
  readonly view: ZoneFeedbackView;
  readonly effects: readonly ZoneFeedbackEffect[];
};

export function createZoneFeedbackModel(
  entries: readonly M2UiCommandState[],
  mode: "skipExisting" | "consumeExisting" = "skipExisting",
): ZoneFeedbackModel {
  return {
    source: entries,
    cursor: mode === "consumeExisting" ? 0 : entries.length,
    seen: new Set<string>(),
    seenCount: 0,
    banner: null,
    toast: null,
    objective: null,
  };
}

export function updateZoneFeedback(model: ZoneFeedbackModel, input: ZoneFeedbackInput): ZoneFeedbackUpdate {
  if (model.source !== input.entries || input.entries.length < model.cursor) {
    return resultFrom(createZoneFeedbackModel(input.entries), input, []);
  }

  const seen = new Set(model.seen);
  const effects: ZoneFeedbackEffect[] = [];
  let banner = activeMessage(model.banner, input.nowMs);
  let toast = activeMessage(model.toast, input.nowMs);
  let objective = model.objective;

  for (let index = model.cursor; index < input.entries.length; index += 1) {
    const entry = input.entries[index];
    if (!entry) continue;
    const message = entry.message.trim();
    if (!message) continue;
    const surface = entry.surface.trim();
    const key = `${surface}\u0000${message}`;
    if (seen.has(key)) continue;
    seen.add(key);

    switch (surface) {
      case "banner":
        banner = { message, expiresAtMs: input.nowMs + BANNER_DURATION_MS };
        break;
      case "objectiveChip":
        objective = completedObjective(message) ? null : message;
        break;
      case "checkpoint":
        toast = timedToast(message, entry.durationMs, input.nowMs);
        effects.push({ kind: "checkpointChime" });
        break;
      case "toast":
        toast = timedToast(message, entry.durationMs, input.nowMs);
        if (isCheckpointMessage(message)) effects.push({ kind: "checkpointChime" });
        break;
      default:
        break;
    }
  }

  const next: ZoneFeedbackModel = {
    source: input.entries,
    cursor: input.entries.length,
    seen,
    seenCount: seen.size,
    banner,
    toast,
    objective,
  };
  return resultFrom(next, input, effects);
}

export function interactionPromptLabel(page: EventPage | undefined): string | null {
  if (!page || page.trigger.kind !== "action") return null;
  if (page.commands.some((command) => command.kind === "checkpointSave")) return "Z 휴식";
  if (page.commands.some((command) => command.kind === "battleProcessing")) return "Z 전투";
  if (page.commands.some((command) => command.kind === "transfer")) return "Z 오르기";
  return "Z 조사";
}

function timedToast(message: string, durationMs: number, nowMs: number): TimedMessage {
  return { message, expiresAtMs: nowMs + Math.max(0, durationMs) };
}

function activeMessage(message: TimedMessage | null, nowMs: number): TimedMessage | null {
  return message && message.expiresAtMs > nowMs ? message : null;
}

function completedObjective(message: string): boolean {
  const match = message.match(/(\d+)\s*\/\s*(\d+)/u);
  if (!match) return false;
  const current = Number(match[1]);
  const total = Number(match[2]);
  return total > 0 && current >= total;
}

function isCheckpointMessage(message: string): boolean {
  return /checkpoint|체크포인트|휴식 지점/iu.test(message);
}

function resultFrom(
  model: ZoneFeedbackModel,
  input: Pick<ZoneFeedbackInput, "prompt" | "suppressed" | "transientToast">,
  effects: readonly ZoneFeedbackEffect[],
): ZoneFeedbackUpdate {
  return {
    model,
    effects,
    view: {
      banner: model.banner?.message ?? null,
      // 살아 있는 entries 토스트(체크포인트 등)가 임시 토스트보다 우선한다.
      toast: model.toast?.message ?? input.transientToast ?? null,
      objective: model.objective,
      prompt: input.prompt,
      suppressed: input.suppressed,
    },
  };
}
