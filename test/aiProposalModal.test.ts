import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProposalModalElements } from "@/editor/panels/aiProposalModal";
import { installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

describe("createProposalModalElements pin", () => {
  it("제안이 있으면 모달이 열려도 수락/거절 핀을 유지한다", () => {
    const host = document.createElement("div");
    host.append(document.createElement("article"));
    const modal = createProposalModalElements(host);
    const accepted: string[] = [];
    modal.setPinSummary("변경 제안 2건 대기 — 검토");
    modal.bindPinActions({
      accept: () => accepted.push("accept"),
      reject: () => accepted.push("reject"),
    });

    modal.open("modal");

    expect(modal.root.hidden).toBe(false);
    expect(modal.pill.hidden).toBe(false);
    expect(modal.pill.textContent).toContain("변경 제안 2건");
    const pinAccept = modal.pill.querySelector("[data-testid='ai-proposal-pin-accept']");
    expect(pinAccept).toBeTruthy();
    pinAccept?.dispatchEvent(new Event("click"));
    expect(accepted).toEqual(["accept"]);
  });
});
