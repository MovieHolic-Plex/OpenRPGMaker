// ai/preferenceSignals.ts
// 성향 신호 수집 — LLM 없이 결정론으로 집계한다. 증류(preferenceDistiller)는 이 집계를 읽어서
// 문장으로 바꿀 뿐이고, 증류가 실패해도 여기 쌓인 숫자는 남는다.
//
// 신호를 어디서 얻는가:
// - 되돌리기(-3): 채팅 변경 카드의 되돌리기. 채팅 제안은 자동 적용되므로(aiProposalCard 의
//   "사람이 확정할 버튼이 없어졌고") 수락 버튼이 없다 — 가장 강한 부정 신호는 Ctrl+Z 다.
// - 정정 발화(-2): AI 가 변경을 남긴 직후 CORRECTION_WINDOW_MS 안에 부정 어휘가 담긴 지시가 오면,
//   그 직전 작업이 원하는 결과가 아니었다는 뜻이다.
// - 무사 통과(+1): 변경을 남긴 턴이 되돌려지지도 정정되지도 않고 다음 턴으로 넘어갔을 때.
// - 명시 선언: "항상 ~로 해줘" 처럼 사람이 직접 말한 취향. 집계를 기다리지 않고 즉시 증류한다.
//
// 턴 이력 자체는 새로 쌓지 않는다 — activityLog 가 이미 지시문·툴 호출·결과를 로컬 링버퍼에 갖고 있다.
// 여기 저장하는 것은 집계 카운터와 증류 입력용 원문 큐뿐이다.
//
// localStorage 가 없으면(Node/테스트) 로드는 빈 상태, 저장은 조용히 no-op.

export type PreferenceSignalKind = "undo" | "correction" | "settled" | "stated";

export interface PreferenceCounter {
  /** 긍정 가중 합. */
  pos: number;
  /** 부정 가중 합. */
  neg: number;
  /** 마지막 갱신 시각 — 카운터 상한 축출 순위. */
  at: number;
}

export interface PendingPreferenceSignal {
  readonly at: number;
  readonly kind: PreferenceSignalKind;
  /** 대상이 된 지시문(앞 PENDING_TEXT_MAX_CHARS 자). */
  readonly instruction: string;
  /** 정정문 또는 선언문 원문(앞 PENDING_TEXT_MAX_CHARS 자). */
  readonly note?: string;
  readonly toolNames: readonly string[];
  /** 음수 = 부정. stated 는 0(방향 판단을 증류에 맡긴다). */
  readonly weight: number;
}

interface LastTurnState {
  readonly at: number;
  readonly instruction: string;
  readonly toolNames: readonly string[];
  /** 이 턴이 프로젝트를 실제로 바꿨는가. 안 바꾼 턴은 되돌릴 것도 없어 신호가 되지 않는다. */
  readonly changed: boolean;
  readonly undone: boolean;
}

export interface PreferenceSignalState {
  counters: Record<string, PreferenceCounter>;
  pending: PendingPreferenceSignal[];
  lastTurn: LastTurnState | null;
  /** 연속 증류 실패 횟수. 상한에 닿으면 pending 앞부분을 버려 무한 성장을 막는다. */
  distillFailures: number;
}

export const PREFERENCE_SIGNALS_STORAGE_KEY = "oprn:ai-preference-signals";

/** AI 변경 직후 이 시간 안에 온 부정 발화만 정정으로 본다. */
export const CORRECTION_WINDOW_MS = 60_000;

export const UNDO_WEIGHT = -3;
export const CORRECTION_WEIGHT = -2;
export const SETTLED_WEIGHT = 1;

export const PENDING_SIGNAL_LIMIT = 20;
export const COUNTER_LIMIT = 60;
export const PENDING_TEXT_MAX_CHARS = 120;

/** 이 건수가 쌓이면 증류를 돌린다. */
export const DISTILL_PENDING_THRESHOLD = 6;
/** 연속 실패 상한. 넘으면 pending 을 절반으로 잘라 큐가 영원히 막히지 않게 한다. */
export const DISTILL_FAILURE_LIMIT = 3;

/**
 * 정정 어휘. 테스트가 이 표면을 검증한다 — 목록을 조용히 줄이면 부정 신호가 통째로 사라져
 * "학습이 안 된다"로 되돌아가고, 원인이 프롬프트가 아니라 이 상수라는 걸 알아채기 어렵다.
 */
