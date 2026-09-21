import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderWorldCanonTab } from "@/editor/panels/databaseWorldCanonView";
import { worldCanonPromptSection } from "@/ai/worldCanonContext";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

function renderTab(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  const rerender = (): void => {
    host.textContent = "";
    renderWorldCanonTab(host as unknown as HTMLElement, rerender);
  };
  rerender();
  return host;
}

/** 법윹 카드는 세계 설정 탭 안에 있다 — 테스트에서는 선 열고 조작한다. */
function openSettingsTab(host: FakeElement): void {
  findByTestId(host, "db-ws-section-tab-settings")?.click();
}

describe("world canon spread view", () => {
  let cleanupDom: (() => void) | undefined;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => cleanupDom?.());

  it("renders the document head that mirrors name and premise", () => {
    store.update((draft) => {
      draft.worldCanon = { name: "비늘의 바다", premise: "바다는 잊지 않는다" };
    });
    const host = renderTab();
    const head = findByTestId(host, "db-world-canon-workspace")?.querySelector(".world-canon-spread-head");
    expect(head?.querySelector(".world-canon-head-title")?.textContent).toBe("비늘의 바다");
    // 전제는 에피그래프처럼 따옴표로 감겨 읽힌다.
    expect(head?.querySelector(".world-canon-head-sub")?.textContent).toContain("\"바다는 잊지 않는다\"");
  });

  it("invites authoring instead of form labels when the world is empty", () => {
    const host = renderTab();
    const head = findByTestId(host, "db-world-canon-workspace")?.querySelector(".world-canon-spread-head");
    expect(head?.querySelector(".world-canon-head-title")?.textContent).toContain("세계의 이름");
    expect(head?.querySelector(".world-canon-head-sub")?.textContent).toContain("한 줄 전제");
  });

  it("shows law answers as question cards with conversational state", () => {
    store.update((draft) => {
      draft.worldCanon = { laws: { gods: { present: false }, money: { present: true, note: "이름이 화폐" } } };
    });
    const host = renderTab();
    openSettingsTab(host);
    expect(findByTestId(host, "db-world-canon-law-gods")?.textContent).toContain("없음 — 조수도 없다고 답함");
    expect(findByTestId(host, "db-world-canon-law-money")?.textContent).toContain("있음");
    expect(findByTestId(host, "db-world-canon-law-money")?.textContent).toContain("이름이 화폐");
    // 미정은 데이터 말이 아니라 결과 말로 보인다.
    expect(findByTestId(host, "db-world-canon-law-death")?.textContent).toContain("미정 — 조수가 상상합니다");
    // 구 tri-state 세그먼트는 카드로 대체됐다.
    expect(findByTestId(host, "db-world-canon-law-death-present")).toBeNull();
  });

  it("commits a law through the dialog options and note", () => {
    const host = renderTab();
    openSettingsTab(host);
    findByTestId(host, "db-world-canon-law-death")?.click();
    const dialog = findByTestId(document.body as unknown as FakeElement, "db-world-canon-law-dialog");
    expect(dialog).toBeTruthy();
    const noOption = findByTestId(document.body as unknown as FakeElement, "db-world-canon-law-death-option-no");
    noOption?.click();
    const note = findByTestId(document.body as unknown as FakeElement, "db-world-canon-law-death-note") as unknown as HTMLTextAreaElement;
    note.value = "죽음은 영원한 항해다";
    note.dispatchEvent(new Event("input"));
    findByTestId(document.body as unknown as FakeElement, "db-world-canon-law-death-save")?.click();
    expect(store.getCurrent().worldCanon?.laws?.death).toEqual({ present: false, note: "죽음은 영원한 항해다" });
    // 반영하면 대화상자가 닫히고 카드가 갱신된다.
    expect(findByTestId(document.body as unknown as FakeElement, "db-world-canon-law-dialog")).toBeNull();
    expect(findByTestId(host, "db-world-canon-law-death")?.textContent).toContain("죽음은 영원한 항해다");
  });

  it("opens on the body canvas, not a form", () => {
    const host = renderTab();
    const tabs = findByTestId(host, "db-ws-section-tabs");
    expect(tabs).toBeTruthy();
    const labels = tabs?.textContent ?? "";
    expect(labels).toContain("본문");
    expect(labels).toContain("세계 설정");
    expect(labels).toContain("조수 전달");
    // 초기 탭은 본문이다 — 세계 개요를 클릭하면 도화지가 먼저 보인다.
    const activeTab = tabs?.querySelector("[aria-selected='true']");
    expect(activeTab?.getAttribute("data-testid")).toBe("db-ws-section-tab-body");
    expect(findByTestId(host, "db-world-canon-body")).toBeTruthy();
    expect(findByTestId(host, "world-canon-ai-panel")).toBeNull();
  });

  it("keeps settings fields one tab away, not in the way", () => {
    const host = renderTab();
    expect(findByTestId(host, "db-world-canon-name")).toBeNull();
    expect(findByTestId(host, "db-world-canon-law-gods")).toBeNull();
    findByTestId(host, "db-ws-section-tab-settings")?.click();
    expect(findByTestId(host, "db-world-canon-name")).toBeTruthy();
    expect(findByTestId(host, "db-world-canon-law-gods")).toBeTruthy();
  });

  it("projects the AI delivery block with live status tiles inside its tab", () => {
    store.update((draft) => {
      draft.worldCanon = { name: "비늘의 바다", premise: "바다는 잊지 않는다", tones: ["mythic"], absences: ["총기"], laws: { gods: { present: false } } };
    });
    const host = renderTab();
    findByTestId(host, "db-ws-section-tab-ai")?.click();
    const panel = findByTestId(host, "db-ws-section-panel-ai");
    expect(panel?.querySelector("[data-testid='world-canon-ai-panel-preview']")?.textContent).toContain("## 이 세계(세계관 고정)");
    expect(panel?.querySelector("[data-testid='world-canon-ai-panel-preview']")?.textContent).toContain("신: 없음");
    const items = Array.from(panel?.querySelectorAll(".world-canon-ai-grid-item") ?? []);
    expect(items.length).toBe(5);
    // 문서 탭의 값이 조수 전달 탭에 투영된다.
    expect(panel?.textContent).toContain("비늘의 바다") ;
    expect(panel?.textContent).toContain("미정 3");
  });

  it("keeps unset as undefined when saving without a choice", () => {
    const host = renderTab();
    openSettingsTab(host);
    findByTestId(host, "db-world-canon-law-power")?.click();
    const save = findByTestId(document.body as unknown as FakeElement, "db-world-canon-law-power-save");
    save?.click();
    const laws = store.getCurrent().worldCanon?.laws ?? {};
    expect(laws.power?.present).toBeUndefined();
    expect(laws.power?.note ?? "").toBe("");
  });

  it("keeps the law note inside the project AI projection", () => {
    const host = renderTab();
    openSettingsTab(host);
    findByTestId(host, "db-world-canon-law-money")?.click();
    const yes = findByTestId(document.body as unknown as FakeElement, "db-world-canon-law-money-option-yes");
    yes?.click();
    const note = findByTestId(document.body as unknown as FakeElement, "db-world-canon-law-money-note") as unknown as HTMLTextAreaElement;
    note.value = "진주가 아니라 이름이 화폐다";
    note.dispatchEvent(new Event("input"));
    findByTestId(document.body as unknown as FakeElement, "db-world-canon-law-money-save")?.click();
    expect(worldCanonPromptSection(store.getCurrent().worldCanon)).toContain("이름이 화폐다");
  });
});

