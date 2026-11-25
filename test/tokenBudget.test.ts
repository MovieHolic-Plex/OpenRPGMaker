// test/tokenBudget.test.ts
// 토큰 예산 보정 계약 테스트 — 순수 계산(기본값 재현·중앙값·클램프)과 localStorage 게이트 폴백.

import { afterEach, describe, expect, it } from "vitest";
import {
  CALIBRATION_CLAMP_MAX_RATIO,
  CALIBRATION_CLAMP_MIN_RATIO,
  CALIBRATION_WINDOW,
  DEFAULT_CHARS_PER_TOKEN,
  TOKEN_CALIBRATION_STORAGE_KEY,
  calibratedBudgetChars,
  charsPerTokenEstimate,
  estimatePromptChars,
  loadTokenObservations,
  recordTokenObservation,
  saveTokenObservations,
  type TokenObservation,
} from "@/ai/tokenBudget";
import { DEFAULT_BUDGET_CHARS } from "@/ai/contextBuilder";

function obs(promptChars: number, promptTokens: number): TokenObservation {
  return { promptChars, promptTokens };
}

/** 비율 목록 → 관측 목록(토큰 1000 기준). */
function obsWithRatios(ratios: readonly number[]): TokenObservation[] {
  return ratios.map((ratio) => obs(Math.round(ratio * 1000), 1000));
}

describe("charsPerTokenEstimate — 순수 계산", () => {
  it("빈 관측이면 기본 계수를 그대로 돌려준다", () => {
    expect(charsPerTokenEstimate([])).toBe(DEFAULT_CHARS_PER_TOKEN);
    expect(charsPerTokenEstimate([], 3)).toBe(3);
  });

  it("무효 관측(0/음수/NaN)은 무시되어 기본 계수로 폴백한다", () => {
    const invalid = [obs(0, 100), obs(-5, 100), obs(100, 0), obs(Number.NaN, 100), obs(100, Number.NaN)];
    expect(charsPerTokenEstimate(invalid)).toBe(DEFAULT_CHARS_PER_TOKEN);
  });

  it("최근 N개 중앙값 — 아웃라이어 하나가 계수를 끌고 가지 못한다", () => {
    // 한국어 실측에 가까운 2.4~2.6 사이에서 아웃라이어 50이 하나 섞여도 중앙값은 안정적이다.
    const estimate = charsPerTokenEstimate(obsWithRatios([2.4, 2.5, 2.6, 50]));
    expect(estimate).toBeGreaterThanOrEqual(2.5);
    expect(estimate).toBeLessThanOrEqual(2.6);
  });

  it("중앙값이 클램프 밖이면 기본값의 0.5×~1.5×로 잘린다", () => {
    const upper = charsPerTokenEstimate(obsWithRatios([100, 120, 90]));
    expect(upper).toBe(DEFAULT_CHARS_PER_TOKEN * CALIBRATION_CLAMP_MAX_RATIO);
    const lower = charsPerTokenEstimate(obsWithRatios([0.4, 0.3, 0.5]));
    expect(lower).toBe(DEFAULT_CHARS_PER_TOKEN * CALIBRATION_CLAMP_MIN_RATIO);
  });

  it("윈도우(CALIBRATION_WINDOW) 밖의 오래된 관측은 버린다", () => {
    // 오래된 관측은 비율 3.9(≈기본), 최근 윈도우는 전부 2.0 — 최근만 반영돼야 한다.
    const old = obsWithRatios(Array.from({ length: 5 }, () => 3.9));
    const recent = obsWithRatios(Array.from({ length: CALIBRATION_WINDOW }, () => 2));
    expect(charsPerTokenEstimate([...old, ...recent])).toBe(2);
  });
});

describe("calibratedBudgetChars — 예산 재척도", () => {
  it("관측이 없으면 현행 예산을 정확히 재현한다(보수적 기본값)", () => {
    expect(calibratedBudgetChars(DEFAULT_BUDGET_CHARS, [])).toBe(DEFAULT_BUDGET_CHARS);
  });

  it("관측 계수 비율만큼 예산을 재척도한다(한국어 → 축소)", () => {
    // chars/token 2 (기본 4의 절반) → 같은 토큰 목표를 지키려면 문자 예산도 절반.
    expect(calibratedBudgetChars(12000, obsWithRatios([2, 2, 2]))).toBe(6000);
  });

  it("클램프 덕에 예산은 기본의 0.5×~1.5×를 벗어나지 않는다", () => {
    expect(calibratedBudgetChars(12000, obsWithRatios([100, 100, 100]))).toBe(18000);
    expect(calibratedBudgetChars(12000, obsWithRatios([0.1, 0.1, 0.1]))).toBe(6000);
  });
});