export const CORRECTION_CUES: readonly string[] = [
  "아니",
  "말고",
  "다시",
  "너무",
  "취소",
  "싫",
  "그게 아니",
  "잘못",
  "빼줘",
  "지워",
  "되돌",
];

/** 명시 선언 어휘. 이게 걸리면 집계를 기다리지 않고 바로 증류한다. */
export const STATED_PREFERENCE_CUES: readonly string[] = [
  "항상",
  "앞으로",
  "매번",
  "기본으로",
  "기억해",
  "나는",
  "내 취향",
  "선호",
  "하지 마",
  "웬만하면",
  "웬만해선",
];

/**
 * 지시문에서 뽑는 주제 슬러그. 툴 이름만으로는 "집을 지었다"까지만 알고 "작게 원했다"를 모른다.
 * 목록은 작게 유지한다 — 넓히면 오분류가 늘고, 증류가 원문(pending)을 같이 보므로 여기서 정밀할 필요가 없다.
 */
export const TOPIC_CUES: readonly { readonly key: string; readonly words: readonly string[] }[] = [
  { key: "scale:small", words: ["작게", "작은", "소규모", "좁게", "줄여"] },
  { key: "scale:large", words: ["크게", "큰", "대규모", "넓게", "늘려"] },
  { key: "tone:dark", words: ["어둡", "음침", "호러", "공포", "칙칙", "폐허"] },
  { key: "tone:bright", words: ["밝", "화사", "따뜻", "활기", "명랑"] },
  { key: "flow:autonomous", words: ["알아서", "바로", "그냥", "진행", "끝까지"] },
  { key: "flow:ask", words: ["물어봐", "확인해", "되묻", "먼저 물어"] },
  { key: "detail:dense", words: ["빽빽", "가득", "촘촘", "디테일", "풍성"] },
  { key: "detail:sparse", words: ["단순", "심플", "깔끔", "비워", "여백"] },
];

// ── 순수 계산 ─────────────────────────────────────────────────────

export function emptyPreferenceSignalState(): PreferenceSignalState {
  return { counters: {}, pending: [], lastTurn: null, distillFailures: 0 };
}

export function containsCorrectionCue(text: string): boolean {
  return CORRECTION_CUES.some((cue) => text.includes(cue));
}

export function containsStatedPreferenceCue(text: string): boolean {
  return STATED_PREFERENCE_CUES.some((cue) => text.includes(cue));
}

/** 이 턴이 건드린 축들. `tool:<name>` + 지시문에서 걸린 주제 슬러그. */
export function counterKeysForTurn(instruction: string, toolNames: readonly string[]): string[] {
  const keys = new Set<string>();
  for (const name of toolNames) {
    const trimmed = name.trim();
    if (trimmed) keys.add(`tool:${trimmed}`);
  }
  for (const { key, words } of TOPIC_CUES) {
    if (words.some((word) => instruction.includes(word))) keys.add(key);
  }
  return [...keys];
}

function clip(text: string): string {
  return text.trim().slice(0, PENDING_TEXT_MAX_CHARS);
}

function bumpCounters(
  counters: Record<string, PreferenceCounter>,
  keys: readonly string[],
  weight: number,
  at: number,
): Record<string, PreferenceCounter> {
  const next: Record<string, PreferenceCounter> = { ...counters };
  for (const key of keys) {
    const existing = next[key] ?? { pos: 0, neg: 0, at };
    next[key] = {
      pos: existing.pos + (weight > 0 ? weight : 0),
      neg: existing.neg + (weight < 0 ? -weight : 0),
      at,
    };
  }
  // 상한: 오래 갱신되지 않은 카운터부터 버린다.
  const entries = Object.entries(next);
  if (entries.length <= COUNTER_LIMIT) return next;
  entries.sort((a, b) => b[1].at - a[1].at);
  return Object.fromEntries(entries.slice(0, COUNTER_LIMIT));
}

function pushPending(
  pending: readonly PendingPreferenceSignal[],
  signal: PendingPreferenceSignal,
): PendingPreferenceSignal[] {
  return [...pending, signal].slice(-PENDING_SIGNAL_LIMIT);
}

export interface ObserveTurnInput {
  readonly instruction: string;
  readonly toolNames: readonly string[];
  /** 이 턴이 프로젝트를 실제로 바꿨는가. */
  readonly changed: boolean;
  readonly at?: number;
}

