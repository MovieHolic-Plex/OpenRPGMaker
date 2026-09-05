import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderWorldCanonTab } from "@/editor/panels/databaseWorldCanonView";
import { renderWorldCodexTab } from "@/editor/panels/databaseWorldCodexView";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

// 설정집 탭 구조 계약: 탭 본문(.db-body)은 스크롤 경계를 갖는 레이아웃 루트 하나만
// 직접 자식으로 둔다. 안내 문구 + 임베드 패널 두 덩이를 나란히 두면 body 가 늘어난
// 만큼 커져 조상 overflow:hidden 에 잘린다(before 캡처: body scrollH 801 > clientH 777).
describe("world codex tab structure", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => cleanupDom?.());

  function renderCodex(): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    renderWorldCodexTab(host as unknown as HTMLElement);
    return host;
  }

  it("renders a single workspace root so .db-body never grows its own scroll", () => {
    const host = renderCodex();
    expect(host.childNodes).toHaveLength(1);
    const root = host.childNodes[0] as FakeElement;
    expect(root.className).toContain("db-ws-frame");
    expect(findByTestId(host, "db-world-codex-lead")).toBeTruthy();
  });

  it("keeps the canon tab on the same single-root contract", () => {
    const host = document.createElement("div") as unknown as FakeElement;
    renderWorldCanonTab(host as unknown as HTMLElement, () => {});
    expect(host.childNodes).toHaveLength(1);
    expect((host.childNodes[0] as FakeElement).className).toContain("db-ws-frame");
  });
});
