import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderWorldCanonTab } from "@/editor/panels/databaseWorldCanonView";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
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

  it("drops worldCanon when the last authored field is cleared", () => {
    const host = renderTab();
    setInput(host, "db-world-canon-name", "안개 해안");
    expect(store.getCurrent().worldCanon?.name).toBe("안개 해안");
    setInput(host, "db-world-canon-name", "   ");
    expect(store.getCurrent().worldCanon).toBeUndefined();
  });
});
