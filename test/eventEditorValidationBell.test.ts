/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import type { EventDraftIssue, EventDraftValidation } from "@/editor/eventDraftValidator";
import {
  refreshEventValidationBell,
  renderEventValidationBell,
} from "@/editor/panels/eventEditor/validationBell";

function validationOf(issues: readonly EventDraftIssue[]): EventDraftValidation {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const infoCount = issues.filter((issue) => issue.severity === "info").length;
  return { issues, errorCount, warningCount, infoCount, canCommit: errorCount === 0 };
}

function issue(overrides: Partial<EventDraftIssue> = {}): EventDraftIssue {
  return {
    severity: "warning",
    code: "shop.items.empty",
    message: "상점에 팔 물건이 없습니다.",
    pageId: "p1",
    ...overrides,
  };
}

describe("event editor validation bell", () => {
  let header: HTMLElement;

  beforeEach(() => {
    document.body.replaceChildren();
    header = document.createElement("header");
    header.className = "event-editor-modal-header";
    header.append(renderEventValidationBell());
    document.body.append(header);
  });

  function bell(): HTMLDetailsElement {
    const node = header.querySelector<HTMLDetailsElement>('[data-testid="event-draft-validation"]');
    if (!node) throw new Error("expected validation bell");
    return node;
  }

  it("stays hidden while the draft has no issues", () => {
    refreshEventValidationBell(header, validationOf([]));

    expect(bell().hidden).toBe(true);
    expect(bell().dataset.count).toBe("0");
    expect(bell().dataset.severity).toBe("none");
    expect(header.querySelector('[data-testid^="event-draft-validation-issue-"]')).toBeNull();
  });

  it("shows the issue count and takes the worst severity", () => {
    refreshEventValidationBell(header, validationOf([
      issue(),
      issue({ severity: "info", code: "page.empty" }),
    ]));

    expect(bell().hidden).toBe(false);
    expect(bell().dataset.severity).toBe("warning");
    expect(bell().dataset.count).toBe("2");
    expect(header.querySelector('[data-testid="event-draft-validation-count"]')?.textContent).toBe("2");
    expect(header.querySelectorAll('[data-testid^="event-draft-validation-issue-"]')).toHaveLength(2);

    refreshEventValidationBell(header, validationOf([
      issue({ severity: "error", code: "event.position.out-of-bounds" }),
      issue(),
    ]));

    expect(bell().dataset.severity).toBe("error");
    expect(header.querySelector('[data-testid="event-draft-validation-tally"]')?.textContent)
      .toBe("오류 1 · 경고 1");
  });

  it("caps the badge at 99+ while keeping the exact count machine-readable", () => {
    refreshEventValidationBell(header, validationOf(
      Array.from({ length: 120 }, (_, index) => issue({ code: `dup.${index}` })),
    ));

    expect(header.querySelector('[data-testid="event-draft-validation-count"]')?.textContent).toBe("99+");
    expect(bell().dataset.count).toBe("120");
  });

  it("navigates to the clicked issue page and closes the popover", () => {
    editorState.set({ selectedEventPageId: "p9" });
    refreshEventValidationBell(header, validationOf([issue({ pageId: "p3" })]));
    bell().open = true;

    header.querySelector<HTMLButtonElement>('[data-testid="event-draft-validation-issue-0"]')?.click();

    expect(editorState.get().selectedEventPageId).toBe("p3");
    expect(bell().open).toBe(false);
  });

  it("closes the popover when the next pointerdown lands outside it", () => {
    refreshEventValidationBell(header, validationOf([issue()]));
    bell().open = true;
    bell().dispatchEvent(new Event("toggle"));

    header.querySelector('[data-testid="event-draft-validation-issue-0"]')
      ?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(bell().open).toBe(true);

    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(bell().open).toBe(false);
  });
});
