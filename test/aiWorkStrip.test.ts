// 조수가 한 일 — 캔버스 하단 가로 띠(aiWorkStrip). 대화 창에서 빠진 작업 산출물이 여기로 온다(방향 G, 2026-09-17).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AI_WORK_STRIP_MAX_VISIBLE,
  aiWorkCardCount,
  beginAiWorkCard,
  getAiWorkStripElement,
  resetAiWorkStripForTest,
} from "@/editor/panels/aiWorkStrip";
import type { ChangePreviewInput } from "@/editor/panels/aiChangePreview";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;

function strip(): FakeElement {
  const root = getAiWorkStripElement() as unknown as FakeElement | null;
  if (!root) throw new Error("작업 띠가 없다");
  return root;
}

function cards(): FakeElement[] {
  return strip().querySelectorAll("[data-testid=ai-work-card]");
}

function stepEntry(text: string): HTMLElement {
  const entry = document.createElement("div");
  entry.className = "ai-tool-activity-line ai-act";
  entry.dataset.testid = "ai-tool-entry";
  entry.textContent = text;
  return entry;
}

function changedPreview(title = "광장 바닥 8×6"): ChangePreviewInput {
  const before = store.getCurrent();
  const mapId = before.startMapId;
  const after = structuredClone(before);
  after.maps[mapId]!.lowerTiles[0] = (after.maps[mapId]!.lowerTiles[0] ?? 0) + 1;
  return { before, after, mapId, title, chips: ["타일 48", "이벤트 +1"], onUndo: vi.fn() };
}

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
});

afterEach(() => {
  resetAiWorkStripForTest();
  restoreDom?.();
  restoreDom = null;
});

