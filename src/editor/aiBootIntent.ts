// editor/aiBootIntent.ts
// Welcome → AI chat handoff: prefill and optional auto-send (writes still go through proposal cards).

export type AiBootIntentTarget = {
  readonly open: () => void;
  readonly prefill: (text: string) => void;
  readonly getDraft?: () => string;
  /** Optional: send a user turn. Must not bypass proposal approval for write tools. */
  readonly send?: (text: string) => void | Promise<void>;
};

/**
 * 웰컴 → 채팅 핸드오프 요청. 예전에는 `replaceWithBlank`·`presetId` 를 같이 실어 보냈지만
 * 소비자가 없었다(2026-08-30 실측: peek/consume 호출처 0건). 남은 계약은 프롬프트와
 * 자동 전송 여부뿐이다 — 장르 프리셋의 결정적 적용은 welcomeGenrePresetApply 가 담당한다.
 */
export type PendingWelcomePipeline = {
  readonly prompt: string;
  readonly autoSend: boolean;
  readonly source: "chip" | "free-text";
};

let pendingIntent: string | null = null;
let pendingAutoSend = false;
let target: AiBootIntentTarget | null = null;
let welcomeIntentAppliedThisBoot = false;
let suppressCoachForMount = false;

export function setPendingAiBootIntent(text: string, options?: { readonly autoSend?: boolean }): void {
  const trimmed = text.trim();
  if (!trimmed) {
    pendingIntent = null;
    pendingAutoSend = false;
    return;
  }
  pendingIntent = trimmed;
  pendingAutoSend = options?.autoSend === true;
  suppressCoachForMount = true;
}

export function setPendingWelcomePipeline(pipeline: PendingWelcomePipeline): void {
  setPendingAiBootIntent(pipeline.prompt, { autoSend: pipeline.autoSend });
}

export function peekPendingAiBootIntent(): string | null {
  return pendingIntent;
}

export function consumePendingAiBootIntent(): string | null {
  const value = pendingIntent;
  pendingIntent = null;
  pendingAutoSend = false;
  return value;
}

/** Peek whether the next apply should auto-send (does not clear). */
export function peekPendingAiBootAutoSend(): boolean {
  return pendingAutoSend;
}

export function clearPendingAiBootIntent(): void {
  pendingIntent = null;
  pendingAutoSend = false;
}

/**
 * Panel mounts register a prefill/send target. Do not auto-apply here so finishEditorBoot
 * can run quiet-guest identity first, then applyPending last for focus (D7).
 */
export function registerAiBootIntentTarget(next: AiBootIntentTarget | null): void {
  target = next;
}

export function wasWelcomeIntentAppliedThisBoot(): boolean {
  return welcomeIntentAppliedThisBoot;
}

export function markWelcomeIntentAppliedThisBoot(): void {
  welcomeIntentAppliedThisBoot = true;
  suppressCoachForMount = true;
}

export function clearWelcomeIntentBootFlags(): void {
  welcomeIntentAppliedThisBoot = false;
  suppressCoachForMount = false;
}

/** Coach marks should not start on a mount that applies welcome intent. */
export function shouldSuppressCoachMarksForWelcomeIntent(): boolean {
  return suppressCoachForMount || pendingIntent !== null || welcomeIntentAppliedThisBoot;
}

function applyIntentToTarget(text: string, t: AiBootIntentTarget, autoSend: boolean): boolean {
  try {
    t.open();
    if (autoSend && t.send) {
      void t.send(text);
    } else {
      t.prefill(text);
    }
    markWelcomeIntentAppliedThisBoot();
    return true;
  } catch {
    return false;
  }
}

/** Consume pending intent and prefill or auto-send. Never commits proposals itself. */
export function applyPendingAiBootIntent(): boolean {
  const text = pendingIntent;
  const autoSend = pendingAutoSend;
  pendingIntent = null;
  pendingAutoSend = false;
  if (!text) return false;
  if (!target) {
    pendingIntent = text;
    pendingAutoSend = autoSend;
    return false;
  }
  return applyIntentToTarget(text, target, autoSend);
}

/** Prefill an already-mounted panel. Never sends. */
export function prefillAiAssistantInput(text: string, options?: { readonly preserveDraft?: boolean }): boolean {
  const trimmed = text.trim();
  if (!trimmed || !target) return false;
  if (options?.preserveDraft && !target.getDraft) return false;
  const existing = options?.preserveDraft ? target.getDraft?.() ?? "" : "";
  return applyIntentToTarget(existing ? `${existing}\n\n${trimmed}` : trimmed, target, false);
}

/** Auto-send on an already-mounted panel when send handler exists. */
export function sendAiBootIntent(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || !target?.send) return false;
  return applyIntentToTarget(trimmed, target, true);
}
