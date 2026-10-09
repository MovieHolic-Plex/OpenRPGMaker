// test/aiInstructionsModal.test.ts
// 감독 지침 편집 모달 — 저장이 **프로젝트에** 들어가고, 되돌리기 스냅샷을 남기고,
// 세션에 알려 주는지.
//
// 프로젝트에 저장하는 이유(localStorage 가 아닌): 지침은 그 게임의 성질이지 이 브라우저의
// 설정이 아니다. 프로젝트를 옮기면 규칙도 따라가야 한다.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_INSTRUCTIONS_MAX_CHARS } from "@/ai/projectInstructions";
import { closeAiInstructionsModal, openAiInstructionsModal } from "@/editor/panels/aiInstructionsModal";
import { getMapEditHistoryMarker, getMapEditHistoryState, resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;

function open(saved: string[]): FakeElement {
  return openAiInstructionsModal({ onSaved: (value) => saved.push(value) }) as unknown as FakeElement;
}

function typeInto(backdrop: FakeElement, value: string): void {
  const input = findByTestId(backdrop, "ai-instructions-input") as unknown as HTMLTextAreaElement & FakeElement;
  input.value = value;
  input.dispatchEvent(new Event("input"));
}

function save(backdrop: FakeElement): void {
  (findByTestId(backdrop, "ai-instructions-save") as unknown as HTMLElement).click();
}

beforeEach(() => {
  store.replace(createBlankProject());
  // 히스토리는 모듈 전역이다 — 리셋하지 않으면 앞 케이스가 남긴 동일 서명 스냅샷 때문에
  // pushSnapshot 의 중복 제거가 이번 케이스의 스냅샷을 삼킨다.
  resetMapEditHistory();
  restoreDom = installFakeDom();
});

afterEach(() => {
  closeAiInstructionsModal();
  restoreDom?.();
  restoreDom = null;
  vi.restoreAllMocks();
});

describe("감독 지침 모달", () => {
  it("Given 지침 없는 프로젝트 When 열기 Then 빈 입력과 0자 카운터", () => {
    const backdrop = open([]);

    expect((findByTestId(backdrop, "ai-instructions-input") as unknown as HTMLTextAreaElement).value).toBe("");
    expect(findByTestId(backdrop, "ai-instructions-counter")!.textContent).toBe(`0 / ${AI_INSTRUCTIONS_MAX_CHARS}자`);
  });

  it("Given 이미 저장된 지침 When 열기 Then 그 값이 실려 온다", () => {
    store.update((draft) => {
      draft.aiInstructions = "4방향 이동만 쓴다.";
    });

    const backdrop = open([]);

    expect((findByTestId(backdrop, "ai-instructions-input") as unknown as HTMLTextAreaElement).value).toBe("4방향 이동만 쓴다.");
  });

  it("Given 지침 입력 When 저장 Then 프로젝트에 남고 onSaved 로 알리고 모달이 닫힌다", () => {
    const saved: string[] = [];
    const backdrop = open(saved);

    typeInto(backdrop, "  타일셋 B 는 쓰지 마라.\r\n ");
    save(backdrop);

    expect(store.getCurrent().aiInstructions).toBe("타일셋 B 는 쓰지 마라.");
    expect(saved).toEqual(["타일셋 B 는 쓰지 마라."]);
    expect(backdrop.parentElement).toBeNull();
  });

  it("Given 지침 편집 When 저장 Then 되돌리기 스냅샷이 남는다(다른 프로젝트 편집과 동일)", () => {
    const before = getMapEditHistoryMarker();
    const backdrop = open([]);

    typeInto(backdrop, "전투는 턴제다.");
    save(backdrop);

    expect(getMapEditHistoryMarker()).toBeGreaterThan(before);
    expect(getMapEditHistoryState().canUndo).toBe(true);
  });

  it("Given 저장된 지침을 비움 When 저장 Then 필드가 제거된다(빈 문자열을 남기지 않는다)", () => {
    store.update((draft) => {
      draft.aiInstructions = "지울 규칙";
    });
    const saved: string[] = [];
    const backdrop = open(saved);

    typeInto(backdrop, "   ");
    save(backdrop);

    expect("aiInstructions" in store.getCurrent()).toBe(false);
    expect(saved).toEqual([""]);
  });

  it("Given 값을 바꾸지 않고 저장 When 클릭 Then 스냅샷도 onSaved 도 없다(빈 편집은 편집이 아니다)", () => {
    const before = getMapEditHistoryMarker();
    const saved: string[] = [];
    const backdrop = open(saved);

    save(backdrop);

    expect(getMapEditHistoryMarker()).toBe(before);
    expect(saved).toEqual([]);
    expect(backdrop.parentElement).toBeNull();
  });

  it("Given 상한 초과 입력 When 저장 Then 상한에서 잘려 저장된다", () => {
    const backdrop = open([]);

    typeInto(backdrop, "가".repeat(AI_INSTRUCTIONS_MAX_CHARS + 200));
    save(backdrop);

    expect(store.getCurrent().aiInstructions).toHaveLength(AI_INSTRUCTIONS_MAX_CHARS);
  });

  it("Given 입력 중 When 글자 수 변화 Then 카운터가 따라온다", () => {
    const backdrop = open([]);

    typeInto(backdrop, "다섯글자");

    expect(findByTestId(backdrop, "ai-instructions-counter")!.textContent).toBe(`4 / ${AI_INSTRUCTIONS_MAX_CHARS}자`);
  });

  it("Given 닫기 버튼 When 클릭 Then 저장 없이 닫힌다", () => {
    const backdrop = open([]);

    typeInto(backdrop, "저장하지 않을 값");
    (findByTestId(backdrop, "ai-instructions-close") as unknown as HTMLElement).click();

    expect(backdrop.parentElement).toBeNull();
    expect(store.getCurrent().aiInstructions).toBeUndefined();
  });
});
