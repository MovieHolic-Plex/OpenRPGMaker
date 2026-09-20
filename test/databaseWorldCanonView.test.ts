import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderWorldCanonTab } from "@/editor/panels/databaseWorldCanonView";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
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

function setInput(host: FakeElement, testid: string, value: string): void {
  const control = findByTestId(host, testid);
  if (!control) throw new Error(`missing ${testid}`);
  control.value = value;
  control.dispatchEvent(new Event("input"));
}

describe("database world canon view", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    store.replace(createBlankProject());
    resetMapEditHistory();
  });

  afterEach(() => cleanupDom?.());

  it("commits the world name and free-form body onto project.worldCanon", () => {
    const host = renderTab();
    expect(findByTestId(host, "db-world-canon-workspace")).toBeTruthy();

    setInput(host, "db-world-canon-name", "서녘 공화국");
    setInput(host, "db-world-canon-body", "마법은 피의 대가다.");

    expect(store.getCurrent().worldCanon).toEqual({
      name: "서녘 공화국",
      body: "마법은 피의 대가다.",
    });
  });

  it("toggles a tone chip into the stored canon", () => {
    const host = renderTab();
    findByTestId(host, "db-world-canon-tone-grim")?.click();
    expect(store.getCurrent().worldCanon?.tones).toEqual(["grim"]);
  });

  it("adds an absence tag from the add control", () => {
    const host = renderTab();
    setInput(host, "db-world-canon-absence-input", "총");
    findByTestId(host, "db-world-canon-absence-add")?.click();
    expect(store.getCurrent().worldCanon?.absences).toEqual(["총"]);
  });

  it("leaves an undo snapshot for the draft/canon/secret switch", () => {
    store.update((draft) => {
      draft.worldCanon = { name: "안개 해안" };
    });
    resetMapEditHistory();
    const host2 = renderTab();
    // segmentedControl 은 change 이벤트로 동작한다.
    const group = findByTestId(host2, "db-world-canon-status");
    const canonOption = group?.querySelectorAll("[data-testid='db-world-canon-status-option']")
      .find((node) => node.attrs.value === "canon");
    expect(canonOption).toBeTruthy();
    (canonOption as FakeElement & { checked: boolean }).checked = true;
    canonOption?.dispatchEvent(new Event("change"));
    expect(store.getCurrent().worldCanon?.status).toBe("canon");
    expect(getMapEditHistoryState().canUndo).toBe(true);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().worldCanon?.status).toBeUndefined();
  });

  it("renders a markdown preview of the authored body", () => {
    const host = renderTab();
    setInput(host, "db-world-canon-body", "## 역사\n- 왕위는 비어 있다.");
    const toggle = findByTestId(host, "db-world-canon-preview-toggle");
    const area = findByTestId(host, "db-world-canon-body");
    expect(toggle).toBeTruthy();
    toggle?.click();
    const preview = findByTestId(host, "db-world-canon-preview");
    expect(preview).toBeTruthy();
    expect(preview?.textContent).toContain("역사");
    // 미리보기가 열리면 편집기는 가려지고, 닫으면 돌아온다.
    expect(area?.getAttribute("hidden")).toBe("");
    toggle?.click();
    expect(area?.getAttribute("hidden")).toBeNull();
  });

  it("keeps the preview open across a tab rerender", () => {
    const host = renderTab();
    setInput(host, "db-world-canon-body", "## 역사\n- 왕위는 비어 있다.");
    findByTestId(host, "db-world-canon-preview-toggle")?.click();
    const rerendered = renderTab();
    expect(findByTestId(rerendered, "db-world-canon-preview")?.textContent).toContain("역사");
    // 다음 테스트에 열린 미리보기가 새지 않게 닫는다.
    findByTestId(rerendered, "db-world-canon-preview-toggle")?.click();
  });

  it("updates the excerpt counter while typing the body", () => {
    const host = renderTab();
    const hint = findByTestId(host, "db-world-canon-body-card")?.querySelector(".db-ws-card-hint");
    expect(hint?.textContent).toContain("0자를 본다");
    // 상한(20,000) 안쪽은 잘리지 않는다 — 예전엔 600자 상한이라 700자에서 잘렸다.
    setInput(host, "db-world-canon-body", "가".repeat(19_500));
    expect(hint?.textContent).not.toContain("발췌 밖");
    // 상한을 넘기면 몇 자가 남는지 고지한다.
    setInput(host, "db-world-canon-body", "가".repeat(20_700));
    expect(hint?.textContent).toContain("뒤 700자는 발췌 밖");
  });

  it("updates the hero meter and stat with the body without a rerender", () => {
    const host = renderTab();
    setInput(host, "db-world-canon-body", "가".repeat(20_700));
    const meter = findByTestId(host, "db-world-canon-ai-meter");
    expect(meter?.textContent).toContain("뒤 700자는 발췌 밖");
    expect(meter?.getAttribute("role")).toBe("status");
    const stat = findByTestId(host, "db-world-canon-hero-stat-body");
    // 표시가 실제 전달 상한과 같은 상수에서 온다 — 문구가 어긋나면 사용자가 잘못된 길이에 맞춰 쓴다.
    expect(stat?.textContent).toContain("20000 / 20000자");
    expect(stat?.textContent).toContain("뒤 700자 잘림");
    expect(stat?.className).toContain("db-ws-stat-warn");
    expect(findByTestId(host, "db-world-canon-hero-stats")).toBeTruthy();
    expect(findByTestId(host, "db-world-canon-identity")?.textContent).toContain("이름과 한 줄");
  });

  it("rejects an absence past the cap with feedback instead of silently dropping", () => {
    const full = Array.from({ length: 32 }, (_, index) => `금기${index}`);
    store.update((draft) => {
      draft.worldCanon = { name: "꽉 찬 세계", absences: full };
    });
    const host2 = renderTab();
    setInput(host2, "db-world-canon-absence-input", "하나 더");
    findByTestId(host2, "db-world-canon-absence-add")?.click();
    expect(store.getCurrent().worldCanon?.absences).toHaveLength(32);
  });

  it("drops worldCanon when the last authored field is cleared", () => {
    const host = renderTab();
    setInput(host, "db-world-canon-name", "안개 해안");
    expect(store.getCurrent().worldCanon?.name).toBe("안개 해안");
    setInput(host, "db-world-canon-name", "   ");
    expect(store.getCurrent().worldCanon).toBeUndefined();
  });
});
