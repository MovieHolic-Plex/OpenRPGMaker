import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderWorldCanonTab } from "@/editor/panels/databaseWorldCanonView";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

function renderTab(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = (): void => {
    host.replaceChildren();
    renderWorldCanonTab(host as unknown as HTMLElement, rerender);
  };
  rerender();
  return host;
}

describe("world lore copy disambiguation", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => cleanupDom?.());

  it("canon body field never calls itself 설정집", () => {
    const host = renderTab();
    const area = findByTestId(host, "db-world-canon-body");
    expect(area?.attrs.placeholder ?? "").not.toContain("설정집");
    expect(area?.attrs["aria-label"] ?? "").not.toContain("설정집");
  });

  it("canon body field names 이 세계 as its home", () => {
    const host = renderTab();
    const area = findByTestId(host, "db-world-canon-body");
    const selfName = `${area?.attrs.placeholder ?? ""} ${area?.attrs["aria-label"] ?? ""}`;
    expect(selfName).toContain("이 세계");
  });

  it("canon hero still routes loose cards to the 설정집 tab", () => {
    const host = renderTab();
    expect(findByTestId(host, "db-world-canon-hero")?.textContent ?? "").toContain("설정집");
  });
});
