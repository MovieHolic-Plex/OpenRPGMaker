import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { commandSummaryParts } from "@/editor/panels/eventEditor/commandSummary";
import type { Command } from "@/project/types";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

describe("inn command body", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("shows price presets and a stay/no dialog mock, not just a bare number field", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        {
          path: [],
          actions: {
            addCommand: () => undefined,
            deleteCommand: () => undefined,
            insertCommand: () => undefined,
            moveCommand: () => undefined,
            moveCommandTo: () => undefined,
            replaceCommand: () => undefined,
          },
        },
        { kind: "inn", price: 20 } satisfies Command
      )
    );

    expect(findByTestId(body, "inn-command-body")).not.toBeNull();
    expect(findByTestId(body, "inn-price-input")).not.toBeNull();
    expect(findByTestId(body, "inn-price-presets")).not.toBeNull();
    expect(findByTestId(body, "inn-price-preset-20")).not.toBeNull();
    expect(findByTestId(body, "inn-dialog-mock")).not.toBeNull();
    expect(findByTestId(body, "inn-dialog-question")?.textContent).toContain("20");
    expect(findByTestId(body, "inn-note-input")).not.toBeNull();
    expect(findByTestId(body, "inn-question-input")).not.toBeNull();
    expect(findByTestId(body, "inn-recover-mp")).not.toBeNull();
    expect(findByTestId(body, "inn-advance-morning")).not.toBeNull();
    expect(findByTestId(body, "inn-branch-not-enough")).not.toBeNull();
    expect(body.textContent ?? "").toContain("예");
    expect(body.textContent ?? "").toContain("아니오");
    expect(body.textContent ?? "").toContain("전원 회복");
  });

  it("commits custom note/question, recoverMp, morning, timing, and not-enough branch flag", () => {
    const replaceCommand = vi.fn();
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        {
          path: [0],
          actions: {
            addCommand: () => undefined,
            deleteCommand: () => undefined,
            insertCommand: () => undefined,
            moveCommand: () => undefined,
            moveCommandTo: () => undefined,
            replaceCommand,
          },
        },
        { kind: "inn", price: 20 } satisfies Command
      )
    );

    const note = findByTestId(body, "inn-note-input") as HTMLInputElement;
    note.value = "환영합니다, 여행자여.";
    note.dispatchEvent(new Event("change"));

    const question = findByTestId(body, "inn-question-input") as HTMLInputElement;
    question.value = "오늘 밤 묵으시겠습니까?";
    question.dispatchEvent(new Event("change"));

    const recoverMp = findByTestId(body, "inn-recover-mp") as HTMLInputElement;
    recoverMp.checked = false;
    recoverMp.dispatchEvent(new Event("change"));

    const morning = findByTestId(body, "inn-advance-morning") as HTMLInputElement;
    morning.checked = true;
    morning.dispatchEvent(new Event("change"));

    const rest = findByTestId(body, "inn-rest-duration-input") as HTMLInputElement;
    rest.value = "250";
    rest.dispatchEvent(new Event("change"));

    const branch = findByTestId(body, "inn-branch-not-enough") as HTMLInputElement;
    branch.checked = true;
    branch.dispatchEvent(new Event("change"));

    const last = replaceCommand.mock.calls.at(-1)?.[1] as Extract<Command, { kind: "inn" }>;
    expect(last).toMatchObject({
      kind: "inn",
      price: 20,
      note: "환영합니다, 여행자여.",
      question: "오늘 밤 묵으시겠습니까?",
      recoverMp: false,
      advanceToMorning: true,
      restDurationMs: 250,
      branchOnNotEnoughGold: true,
    });
    expect(findByTestId(body, "inn-not-enough-branch-controls")?.className).not.toContain("is-hidden");
    expect(findByTestId(body, "inn-dialog-note")?.textContent).toContain("환영합니다");
    expect(findByTestId(body, "inn-dialog-question")?.textContent).toContain("오늘 밤");
  });

  it("previews custom copy and flags", () => {
    const preview = renderWithFakeDom(() =>
      renderCommandPreview({
        kind: "inn",
        price: 50,
        note: "편히 쉬세요",
        question: "50G에 묵을까요?",
        recoverMp: false,
        advanceToMorning: true,
        branchOnNotEnoughGold: true,
      })
    );
    expect(findByTestId(preview, "ecp-inn-window")).not.toBeNull();
    expect(preview.textContent ?? "").toContain("편히 쉬세요");
    expect(preview.textContent ?? "").toContain("50G에 묵을까요?");
    expect(preview.textContent ?? "").toContain("HP만 회복");
    expect(preview.textContent ?? "").toContain("아침 이동");
    expect(preview.textContent ?? "").toContain("부족 분기");
  });

  it("summarizes free inns and optional flags", () => {
    const free = commandSummaryParts({ kind: "inn", price: 0 }).map((part) => part.text).join("");
    expect(free).toContain("무료");

    const rich = commandSummaryParts({
      kind: "inn",
      price: 20,
      recoverMp: false,
      advanceToMorning: true,
      branchOnNotEnoughGold: true,
    })
      .map((part) => part.text)
      .join("");
    expect(rich).toContain("HP만");
    expect(rich).toContain("아침");
    expect(rich).toContain("부족분기");
  });
});