describe("estimatePromptChars — 프롬프트 문자 수", () => {
  it("문자열 content·text 파트·tool_calls 이름/인자·extraChars를 합산한다", () => {
    const estimate = estimatePromptChars(
      [
        { content: "abcd" }, // 4
        { content: [{ type: "text", text: "한국어여섯자" }] }, // 6
        { content: null, tool_calls: [{ function: { name: "place_npc", arguments: "{\"x\":1}" } }] }, // 9 + 7
      ],
      100,
    );
    expect(estimate.chars).toBe(4 + 6 + 9 + 7 + 100);
    expect(estimate.hasImages).toBe(false);
  });

  it("이미지 파트는 문자 수에서 빼고 hasImages로 표시한다(관측 제외 신호)", () => {
    const estimate = estimatePromptChars([
      { content: [{ type: "text", text: "ab" }, { type: "image_url" }] },
    ]);
    expect(estimate.chars).toBe(2);
    expect(estimate.hasImages).toBe(true);
  });
});

// ── localStorage 게이트 ───────────────────────────────────────────

type MutableGlobal = { localStorage?: unknown };

const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function installFakeLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  (globalThis as MutableGlobal).localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
  return store;
}

function removeLocalStorage(): void {
  delete (globalThis as MutableGlobal).localStorage;
}

afterEach(() => {
  if (originalDescriptor) Object.defineProperty(globalThis, "localStorage", originalDescriptor);
  else removeLocalStorage();
});

describe("localStorage 게이트", () => {
  it("localStorage가 없으면(Node) 로드는 빈 목록, 저장/기록은 조용히 넘어간다", () => {
    removeLocalStorage();
    expect(loadTokenObservations()).toEqual([]);
    expect(() => saveTokenObservations([obs(100, 50)])).not.toThrow();
    // 저장소가 없으니 기록은 누적되지 않고, 이번 관측만 담긴 목록을 돌려준다.
    expect(recordTokenObservation(obs(100, 50))).toEqual([obs(100, 50)]);
    expect(recordTokenObservation(obs(200, 50))).toEqual([obs(200, 50)]);
  });

  it("기록(record)은 로드→추가→트림→저장 라운드트립으로 누적된다", () => {
    const store = installFakeLocalStorage();
    recordTokenObservation(obs(100, 50));
    const second = recordTokenObservation(obs(200, 80));
    expect(second).toEqual([obs(100, 50), obs(200, 80)]);
    expect(loadTokenObservations()).toEqual([obs(100, 50), obs(200, 80)]);
    expect(store.has(TOKEN_CALIBRATION_STORAGE_KEY)).toBe(true);
  });

  it("윈도우를 넘는 관측은 오래된 것부터 버린다", () => {
    installFakeLocalStorage();
    for (let index = 1; index <= CALIBRATION_WINDOW + 3; index += 1) {
      recordTokenObservation(obs(index * 10, 10));
    }
    const loaded = loadTokenObservations();
    expect(loaded).toHaveLength(CALIBRATION_WINDOW);
    expect(loaded[0]).toEqual(obs(40, 10)); // 1~3번째가 밀려남.
  });

  it("깨진 JSON·무효 항목은 조용히 빈 목록/필터링으로 폴백한다", () => {
    const store = installFakeLocalStorage();
    store.set(TOKEN_CALIBRATION_STORAGE_KEY, "{broken json");
    expect(loadTokenObservations()).toEqual([]);
    store.set(
      TOKEN_CALIBRATION_STORAGE_KEY,
      JSON.stringify({ observations: [obs(100, 50), { promptChars: "x", promptTokens: 1 }, 42] }),
    );
    expect(loadTokenObservations()).toEqual([obs(100, 50)]);
  });

  it("record에 무효 관측을 넘기면 저장하지 않고 기존 목록을 돌려준다", () => {
    installFakeLocalStorage();
    recordTokenObservation(obs(100, 50));
    expect(recordTokenObservation(obs(0, 50))).toEqual([obs(100, 50)]);
    expect(loadTokenObservations()).toEqual([obs(100, 50)]);
  });
});
