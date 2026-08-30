// test/preferenceSignals.test.ts
// 결정론 집계 계약. 되돌리기 −3 / 정정 −2 / 무사통과 +1 과 60초 창 경계, 그리고 어휘 상수 표면.
// 어휘 목록이 조용히 줄면 부정 신호가 통째로 사라져 "학습이 안 된다"로 되돌아가고, 원인이
// 프롬프트가 아니라 이 상수라는 걸 알아채기 어렵다 — 그래서 표면 자체를 단정한다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearPreferenceSignals,
  containsCorrectionCue,
  containsStatedPreferenceCue,
  consumePendingSignals,
  CORRECTION_CUES,
  CORRECTION_WEIGHT,
  CORRECTION_WINDOW_MS,
  counterKeysForTurn,
  DISTILL_FAILURE_LIMIT,
  DISTILL_PENDING_THRESHOLD,
  emptyPreferenceSignalState,
  loadPreferenceSignals,
  noteAiChangeUndone,
  notePreferenceDistillFailure,
  noteUndoIn,
  observeTurn,
  observeTurnIn,
  PENDING_SIGNAL_LIMIT,
  PENDING_TEXT_MAX_CHARS,
  PREFERENCE_SIGNALS_STORAGE_KEY,
  savePreferenceSignals,
  SETTLED_WEIGHT,
  shouldDistillPreferences,
  STATED_PREFERENCE_CUES,
  UNDO_WEIGHT,
  type PreferenceSignalState,
} from "@/ai/preferenceSignals";

const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: createMemoryStorage(),
  });
});

