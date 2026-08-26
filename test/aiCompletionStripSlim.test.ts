// 적용 완료 스트립은 컴포저 바로 위 고정 밴드에 산다. 여기에 프롬프트 주입 버튼을 여러 개
// 세워두면 사용자 눈에는 "매번 하단에 이상한 버튼들이 뜬다"로 읽힌다(감독 지시 2026-08-25).
// 그래서 스트립은 요약 한 줄 + 되돌리기 하나로 좁힌다 — 시연/다듬기/검사 는 컴포저에 입력하면
// 되는 일이라 상시 버튼일 이유가 없다.
import { afterEach, describe, expect, it } from "vitest";
import { buildAiCompletionStrip } from "@/editor/panels/aiCompletionStrip";
import type { AiApplyCompletionContext } from "@/editor/aiApplyCompletion";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

let teardown: (() => void) | null = null;

afterEach(() => {
  teardown?.();
  teardown = null;
});

function context(overrides: Partial<AiApplyCompletionContext> = {}): AiApplyCompletionContext {
  return {
    id: 1,
    mapId: "map_village",
    selection: null,
    instruction: "마을에 대장간 하나",
    summary: "집 1 · 길",
    historyAt: null,
    ...overrides,
  } as AiApplyCompletionContext;
}

function buildStrip(ctx: AiApplyCompletionContext = context()): FakeElement {
  return renderWithFakeDom(() => buildAiCompletionStrip({ context: ctx }).element);
}

describe("적용 완료 스트립 — 하단 정리", () => {
  it("요약과 되돌리기만 남기고 프롬프트 주입 버튼은 세우지 않는다", () => {
    teardown = installFakeDom();
    const strip = buildStrip();

    expect(findByTestId(strip, "ai-completion-undo")).toBeTruthy();
    for (const removed of ["ai-completion-test", "ai-completion-refine", "ai-completion-audit"]) {
      expect(findByTestId(strip, removed), removed).toBeNull();
    }
  });

  it("스트립 안의 버튼은 되돌리기 하나뿐이다", () => {
    teardown = installFakeDom();
    const strip = buildStrip();

    const buttons: FakeElement[] = [];
    const walk = (node: FakeElement): void => {
      for (const child of node.children as FakeElement[]) {
        if (child.tagName?.toLowerCase() === "button") buttons.push(child);
        walk(child);
      }
    };
    walk(strip);

    expect(buttons.map((b) => b.dataset?.testid)).toEqual(["ai-completion-undo"]);
  });

  it("요약 문구는 그대로 보여준다", () => {
    teardown = installFakeDom();
    const strip = buildStrip(context({ summary: "집 3 · 강 · 앞마당" }));

    expect(strip.textContent).toContain("집 3 · 강 · 앞마당");
  });

  it("되돌릴 체크포인트가 없으면 되돌리기는 비활성이다", () => {
    teardown = installFakeDom();
    const strip = buildStrip(context({ historyAt: null }));

    const undo = findByTestId(strip, "ai-completion-undo");
    expect(undo?.getAttribute("aria-disabled")).toBe("true");
  });
});
