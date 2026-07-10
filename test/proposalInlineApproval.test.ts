import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildInlineApprovalToolbar,
  getInlineProposalActions,
  setInlineProposalActions,
  subscribeInlineProposalActions,
} from "@/editor/proposalInlineApproval";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

describe("inline proposal actions registry", () => {
  afterEach(() => setInlineProposalActions(null));

  it("set/get/subscribe가 동작한다", () => {
    let notified = 0;
    const unsub = subscribeInlineProposalActions(() => { notified += 1; });
    const actions = { accept: () => {}, reject: () => {}, focusCard: () => {} };
    setInlineProposalActions(actions);
    expect(getInlineProposalActions()).toBe(actions);
    setInlineProposalActions(null);
    expect(getInlineProposalActions()).toBeNull();
    expect(notified).toBe(2);
    unsub();
  });
});

describe("buildInlineApprovalToolbar", () => {
  let restore: () => void;
  beforeEach(() => { restore = installFakeDom(); });
  afterEach(() => { restore(); setInlineProposalActions(null); });

  it("적용/거부/상세 버튼이 핸들러를 호출한다", () => {
    const hits: string[] = [];
    const bar = buildInlineApprovalToolbar({
      accept: () => hits.push("accept"),
      reject: () => hits.push("reject"),
      focusCard: () => hits.push("focus"),
    });
    document.body.append(bar);
    for (const id of ["ghost-inline-accept", "ghost-inline-reject", "ghost-inline-detail"]) {
      (findByTestId(document.body as unknown as FakeElement, id) as unknown as HTMLElement).click();
    }
    expect(hits).toEqual(["accept", "reject", "focus"]);
  });

  it("holdOrigin이 있으면 원본 보기 버튼을 렌더하고 pointerdown/up으로 start/end를 부른다", () => {
    const calls: string[] = [];
    const toolbar = renderWithFakeDom(() =>
      buildInlineApprovalToolbar({
        accept: () => calls.push("accept"),
        reject: () => calls.push("reject"),
        holdOrigin: {
          label: "원본 보기",
          start: () => calls.push("start"),
          end: () => calls.push("end"),
        },
      }),
    );
    const hold = findByTestId(toolbar, "ghost-inline-hold-origin");
    expect(hold).not.toBeNull();
    hold!.dispatchEvent(new Event("pointerdown"));
    hold!.dispatchEvent(new Event("pointerup"));
    expect(calls).toEqual(["start", "end"]);
  });

  it("focusCard가 없으면 상세 버튼을 렌더하지 않는다", () => {
    const toolbar = renderWithFakeDom(() => buildInlineApprovalToolbar({ accept: () => {}, reject: () => {} }));
    expect(findByTestId(toolbar, "ghost-inline-detail")).toBeNull();
  });
});
