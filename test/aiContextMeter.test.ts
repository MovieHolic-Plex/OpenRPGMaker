// test/aiContextMeter.test.ts
// 맥락 게이지 — 라벨/톤 계산과 팝오버가 스냅샷을 그대로 비추는지.
//
// 톤 기준은 **자동 압축 임계** 다(모델 창이 아니다): 사용자가 궁금한 것은 "창이 얼마 남았나"
// 가 아니라 "언제 자동으로 압축이 도는가" 이기 때문이다. 게이지가 창 기준으로 세면 임계를
// 넘어 압축이 돌아도 게이지는 한가하게 보인다.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  contextUsagePercent,
  contextUsageTone,
  createAiContextMeter,
  formatContextMeterLabel,
  type AiContextSnapshot,
} from "@/editor/panels/aiContextMeter";
import type { ContextUsage } from "@/ai/contextCompaction";
import { EMPTY_SESSION_USAGE, addSessionUsage } from "@/ai/sessionUsage";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;

function usage(overrides: Partial<ContextUsage> = {}): ContextUsage {
  return {
    estimateTokens: 40_000,
    usageTokens: 0,
    contextTokens: 40_000,
    contextWindow: 128_000,
    reserveTokens: 16_384,
    thresholdTokens: 111_616,
    ratio: 40_000 / 128_000,
    overThreshold: false,
    ...overrides,
  };
}

function snapshot(overrides: Partial<AiContextSnapshot> = {}): AiContextSnapshot {
  return {
    usage: usage(),
    totals: EMPTY_SESSION_USAGE,
    summary: null,
    canUndoCompaction: false,
    busy: false,
    ...overrides,
  };
}

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

describe("게이지 숫자와 톤", () => {
  it("Given 비율 When 퍼센트 Then 정수로 반올림한다", () => {
    expect(contextUsagePercent(usage({ ratio: 0.6249 }))).toBe(62);
    expect(contextUsagePercent(usage({ ratio: 0 }))).toBe(0);
  });

  it("Given 임계 미만 When 톤 Then idle", () => {
    expect(contextUsageTone(usage({ contextTokens: 40_000 }))).toBe("idle");
  });

  it("Given 임계의 80% 이상 When 톤 Then near", () => {
    expect(contextUsageTone(usage({ contextTokens: Math.ceil(111_616 * 0.8) }))).toBe("near");
  });

  it("Given 임계 초과 When 톤 Then warn", () => {
    expect(contextUsageTone(usage({ contextTokens: 120_000, overThreshold: true }))).toBe("warn");
  });

  it("Given 세션 없음 When 라벨 Then 숫자 대신 빗금이다(0% 라고 거짓말하지 않는다)", () => {
    expect(formatContextMeterLabel(null)).toBe("맥락 —");
    expect(formatContextMeterLabel(usage({ ratio: 0.31 }))).toBe("맥락 31%");
  });
});

