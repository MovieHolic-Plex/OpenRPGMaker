/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { createObjectiveCard, readingMs, syncObjectiveCard } from "@/player/objectiveCard";

function host(touch: boolean): HTMLElement {
  const viewport = document.createElement("div");
  viewport.className = "play-viewport";
  if (touch) viewport.dataset.touchUi = "true";
  const stage = document.createElement("div");
  viewport.append(stage);
  document.body.append(viewport);
  return stage;
}

function firstCardControls(touch: boolean): string {
  const card = createObjectiveCard();
  const stage = host(touch);
  stage.append(card.element);
  syncObjectiveCard(card, stage, {}, null, true, 0);
  return card.element.querySelector(".objective-card-controls")?.textContent ?? "";
}

describe("objective card controls line (fs-vqa-fix-all, 390 touch)", () => {
  it("names keyboard keys on a keyboard screen", () => {
    expect(firstCardControls(false)).toContain("Esc");
  });

  it("names the on-screen buttons on a touch screen, not keyboard keys", () => {
    const text = firstCardControls(true);
    expect(text).not.toMatch(/Esc|Z |방향키/u);
    expect(text).toContain("A");
  });
});

// 2026-11-16 확인 빌드 r6 P10: 51자 목표가 구석의 목표 줄에서도, 처음 뜨는 띠에서도 «… 먼저 역 앞 전단지…» 로 끊겨 갈 곳을 말하는 뒷부분이 안 보였다.
describe("objective strip shows the whole objective text", () => {
  const LONG = "상점가 사람들에게 잃어버린 고양이를 본 적 있는지 물어보자. 먼저 역 앞 전단지 아주머니에게.";

  it("carries the full text on the first strip and on a change, and stays up longer for a long line", () => {
    const card = createObjectiveCard();
    const stage = host(false);
    const session = {};
    syncObjectiveCard(card, stage, session, LONG, true, 0);
    expect(card.element.dataset.kind).toBe("intro");
    expect(card.element.querySelector(".objective-card-text")?.textContent).toBe(LONG);
    // 긴 글은 읽을 시간만큼 더 떠 있다 — 짧은 글의 첫 띠는 2.8초 그대로.
    expect(readingMs(LONG)).toBe((Array.from(LONG).length - 20) * 55);
    expect(card.hideAtMs).toBe(2800 + readingMs(LONG));
    expect(readingMs("촌장에게 말을 걸자")).toBe(0);
    expect(readingMs("가".repeat(400))).toBe(4000);
    syncObjectiveCard(card, stage, session, LONG, true, card.hideAtMs + 1);
    expect(card.element.hidden).toBe(true);
    const next = "편의점 점원에게 아침에 본 고양이를 물어보자. 편의점은 역 앞 상점가 서쪽 끝이다.";
    syncObjectiveCard(card, stage, session, next, true, 20_000);
    expect(card.element.dataset.kind).toBe("change");
    expect(card.element.querySelector(".objective-card-text")?.textContent).toBe(next);
    expect(card.hideAtMs).toBe(20_000 + 2200 + readingMs(next));
  });
});