/**
 * 턴 1건 관측. 직전 턴에 대한 정정/무사통과 판정을 먼저 하고, 그다음 이번 턴을 lastTurn 으로 세운다.
 *
 * 무사통과(+1)를 다음 턴 시작에 판정하는 것은 근사다 — 사용자가 한참 뒤에 되돌리면 +1 이 이미 들어간 뒤다.
 * 대신 되돌리기가 -3 이라 한 번의 되돌림이 세 번의 무사통과를 덮는다.
 */
export function observeTurnIn(state: PreferenceSignalState, input: ObserveTurnInput): PreferenceSignalState {
  const at = input.at ?? Date.now();
  const instruction = clip(input.instruction);
  let counters = state.counters;
  let pending = state.pending;

  const prior = state.lastTurn;
  if (prior && prior.changed && !prior.undone) {
    const withinWindow = at - prior.at <= CORRECTION_WINDOW_MS;
    if (withinWindow && containsCorrectionCue(instruction)) {
      const keys = counterKeysForTurn(prior.instruction, prior.toolNames);
      counters = bumpCounters(counters, keys, CORRECTION_WEIGHT, at);
      pending = pushPending(pending, {
        at,
        kind: "correction",
        instruction: prior.instruction,
        note: instruction,
        toolNames: prior.toolNames,
        weight: CORRECTION_WEIGHT,
      });
    } else {
      const keys = counterKeysForTurn(prior.instruction, prior.toolNames);
      counters = bumpCounters(counters, keys, SETTLED_WEIGHT, at);
    }
  }

  if (containsStatedPreferenceCue(instruction)) {
    pending = pushPending(pending, {
      at,
      kind: "stated",
      instruction,
      note: instruction,
      toolNames: input.toolNames,
      weight: 0,
    });
  }

  return {
    ...state,
    counters,
    pending,
    lastTurn: { at, instruction, toolNames: input.toolNames, changed: input.changed, undone: false },
  };
}

export interface UndoSignalInput {
  /** 되돌린 변경을 만든 지시문. 생략하면 직전 턴의 지시문을 쓴다. */
  readonly instruction?: string;
  readonly toolNames?: readonly string[];
  readonly at?: number;
}

/**
 * AI 변경 되돌림 관측. 변경 카드가 AI 변경 1건에 1:1로 붙어 있어 호출부가 대상을 정확히 안다 —
 * mapEditHistory 의 라벨 문자열을 매칭하는 방식보다 정확하고, 사람이 직접 그린 타일의 undo 와 섞이지 않는다.
 */
export function noteUndoIn(state: PreferenceSignalState, input: UndoSignalInput = {}): PreferenceSignalState {
  const at = input.at ?? Date.now();
  const instruction = clip(input.instruction ?? state.lastTurn?.instruction ?? "");
  const toolNames = input.toolNames ?? state.lastTurn?.toolNames ?? [];
  if (!instruction && toolNames.length === 0) return state;
  const keys = counterKeysForTurn(instruction, toolNames);
  return {
    ...state,
    counters: bumpCounters(state.counters, keys, UNDO_WEIGHT, at),
    pending: pushPending(state.pending, {
      at,
      kind: "undo",
      instruction,
      toolNames,
      weight: UNDO_WEIGHT,
    }),
    // 되돌린 턴에는 무사통과 +1 을 주지 않는다.
    lastTurn: state.lastTurn ? { ...state.lastTurn, undone: true } : null,
  };
}

/** 증류를 돌릴 때인가. 명시 선언은 건수를 기다리지 않는다. */
export function shouldDistillPreferences(state: PreferenceSignalState): boolean {
  if (state.pending.some((signal) => signal.kind === "stated")) return true;
  return state.pending.length >= DISTILL_PENDING_THRESHOLD;
}

// ── localStorage 게이트 ───────────────────────────────────────────

function isCounter(value: unknown): value is PreferenceCounter {
  if (typeof value !== "object" || value === null) return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.pos === "number" && Number.isFinite(rec.pos)
    && typeof rec.neg === "number" && Number.isFinite(rec.neg)
    && typeof rec.at === "number" && Number.isFinite(rec.at)
  );
}

