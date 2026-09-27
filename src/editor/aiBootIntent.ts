// editor/aiBootIntent.ts
// Welcome → AI chat handoff: prefill and optional auto-send (writes still go through proposal cards).

/**
 * `displayText`: 사용자 말풍선·입력창에 보일 문장. 모델이 읽을 지시문(`text`)과 따로 간다 —
 * 첫 화면 프롬프트는 「사용자 의도: …」·체크리스트·「한국어로 진행하고…」 같은 내부 지시를 달고
 * 있어서, 그대로 보이면 처음 온 사용자가 자기 한 문장 대신 시스템 지시문을 자기 말로 읽는다
 * (2026-09-23 실측). 없으면 `text` 가 곧 보이는 문장이다.
 */
export type AiBootIntentTarget = {
  readonly open: () => void;
  readonly prefill: (text: string, displayText?: string, options?: AiBootIntentRunOptions) => void;
  readonly getDraft?: () => string;
  /** Optional: send a user turn. Must not bypass proposal approval for write tools. */
  readonly send?: (text: string, displayText?: string, options?: AiBootIntentRunOptions) => void | Promise<void>;
};

/**
 * 핸드오프가 실어 보내는 실행 옵션.
 *
 * `team`: 이 한 턴만 팀(팀장·시공·검수)으로 돌린다. 프리셋으로 시작하는 첫 생성이 맵 여러 장·이벤트·DB 를
 * 한꺼번에 만드는 일이라 팀이 맡는다(2026-09-27 합의). 사용자의 팀 설정(`AiConfig.piTeam`)은 바꾸지 않는다 —
 * 그다음의 「집 한 채」 같은 작은 요청까지 팀으로 돌면 느려지기 때문이다.
 */
export type AiBootIntentRunOptions = {
  readonly team?: boolean;
};

/**
 * 웰컴 → 채팅 핸드오프 요청. 예전에는 `replaceWithBlank`·`presetId` 를 같이 실어 보냈지만
 * 소비자가 없었다(2026-08-30 실측: peek/consume 호출처 0건). 남은 계약은 프롬프트와
 * 자동 전송 여부뿐이다 — 장르 프리셋의 결정적 적용은 welcomeGenrePresetApply 가 담당한다.
 */
export type PendingWelcomePipeline = {
  readonly prompt: string;
  /** 말풍선에 보일 사용자 쪽 요약. 모델에는 `prompt` 전체가 간다. */
  readonly displayText?: string;
  readonly autoSend: boolean;
  readonly source: "chip" | "free-text";
  /** 이 첫 턴만 팀으로 돌린다. 프리셋 경로만 켠다. */
  readonly team?: boolean;
};

let pendingIntent: string | null = null;
let pendingDisplay: string | null = null;
let pendingAutoSend = false;
let pendingTeam = false;
let target: AiBootIntentTarget | null = null;
let welcomeIntentAppliedThisBoot = false;
let suppressCoachForMount = false;

export function setPendingAiBootIntent(text: string, options?: { readonly autoSend?: boolean; readonly displayText?: string; readonly team?: boolean }): void {
  const trimmed = text.trim();
  if (!trimmed) {
    pendingIntent = null;
    pendingDisplay = null;
    pendingAutoSend = false;
    pendingTeam = false;
    return;
  }
  pendingIntent = trimmed;
  pendingDisplay = displayOrNull(trimmed, options?.displayText);
  pendingAutoSend = options?.autoSend === true;
  pendingTeam = options?.team === true;
  suppressCoachForMount = true;
}

export function setPendingWelcomePipeline(pipeline: PendingWelcomePipeline): void {
  setPendingAiBootIntent(pipeline.prompt, {
    autoSend: pipeline.autoSend,
    ...(pipeline.displayText !== undefined ? { displayText: pipeline.displayText } : {}),
    ...(pipeline.team ? { team: true } : {}),
  });
}

/** 보이는 문장이 비었거나 보낼 문장과 같으면 따로 들고 다니지 않는다. */
function displayOrNull(text: string, display: string | undefined): string | null {
  const shown = display?.trim();
  return shown && shown !== text ? shown : null;
}

/** 대기 중인 핸드오프의 보이는 문장(없으면 null — 보낼 문장이 곧 보이는 문장). */
export function peekPendingAiBootDisplayText(): string | null {
  return pendingDisplay;
}

export function peekPendingAiBootIntent(): string | null {
  return pendingIntent;
}

export function consumePendingAiBootIntent(): string | null {
  const value = pendingIntent;
  pendingIntent = null;
  pendingDisplay = null;
  pendingAutoSend = false;
  pendingTeam = false;
  return value;
}

/** Peek whether the next apply should auto-send (does not clear). */
export function peekPendingAiBootAutoSend(): boolean {
  return pendingAutoSend;
}

export function clearPendingAiBootIntent(): void {
  pendingIntent = null;
  pendingDisplay = null;
  pendingAutoSend = false;
  pendingTeam = false;
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

function applyIntentToTarget(text: string, t: AiBootIntentTarget, autoSend: boolean, displayText: string | null = null, team = false): boolean {
  try {
    t.open();
    // 보이는 문장·팀 옵션이 있을 때만 인자를 더 싣는다 — 없으면 예전 호출 모양 그대로다.
    if (team) {
      const options: AiBootIntentRunOptions = { team: true };
      if (autoSend && t.send) void t.send(text, displayText ?? undefined, options);
      else t.prefill(text, displayText ?? undefined, options);
    } else if (autoSend && t.send) {
      void (displayText ? t.send(text, displayText) : t.send(text));
    } else if (displayText) {
      t.prefill(text, displayText);
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
  const display = pendingDisplay;
  const autoSend = pendingAutoSend;
  const team = pendingTeam;
  pendingIntent = null;
  pendingDisplay = null;
  pendingAutoSend = false;
  pendingTeam = false;
  if (!text) return false;
  if (!target) {
    pendingIntent = text;
    pendingDisplay = display;
    pendingAutoSend = autoSend;
    pendingTeam = team;
    return false;
  }
  return applyIntentToTarget(text, target, autoSend, display, team);
}

/** Prefill an already-mounted panel. Never sends. */
export function prefillAiAssistantInput(text: string, options?: { readonly preserveDraft?: boolean; readonly displayText?: string }): boolean {
  const trimmed = text.trim();
  if (!trimmed || !target) return false;
  if (options?.preserveDraft && !target.getDraft) return false;
  const existing = options?.preserveDraft ? target.getDraft?.() ?? "" : "";
  const display = displayOrNull(trimmed, options?.displayText);
  // 쓰던 초안은 보이는 쪽과 보낼 쪽 모두의 앞에 그대로 둔다 — 초안 바이트를 잃지 않는다.
  const join = (tail: string): string => (existing ? `${existing}\n\n${tail}` : tail);
  return applyIntentToTarget(join(trimmed), target, false, display ? join(display) : null);
}

/** Auto-send on an already-mounted panel when send handler exists. */
export function sendAiBootIntent(text: string, displayText?: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || !target?.send) return false;
  return applyIntentToTarget(trimmed, target, true, displayOrNull(trimmed, displayText));
}