describe("작업 띠 — 카드 생명주기", () => {
  it("첫 카드가 생기면 띠가 body 에 붙고 머리 알약이 개수를 말한다", () => {
    // Break: 띠가 채팅 로그 안에 붙거나, 카드 수가 머리에 안 나온다.
    const card = beginAiWorkCard({ title: "우물 놓고 상인 세워줘", onStop: vi.fn() });
    const root = strip();
    expect((document.body as unknown as FakeElement).children).toContain(root);
    expect(root.hidden).toBe(false);
    expect(findByTestId(root, "ai-work-strip-toggle")?.textContent).toContain("조수가 한 일");
    expect(findByTestId(root, "ai-work-strip-toggle")?.textContent).toContain("1");
    expect(card.root.dataset.state).toBe("running");
    expect(findByTestId(card.root as unknown as FakeElement, "ai-work-card-stop")).not.toBeNull();
    expect(root.className).toContain("is-running");
  });

  it("진행 중 카드는 중지 버튼으로 onStop 을 부르고, 단계는 쓰기만 세고 조회는 개수만", () => {
    const onStop = vi.fn();
    const card = beginAiWorkCard({ title: "길 깔아줘", onStop });
    card.noteReadOnly();
    card.noteReadOnly();
    card.appendStep(stepEntry("길 6칸"));
    findByTestId(card.root as unknown as FakeElement, "ai-work-card-stop")?.click();
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(findByTestId(card.root as unknown as FakeElement, "ai-work-card-step-count")?.textContent).toBe("1단계");
    expect(findByTestId(card.root as unknown as FakeElement, "ai-work-card-steps")?.querySelectorAll("[data-testid=ai-tool-entry]")).toHaveLength(1);
  });

  it("변경이 붙은 카드는 끝나면 완료 상태 + 맵에서 보기·이 작업만 되돌리기, 중지 버튼은 사라진다", () => {
    const preview = changedPreview();
    const card = beginAiWorkCard({ title: "광장", onStop: vi.fn() });
    card.appendStep(stepEntry("바닥 48칸"));
    card.attachChange(preview);
    card.finish({ ok: true });
    const root = card.root as unknown as FakeElement;
    expect(root.dataset.state).toBe("done");
    expect(findByTestId(root, "ai-work-card-stop")).toBeNull();
    expect(root.querySelector(".ai-work-card-title")?.textContent).toBe("광장 바닥 8×6");
    expect(findByTestId(root, "ai-work-card-meta")?.textContent).toContain("타일 48");
    expect(findByTestId(root, "ai-work-card-locate")).not.toBeNull();
    findByTestId(root, "ai-work-card-undo")?.click();
    expect(preview.onUndo).toHaveBeenCalledTimes(1);
    expect(root.className).toContain("is-undone");
    expect(card.discardIfEmpty()).toBe(false);
    expect(aiWorkCardCount()).toBe(1);
  });

  it("말만 한 턴(조회만·변경 없음)의 카드는 닫을 때 띠에서 빠지고 띠는 숨는다", () => {
    // Break: 질문에 답만 한 턴이 「조수가 한 일」 로 남아 띠를 채운다.
    const card = beginAiWorkCard({ title: "이 영역 크기 알려줘" });
    card.noteReadOnly();
    card.finish({ ok: true });
    expect(card.discardIfEmpty()).toBe(true);
    expect(aiWorkCardCount()).toBe(0);
    expect(strip().hidden).toBe(true);
  });

  it("카드 본문을 누르면 그 카드만 펼쳐져 변경 카드(전→후)와 단계가 그려지고, 나머지는 썸네일 칩", () => {
    const first = beginAiWorkCard({ title: "첫 일" });
    first.appendStep(stepEntry("a"));
    first.finish({ ok: true });
    const second = beginAiWorkCard({ title: "둘째 일" });
    second.appendStep(stepEntry("b"));
    second.attachChange(changedPreview("둘째 변경"));
    second.finish({ ok: true });

    const secondRoot = second.root as unknown as FakeElement;
    expect(findByTestId(secondRoot, "ai-change-card")).toBeNull(); // 펼치기 전엔 안 그린다
    secondRoot.querySelector(".ai-work-card-body")!.click();
    expect(secondRoot.className).toContain("is-open");
    expect(secondRoot.getAttribute("aria-expanded")).toBe("true");
    expect((first.root as unknown as FakeElement).className).toContain("is-mini");
    expect(strip().className).toContain("has-open");
    const changeCard = findByTestId(secondRoot, "ai-change-card");
    expect(changeCard).not.toBeNull();
    expect(changeCard?.querySelector(".ai-change-title")?.textContent).toBe("둘째 변경");
    expect(findByTestId(secondRoot, "ai-work-card-detail")?.querySelectorAll("[data-testid=ai-tool-entry]")).toHaveLength(1);

    // 다시 누르면 접힌다.
    secondRoot.querySelector(".ai-work-card-body")!.click();
    expect(secondRoot.className).not.toContain("is-open");
    expect((first.root as unknown as FakeElement).className).not.toContain("is-mini");
  });

  it("머리 알약은 띠를 접고, 넘치는 카드는 오래된 것부터 「+N」 뒤로 숨긴다", () => {
    for (let index = 0; index < AI_WORK_STRIP_MAX_VISIBLE + 2; index += 1) {
      const card = beginAiWorkCard({ title: `일 ${index + 1}` });
      card.appendStep(stepEntry(`s${index}`));
      card.finish({ ok: true });
    }
    const all = cards();
    expect(all).toHaveLength(AI_WORK_STRIP_MAX_VISIBLE + 2);
    expect(all.slice(0, 2).every((card) => card.hidden)).toBe(true);
    expect(all.slice(2).every((card) => !card.hidden)).toBe(true);
    const overflow = findByTestId(strip(), "ai-work-strip-overflow");
    expect(overflow?.hidden).toBe(false);
    expect(overflow?.textContent).toBe("+2");
    overflow?.click();
    expect(cards().every((card) => !card.hidden)).toBe(true);

    const toggle = findByTestId(strip(), "ai-work-strip-toggle");
    toggle?.click();
    expect(strip().className).toContain("is-folded");
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    toggle?.click();
    expect(strip().className).not.toContain("is-folded");
  });
});