function isPendingSignal(value: unknown): value is PendingPreferenceSignal {
  if (typeof value !== "object" || value === null) return false;
  const rec = value as Record<string, unknown>;
  if (rec.kind !== "undo" && rec.kind !== "correction" && rec.kind !== "settled" && rec.kind !== "stated") return false;
  if (typeof rec.instruction !== "string") return false;
  if (typeof rec.at !== "number" || !Number.isFinite(rec.at)) return false;
  if (typeof rec.weight !== "number" || !Number.isFinite(rec.weight)) return false;
  if (!Array.isArray(rec.toolNames) || !rec.toolNames.every((name) => typeof name === "string")) return false;
  if (rec.note !== undefined && typeof rec.note !== "string") return false;
  return true;
}

function isLastTurn(value: unknown): value is LastTurnState {
  if (typeof value !== "object" || value === null) return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.at === "number" && Number.isFinite(rec.at)
    && typeof rec.instruction === "string"
    && Array.isArray(rec.toolNames) && rec.toolNames.every((name) => typeof name === "string")
    && typeof rec.changed === "boolean"
    && typeof rec.undone === "boolean"
  );
}

export function loadPreferenceSignals(): PreferenceSignalState {
  if (typeof localStorage === "undefined") return emptyPreferenceSignalState();
  try {
    const raw = localStorage.getItem(PREFERENCE_SIGNALS_STORAGE_KEY);
    if (!raw) return emptyPreferenceSignalState();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return emptyPreferenceSignalState();
    const rec = parsed as Record<string, unknown>;
    const counters: Record<string, PreferenceCounter> = {};
    if (typeof rec.counters === "object" && rec.counters !== null) {
      for (const [key, value] of Object.entries(rec.counters as Record<string, unknown>)) {
        if (isCounter(value)) counters[key] = value;
      }
    }
    const pending = Array.isArray(rec.pending)
      ? rec.pending.filter(isPendingSignal).slice(-PENDING_SIGNAL_LIMIT)
      : [];
    return {
      counters,
      pending,
      lastTurn: isLastTurn(rec.lastTurn) ? rec.lastTurn : null,
      distillFailures:
        typeof rec.distillFailures === "number" && Number.isFinite(rec.distillFailures) && rec.distillFailures >= 0
          ? rec.distillFailures
          : 0,
    };
  } catch {
    return emptyPreferenceSignalState();
  }
}

export function savePreferenceSignals(state: PreferenceSignalState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      PREFERENCE_SIGNALS_STORAGE_KEY,
      JSON.stringify({
        counters: state.counters,
        pending: state.pending.slice(-PENDING_SIGNAL_LIMIT),
        lastTurn: state.lastTurn,
        distillFailures: state.distillFailures,
      }),
    );
  } catch {
    /* 쿼터 초과 등 저장 실패는 치명적이지 않다 — 집계만 늦어진다. */
  }
}

export function clearPreferenceSignals(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(PREFERENCE_SIGNALS_STORAGE_KEY);
  } catch {
    /* 무시 */
  }
}

/** 턴 관측 후 최신 상태를 돌려준다(호출부가 shouldDistillPreferences 로 이어 판정한다). */
export function observeTurn(input: ObserveTurnInput): PreferenceSignalState {
  const next = observeTurnIn(loadPreferenceSignals(), input);
  savePreferenceSignals(next);
  return next;
}

/** AI 변경 되돌림 관측. */
export function noteAiChangeUndone(input: UndoSignalInput = {}): PreferenceSignalState {
  const next = noteUndoIn(loadPreferenceSignals(), input);
  savePreferenceSignals(next);
  return next;
}

/** 증류 성공 — 소비한 신호를 비우고 실패 카운터를 초기화한다. */
export function consumePendingSignals(): void {
  const state = loadPreferenceSignals();
  savePreferenceSignals({ ...state, pending: [], distillFailures: 0 });
}

/**
 * 증류 실패 — 실패 횟수를 올리고, 상한에 닿으면 pending 앞 절반을 버린다.
 * 안 버리면 파싱이 계속 깨지는 모델에서 큐가 20건에 붙어 새 신호가 들어올 자리가 없어진다.
 */
export function notePreferenceDistillFailure(): void {
  const state = loadPreferenceSignals();
  const failures = state.distillFailures + 1;
  if (failures < DISTILL_FAILURE_LIMIT) {
    savePreferenceSignals({ ...state, distillFailures: failures });
    return;
  }
  savePreferenceSignals({
    ...state,
    pending: state.pending.slice(Math.ceil(state.pending.length / 2)),
    distillFailures: 0,
  });
}
