import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildInlineApprovalToolbar,
  getInlineProposalActions,
  setInlineProposalActions,
  subscribeInlineProposalActions,
} from "@/editor/proposalInlineApproval";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

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
});
