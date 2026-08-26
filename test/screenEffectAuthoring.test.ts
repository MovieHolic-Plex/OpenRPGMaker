/**
 * 계약: **`화면 효과`(Screen Effect) 저작면은 런타임과 같은 것을 보여준다.**
 *
 * 회귀 배경(적대적 QA `.omo/evidence/screen-fx-2/qa-before.md`):
 *  - D1: `.ecp-screen-effect-*` CSS 가 저장소에 없어 오버레이 박스가 0×0 이었다.
 *        여기서는 레이아웃 대신 **클래스/인라인 계약**을 고정한다(CSS 는 실측 e2e 가 지킨다).
 *  - D2: 재생 컨트롤이 없어 durationMs 의 시각 차가 0 이었다 → 재생 버튼 + 불투명도 전이 계약.
 *  - D3: `#xyz` 같은 값에서 프리뷰가 rgba(0,0,0,0) 이었다 → 런타임 폴백(흰색 워시) + 사유 표시.
 *  - D4: 빈 tint 를 프리뷰는 빨강 불투명, 런타임은 `neutral`(색조 제거)로 읽었다.
 *
 * 폼(색 피커·시간 범위)과 목록 요약은 test/screenEffectFields.test.ts 가 지킨다.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { FakeElement, findByTestId, flushFakeAnimationFrames, installFakeDom, renderWithFakeDom } from "./fakeDom";

const SCREEN_EFFECT_ID = "m2-202-screen-effect";

function screenEffect(fields: Record<string, unknown>): Command {
  return { kind: "m2Command", commandId: SCREEN_EFFECT_ID, fields } as unknown as Command;
}

function previewOf(fields: Record<string, unknown>): FakeElement {
  return renderWithFakeDom(() => renderCommandPreview(screenEffect(fields)));
}

function numberOf(value: string): number {
  return Number.parseFloat(value);
}

describe("screen effect authoring — stage and play control", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom({ animationFrames: "manual" });
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("stage keeps the mini-monitor class contract so CSS can size the overlay (D1)", () => {
    const preview = previewOf({ effect: "fadeOut", value: "", durationMs: 600 });
    const stage = findByTestId(preview, "ecp-screen-effect-stage");
    expect(stage).toBeTruthy();
    const screen = findByTestId(preview, "ecp-screen-effect-screen");
    const overlay = findByTestId(preview, "ecp-screen-effect-overlay");
    expect(screen?.className).toContain("ecp-screen-effect-screen");
    expect(overlay?.className).toContain("ecp-screen-effect-overlay");
    // 장면(가짜 게임 화면)이 있어야 효과가 덮이는 것이 보인다.
    expect(findByTestId(preview, "ecp-screen-effect-scene")).toBeTruthy();
    // 정지 상태에서도 효과의 도착 상태를 보여준다 — 흰 빈 사각형 금지.
    expect(numberOf(overlay?.style.opacity ?? "0")).toBeGreaterThan(0.5);
    expect(overlay?.style.background).toContain("rgba(0,0,0,1)");
  });

  it("play control replays the effect from its start state for durationMs (D2)", () => {
    const preview = previewOf({ effect: "fadeOut", value: "", durationMs: 900 });
    const play = findByTestId(preview, "ecp-screen-effect-play");
    const stage = findByTestId(preview, "ecp-screen-effect-stage");
    const overlay = findByTestId(preview, "ecp-screen-effect-overlay");
    expect(play).toBeTruthy();
    const rest = numberOf(overlay?.style.opacity ?? "0");

    play?.click();
    expect(stage?.dataset.playState).toBe("playing");
    expect(overlay?.className).toContain("is-fx-from");
    const start = numberOf(overlay?.style.opacity ?? "1");
    expect(start).toBeLessThan(rest);
    // 전이 시간은 durationMs 를 그대로 쓴다(clampMs 의미로 묶은 값).
    expect(stage?.style["--ecp-fx-duration"]).toBe("900ms");

    flushFakeAnimationFrames();
    expect(overlay?.className).not.toContain("is-fx-from");
    const end = numberOf(overlay?.style.opacity ?? "0");
    expect(end - start).toBeGreaterThan(0.3);
    expect(end).toBe(rest);
  });

  it("empty tint value previews the runtime's neutral tone-reset, not opaque red (D4)", () => {
    const preview = previewOf({ effect: "tint", value: "", durationMs: 300 });
    const overlay = findByTestId(preview, "ecp-screen-effect-overlay");
    expect(overlay?.className).toContain("is-fx-neutral");
    expect(overlay?.style.background).not.toContain("#ff0000");
    expect(preview.textContent).toContain("색조 제거");
  });

  it("full-strength hex tint previews at the runtime alpha (D4)", () => {
    const preview = previewOf({ effect: "tint", value: "#39ff14", durationMs: 300 });
    const overlay = findByTestId(preview, "ecp-screen-effect-overlay");
    expect(overlay?.style.background).toBe("rgba(57,255,20,0.45)");
  });

  it("invalid tint previews the runtime fallback (white wash) and says so (D3)", () => {
    const preview = previewOf({ effect: "tint", value: "#xyz", durationMs: 300 });
    const overlay = findByTestId(preview, "ecp-screen-effect-overlay");
    // parseTintColor("#xyz") → screenColorToRgb 폴백 = 흰색 45%. 투명 검정 금지.
    expect(overlay?.style.background).toBe("rgba(255,255,255,0.45)");
    expect(findByTestId(preview, "ecp-screen-effect-error")?.textContent).toContain("#xyz");
  });
});