afterEach(() => {
  if (originalLocalStorageDescriptor) {
    Object.defineProperty(globalThis, "localStorage", originalLocalStorageDescriptor);
    return;
  }
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("가중 상수", () => {
  it("되돌리기가 무사통과 3회를 덮는다", () => {
    expect(UNDO_WEIGHT).toBe(-3);
    expect(CORRECTION_WEIGHT).toBe(-2);
    expect(SETTLED_WEIGHT).toBe(1);
    expect(Math.abs(UNDO_WEIGHT)).toBe(SETTLED_WEIGHT * 3);
  });
});

describe("어휘 상수 표면", () => {
  it("정정 어휘가 실제 사용자 발화를 잡는다", () => {
    expect(CORRECTION_CUES.length).toBeGreaterThanOrEqual(8);
    for (const text of ["아니 그게 아니야", "집 말고 나무로", "다시 해줘", "너무 크다", "취소해", "그거 지워"]) {
      expect(containsCorrectionCue(text)).toBe(true);
    }
    expect(containsCorrectionCue("마을을 하나 만들어 줘")).toBe(false);
  });

  it("명시 선언 어휘가 취향 선언을 잡는다", () => {
    expect(STATED_PREFERENCE_CUES.length).toBeGreaterThanOrEqual(8);
    for (const text of ["항상 작게 만들어 줘", "앞으로는 물어보지 마", "나는 어두운 분위기가 좋아", "이거 기억해"]) {
      expect(containsStatedPreferenceCue(text)).toBe(true);
    }
    expect(containsStatedPreferenceCue("여기에 집 하나")).toBe(false);
  });
});

describe("카운터 키", () => {
  it("툴 이름과 지시문 주제를 함께 뽑는다", () => {
    const keys = counterKeysForTurn("마을을 작게 만들고 어둡게 해줘", ["author_house", "paint_tiles"]);
    expect(keys).toContain("tool:author_house");
    expect(keys).toContain("tool:paint_tiles");
    expect(keys).toContain("scale:small");
    expect(keys).toContain("tone:dark");
    expect(keys).not.toContain("scale:large");
  });

  it("빈 툴 이름은 키를 만들지 않는다", () => {
    expect(counterKeysForTurn("아무 말", ["", "  "])).toEqual([]);
  });
});

describe("턴 관측", () => {
  const turn = (state: PreferenceSignalState, instruction: string, at: number, changed = true) =>
    observeTurnIn(state, { instruction, toolNames: ["author_house"], changed, at });

  it("변경을 남긴 턴이 정정 없이 넘어가면 무사통과 +1", () => {
    let state = turn(emptyPreferenceSignalState(), "마을을 작게 만들어 줘", 1_000);
    state = turn(state, "나무를 심어 줘", 2_000);
    expect(state.counters["tool:author_house"]).toEqual({ pos: SETTLED_WEIGHT, neg: 0, at: 2_000 });
    expect(state.counters["scale:small"]).toEqual({ pos: SETTLED_WEIGHT, neg: 0, at: 2_000 });
    expect(state.pending).toHaveLength(0);
  });

  it("60초 안의 부정 발화는 정정 −2 로 집계된다", () => {
    let state = turn(emptyPreferenceSignalState(), "마을을 크게 만들어 줘", 1_000);
    state = turn(state, "아니 너무 크다", 1_000 + CORRECTION_WINDOW_MS);
    expect(state.counters["tool:author_house"]).toEqual({ pos: 0, neg: 2, at: 1_000 + CORRECTION_WINDOW_MS });
    expect(state.pending).toHaveLength(1);
    expect(state.pending[0].kind).toBe("correction");
    // pending 은 **직전 턴의 지시문**을 대상으로 남긴다 — 증류가 무엇이 거부됐는지 알아야 한다.
    expect(state.pending[0].instruction).toBe("마을을 크게 만들어 줘");
    expect(state.pending[0].note).toBe("아니 너무 크다");
  });

  it("창을 1ms 넘기면 정정이 아니라 무사통과다", () => {
    let state = turn(emptyPreferenceSignalState(), "마을을 크게 만들어 줘", 1_000);
    state = turn(state, "아니 너무 크다", 1_001 + CORRECTION_WINDOW_MS);
    expect(state.counters["tool:author_house"].neg).toBe(0);
    expect(state.counters["tool:author_house"].pos).toBe(SETTLED_WEIGHT);
    expect(state.pending.filter((signal) => signal.kind === "correction")).toHaveLength(0);
  });

  it("아무것도 바꾸지 않은 턴은 신호가 되지 않는다", () => {
    let state = turn(emptyPreferenceSignalState(), "이 맵 설명해 줘", 1_000, false);
    state = turn(state, "아니 그게 아니야", 2_000);
    expect(state.counters).toEqual({});
  });

  it("명시 선언은 즉시 pending 에 쌓인다", () => {
    const state = turn(emptyPreferenceSignalState(), "항상 마을은 작게 만들어 줘", 1_000);
    expect(state.pending).toHaveLength(1);
    expect(state.pending[0].kind).toBe("stated");
    expect(state.pending[0].weight).toBe(0);
  });

  it("지시문은 상한 길이로 잘려 저장된다", () => {
    const state = turn(emptyPreferenceSignalState(), "가".repeat(PENDING_TEXT_MAX_CHARS + 50), 1_000);
    expect(state.lastTurn?.instruction).toHaveLength(PENDING_TEXT_MAX_CHARS);
  });
});

describe("되돌리기", () => {
  it("되돌리면 −3 이 들어가고 그 턴은 무사통과를 받지 못한다", () => {
    let state = observeTurnIn(emptyPreferenceSignalState(), {
      instruction: "마을을 크게 만들어 줘",
      toolNames: ["author_house"],
      changed: true,
      at: 1_000,
    });
    state = noteUndoIn(state, { at: 1_500 });
    expect(state.counters["tool:author_house"]).toEqual({ pos: 0, neg: 3, at: 1_500 });
    expect(state.pending[0].kind).toBe("undo");
    expect(state.pending[0].instruction).toBe("마을을 크게 만들어 줘");

    // 다음 턴이 와도 되돌린 턴에 +1 을 주지 않는다.
    state = observeTurnIn(state, { instruction: "나무를 심어 줘", toolNames: ["paint_tiles"], changed: true, at: 2_000 });
    expect(state.counters["tool:author_house"]).toEqual({ pos: 0, neg: 3, at: 1_500 });
  });

  it("호출부가 툴 이름을 주면 직전 턴 대신 그것을 쓴다", () => {
    const state = noteUndoIn(emptyPreferenceSignalState(), { toolNames: ["author_dungeon"], at: 1_000 });
    expect(state.counters["tool:author_dungeon"].neg).toBe(3);
  });

  it("대상이 아무것도 없으면 상태를 바꾸지 않는다", () => {
    const before = emptyPreferenceSignalState();
    expect(noteUndoIn(before, {})).toBe(before);
  });
});

describe("증류 트리거", () => {
  it("명시 선언 1건이면 건수를 기다리지 않는다", () => {
    const state = observeTurnIn(emptyPreferenceSignalState(), {
      instruction: "항상 작게 만들어 줘",
      toolNames: [],
      changed: false,
      at: 1_000,
    });
    expect(state.pending).toHaveLength(1);
    expect(shouldDistillPreferences(state)).toBe(true);
  });

  it("선언 없이 관측만 쌓이면 상한 건수에서 돈다", () => {
    const state: PreferenceSignalState = {
      ...emptyPreferenceSignalState(),
      pending: Array.from({ length: DISTILL_PENDING_THRESHOLD - 1 }, (_, index) => ({
        at: index,
        kind: "undo" as const,
        instruction: `지시 ${index}`,
        toolNames: [],
        weight: UNDO_WEIGHT,
      })),
    };
    expect(shouldDistillPreferences(state)).toBe(false);
    expect(
      shouldDistillPreferences({
        ...state,
        pending: [...state.pending, { at: 99, kind: "undo", instruction: "하나 더", toolNames: [], weight: UNDO_WEIGHT }],
      }),
    ).toBe(true);
  });
});

describe("저장 게이트", () => {
  it("관측이 저장되고 되읽힌다", () => {
    observeTurn({ instruction: "마을을 작게", toolNames: ["author_house"], changed: true, at: 1_000 });
    noteAiChangeUndone({ at: 1_500 });
    const loaded = loadPreferenceSignals();
    expect(loaded.counters["tool:author_house"].neg).toBe(3);
    expect(loaded.pending).toHaveLength(1);
  });

  it("pending 은 상한을 넘지 않는다", () => {
    let state = emptyPreferenceSignalState();
    for (let index = 0; index < PENDING_SIGNAL_LIMIT + 6; index += 1) {
      state = noteUndoIn(state, { instruction: `지시 ${index}`, toolNames: ["t"], at: index });
    }
    expect(state.pending).toHaveLength(PENDING_SIGNAL_LIMIT);
    expect(state.pending[0].instruction).toBe(`지시 ${6}`);
  });

  it("증류 성공은 pending 과 실패 카운터를 비운다", () => {
    savePreferenceSignals({
      counters: { "tool:a": { pos: 1, neg: 0, at: 1 } },
      pending: [{ at: 1, kind: "undo", instruction: "x", toolNames: [], weight: UNDO_WEIGHT }],
      lastTurn: null,
      distillFailures: 2,
    });
    consumePendingSignals();
    const loaded = loadPreferenceSignals();
    expect(loaded.pending).toEqual([]);
    expect(loaded.distillFailures).toBe(0);
    // 카운터는 남는다 — 증류가 실패해도 집계는 손실되지 않아야 한다는 설계와 같은 이유.
    expect(loaded.counters["tool:a"]).toEqual({ pos: 1, neg: 0, at: 1 });
  });

  it("연속 실패 상한에 닿으면 pending 앞 절반을 버린다", () => {
    savePreferenceSignals({
      ...emptyPreferenceSignalState(),
      pending: Array.from({ length: 6 }, (_, index) => ({
        at: index,
        kind: "undo" as const,
        instruction: `지시 ${index}`,
        toolNames: [],
        weight: UNDO_WEIGHT,
      })),
    });
    for (let attempt = 0; attempt < DISTILL_FAILURE_LIMIT - 1; attempt += 1) {
      notePreferenceDistillFailure();
      expect(loadPreferenceSignals().pending).toHaveLength(6);
    }
    notePreferenceDistillFailure();
    const loaded = loadPreferenceSignals();
    expect(loaded.pending).toHaveLength(3);
    expect(loaded.pending[0].instruction).toBe("지시 3");
    expect(loaded.distillFailures).toBe(0);
  });

  it("깨진 저장값은 빈 상태로 떨어진다", () => {
    localStorage.setItem(PREFERENCE_SIGNALS_STORAGE_KEY, "[[[");
    expect(loadPreferenceSignals()).toEqual(emptyPreferenceSignalState());
  });

  it("모양이 어긋난 항목은 걸러진다", () => {
    localStorage.setItem(
      PREFERENCE_SIGNALS_STORAGE_KEY,
      JSON.stringify({
        counters: { good: { pos: 1, neg: 2, at: 3 }, bad: { pos: "1" } },
        pending: [{ at: 1, kind: "undo", instruction: "x", toolNames: [], weight: -3 }, { kind: "nope" }],
        lastTurn: { at: "nope" },
        distillFailures: -5,
      }),
    );
    const loaded = loadPreferenceSignals();
    expect(Object.keys(loaded.counters)).toEqual(["good"]);
    expect(loaded.pending).toHaveLength(1);
    expect(loaded.lastTurn).toBeNull();
    expect(loaded.distillFailures).toBe(0);
  });

  it("전체 비우기가 저장 키를 없앤다", () => {
    observeTurn({ instruction: "x", toolNames: ["t"], changed: true, at: 1 });
    clearPreferenceSignals();
    expect(localStorage.getItem(PREFERENCE_SIGNALS_STORAGE_KEY)).toBeNull();
  });

  it("localStorage 가 없으면 조용히 빈 상태로 동작한다", () => {
    Reflect.deleteProperty(globalThis, "localStorage");
    expect(loadPreferenceSignals()).toEqual(emptyPreferenceSignalState());
    expect(() => observeTurn({ instruction: "x", toolNames: [], changed: true, at: 1 })).not.toThrow();
    expect(() => noteAiChangeUndone()).not.toThrow();
  });
});