describe("팝오버 내용", () => {
  it("Given 세션 없음 When 렌더 Then 압축 버튼이 잠기고 안내 문장이 온다", () => {
    const meter = createAiContextMeter({
      read: () => snapshot({ usage: null }),
      onCompact: () => undefined,
      onUndoCompaction: () => undefined,
      onToggle: () => undefined,
    });
    const popover = meter.popover as unknown as FakeElement;

    expect((meter.button as unknown as FakeElement).textContent).toBe("맥락 —");
    expect(findByTestId(popover, "ai-context-headline")!.textContent).toBe("아직 대화가 없습니다");
    expect((findByTestId(popover, "ai-context-compact") as unknown as { disabled: boolean }).disabled).toBe(true);
    expect(findByTestId(popover, "ai-context-usage")!.textContent).toBe("아직 요청 없음");
  });

  it("Given 사용량과 요약이 있는 스냅샷 When 갱신 Then 토큰·임계·모델별 집계가 보인다", () => {
    let current = snapshot({
      usage: usage({ usageTokens: 52_000, contextTokens: 52_000, ratio: 52_000 / 128_000 }),
      totals: addSessionUsage(EMPTY_SESSION_USAGE, "gpt-x", { prompt_tokens: 52_000, completion_tokens: 900 }),
      summary: "## Goal\n마을 정비",
    });
    const meter = createAiContextMeter({
      read: () => current,
      onCompact: () => undefined,
      onUndoCompaction: () => undefined,
      onToggle: () => undefined,
    });
    const popover = meter.popover as unknown as FakeElement;

    expect((meter.button as unknown as FakeElement).textContent).toBe("맥락 41%");
    expect((meter.button as unknown as FakeElement).dataset.tone).toBe("idle");
    const detail = findByTestId(popover, "ai-context-detail")!.textContent;
    expect(detail).toContain("52,000 / 128,000 토큰");
    expect(detail).toContain("자동 압축 임계 111,616 토큰");
    expect(findByTestId(popover, "ai-context-usage")!.textContent).toBe("호출 1회 · 입력 52,000 · 출력 900");
    expect(findByTestId(popover, "ai-context-models")!.textContent).toContain("gpt-x");
    // 요약 원문은 접힌 채 존재한다 — 토글로만 펼친다.
    const body = findByTestId(popover, "ai-context-summary-body")!;
    expect(body.hidden).toBe(true);
    expect(body.textContent).toContain("마을 정비");
    (findByTestId(popover, "ai-context-summary-toggle") as unknown as HTMLElement).click();
    expect(body.hidden).toBe(false);

    // 임계를 넘기면 톤이 경고로 바뀐다.
    current = snapshot({ usage: usage({ contextTokens: 120_000, ratio: 120_000 / 128_000, overThreshold: true }) });
    meter.refresh();
    expect((meter.button as unknown as FakeElement).dataset.tone).toBe("warn");
    expect(findByTestId(popover, "ai-context-detail")!.textContent).toContain("이미 넘었습니다");
  });

  it("Given 턴 진행 중 When 갱신 Then 압축·되돌리기 둘 다 잠긴다(요약 콜이 진행 중 요청과 겹친다)", () => {
    const meter = createAiContextMeter({
      read: () => snapshot({ busy: true, canUndoCompaction: true }),
      onCompact: () => undefined,
      onUndoCompaction: () => undefined,
      onToggle: () => undefined,
    });
    const popover = meter.popover as unknown as FakeElement;

    expect((findByTestId(popover, "ai-context-compact") as unknown as { disabled: boolean }).disabled).toBe(true);
    expect((findByTestId(popover, "ai-context-compact-undo") as unknown as { disabled: boolean }).disabled).toBe(true);
  });

  it("Given 되돌릴 압축이 없음 When 갱신 Then 되돌리기 버튼 자체를 숨긴다", () => {
    const meter = createAiContextMeter({
      read: () => snapshot(),
      onCompact: () => undefined,
      onUndoCompaction: () => undefined,
      onToggle: () => undefined,
    });

    expect(findByTestId(meter.popover as unknown as FakeElement, "ai-context-compact-undo")!.hidden).toBe(true);
  });

  it("Given 버튼 클릭 When 콜백 Then 압축·되돌리기·열기 신호가 각각 나간다", () => {
    const calls: string[] = [];
    const meter = createAiContextMeter({
      read: () => snapshot({ canUndoCompaction: true }),
      onCompact: () => calls.push("compact"),
      onUndoCompaction: () => calls.push("undo"),
      onToggle: () => calls.push("toggle"),
    });
    const popover = meter.popover as unknown as FakeElement;

    (meter.button as unknown as HTMLElement).click();
    (findByTestId(popover, "ai-context-compact") as unknown as HTMLElement).click();
    (findByTestId(popover, "ai-context-compact-undo") as unknown as HTMLElement).click();

    expect(calls).toEqual(["toggle", "compact", "undo"]);
  });
});
