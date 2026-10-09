import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderWorldCanonTab } from "@/editor/panels/databaseWorldCanonView";
import { renderWorldPanel } from "@/editor/panels/worldPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let cleanupDom: (() => void) | undefined;

beforeEach(() => {
  cleanupDom = installFakeDom();
  store.replace(createBlankProject());
});

afterEach(() => cleanupDom?.());

describe("worldview copy IA", () => {
  it("canon body field calls itself the 이 세계 본문, not 설정집", () => {
    const host = document.createElement("div") as unknown as FakeElement;
    renderWorldCanonTab(host as unknown as HTMLElement, () => {});
    const body = findByTestId(host, "db-world-canon-body");
    expect(body?.getAttribute("aria-label")).toBe("이 세계 본문");
  });

  it("codex add-type control offers 카드 종류, not 세계관 타입", () => {
    const panel = renderWorldPanel({ embedded: true }) as unknown as FakeElement;
    const selects = panel.querySelectorAll("select");
    const select = selects.find((node) => node.className.split(/\s+/).includes("world-add-type")) ?? null;
    expect(select?.getAttribute("aria-label")).toBe("추가할 카드 종류");
  });
});
