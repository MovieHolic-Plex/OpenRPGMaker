import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderSystemTab, requestSystemSection, resetRequestedSystemSection } from "@/editor/panels/databaseSystemView";
import { getMapEditHistoryEntries, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { resolveTimeSystem } from "@/project/gameTime";
import { listTitleMenuOptions } from "@/player/titleScreen";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let cleanup: (() => void) | undefined;
function render(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  document.body.append(host as unknown as HTMLElement);
  const refresh = (): void => {
    host.replaceChildren();
    renderSystemTab(host as unknown as HTMLElement, refresh);
    // fakeDom does not reflect the type attribute into HTMLInputElement.type.
    for (const input of host.querySelectorAll("input")) input.type = input.getAttribute("type") ?? "text";
  };
  refresh();
  return host;
}
function node(host: FakeElement, id: string): FakeElement {
  const result = findByTestId(host, id);
  if (!result) throw new Error(`Missing ${id}`);
  return result;
}
function change(host: FakeElement, id: string, value: string): void {
  const input = node(host, id); input.value = value; input.dispatchEvent(new Event("change"));
}
function checkbox(host: FakeElement, id: string, checked: boolean): void {
  const input = node(host, id); input.checked = checked; input.dispatchEvent(new Event("change"));
}
beforeEach(() => { cleanup = installFakeDom(); store.replace(createBlankProject()); resetMapEditHistory(); resetRequestedSystemSection(); });
afterEach(() => { vi.unstubAllGlobals(); cleanup?.(); resetRequestedSystemSection(); });

describe("System workspace contracts", () => {
  it("indexes all nine editing destinations and filters without dirtying or replacing search", () => {
    const host = render();
    const studio = node(host, "db-system-studio");
    const targets = new Set(studio.querySelectorAll("button").map((button) => button.dataset.systemTarget).filter(Boolean));
    expect([...targets].sort()).toEqual(["party", "display", "font", "resources", "startup", "optin", "time", "typechart", "title"].sort());
    const before = JSON.stringify(store.getCurrent());
    const search = node(host, "db-system-studio-command-search");
    search.focus(); search.value = "__no_matching_setting__"; search.dispatchEvent(new Event("input"));
    expect(node(host, "db-system-studio-no-results").hidden).toBe(false);
    expect(node(host, "db-system-studio-command-search")).toBe(search);
    node(host, "db-system-studio-search-reset").click();
    expect(search.value).toBe("");
    expect(node(host, "db-system-studio-no-results").hidden).toBe(true);
    expect(JSON.stringify(store.getCurrent())).toBe(before);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });

  it("routes requested focus and preserves all mounted section identities during navigation", () => {
    requestSystemSection("display", "db-field-system-resolution-width");
    const host = render();
    expect(host.dataset.dbSystemSection).toBe("display");
    expect(document.activeElement).toBe(node(host, "db-field-system-resolution-width"));
    const sections = host.querySelectorAll(".db-system-section");
    const nav = node(host, "db-system-section-nav");
    expect(nav.querySelectorAll(".db-system-section-button")).toHaveLength(11);
    expect(nav.querySelectorAll(".db-system-section-nav")).toHaveLength(0);
    node(host, "db-system-nav-party").click();
    expect(host.querySelectorAll(".db-system-section")).toEqual(sections);
    expect(sections.filter((section) => !section.hidden).map((section) => section.dataset.systemSection)).toEqual(["party"]);
  });

  it("keeps focused title typing mounted and updates preview and authored menu labels", () => {
    const host = render();
    node(host, "db-system-nav-title").click();
    const title = node(host, "db-field-title-screen-title");
    title.focus(); title.value = "새 제목 sentinel"; title.dispatchEvent(new Event("input"));
    expect(node(host, "db-field-title-screen-title")).toBe(title);
    expect(document.activeElement).toBe(title);
    expect(node(host, "db-title-workbench-title-text").textContent).toBe(title.value);
    const resume = node(host, "db-field-title-screen-resume");
    resume.focus(); resume.value = "resume-sentinel"; resume.dispatchEvent(new Event("input"));
    expect(node(host, "db-field-title-screen-resume")).toBe(resume);
    const expected = listTitleMenuOptions(store.getCurrent().system.titleScreen!, { autosaveAvailable: true });
    const preview = node(host, "db-title-workbench-menu-preview");
    expect(preview.childNodes.map((entry) => (entry as FakeElement).textContent)).toEqual(expected.map((option) => option.label));
  });

  it("retains disabled calendars through normalization and keeps the runtime clock off", () => {
    store.update((draft) => { draft.system.timeSystem = { enabled: true, daysPerSeason: 31, dayStartHour: 7, dayEndHour: 27, minutesPerRealSecond: 2.5, forceSleep: true }; });
    const host = render();
    checkbox(host, "db-field-system-time-enabled", false);
    const normalized = normalizeSystemRecords(store.getCurrent().system);
    expect(normalized.timeSystem).toMatchObject({ enabled: false, daysPerSeason: 31, dayStartHour: 7, dayEndHour: 27, minutesPerRealSecond: 2.5, forceSleep: true });
    expect(resolveTimeSystem(normalized.timeSystem)).toBeUndefined();
    checkbox(host, "db-field-system-time-enabled", true);
    expect(resolveTimeSystem(store.getCurrent())).toMatchObject({ daysPerSeason: 31, dayStartHour: 7, dayEndHour: 27, minutesPerRealSecond: 2.5 });
  });

  it("directly clears a logo, preserves sibling fields, and supports undo and reopening", () => {
    store.update((draft) => { draft.system.titleScreen!.titleGraphic = { mode: "both", resourceId: "easyrpg-title-title1", x: 32, y: 24 }; });
    resetMapEditHistory();
    const host = render();
    node(host, "db-field-title-screen-logo-clear").click();
    expect(normalizeSystemRecords(store.getCurrent().system).titleScreen?.titleGraphic).toMatchObject({ mode: "both", x: 32, y: 24 });
    expect(store.getCurrent().system.titleScreen?.titleGraphic?.resourceId).toBeUndefined();
    expect(undoMapEdit()).toBe(true);
    expect(node(render(), "db-field-title-screen-logo").value).toBe("easyrpg-title-title1");
  });

  it("preserves authored parallax when editing a title layer and omits default scroll", () => {
    store.update((draft) => { draft.system.titleScreen!.backgroundLayers = [{ resourceId: "easyrpg-title-title1", parallax: 2.5, scrollXPerSec: 7 }]; });
    const host = render();
    change(host, "db-field-title-screen-layer-0-opacity", "65");
    change(host, "db-field-title-screen-layer-0-scroll-x", "0");
    expect(store.getCurrent().system.titleScreen?.backgroundLayers).toEqual([{ resourceId: "easyrpg-title-title1", parallax: 2.5, opacity: .65 }]);
  });

  it("provides direct matrix entry, bounded mutation, diagonal protection and clear cancellation", () => {
    store.update((draft) => { draft.system.typeChart = { types: ["fire", "water"], multipliers: { fire: { water: .5 } } }; });
    const host = render();
    expect(node(host, "db-type-chart-fire-fire").disabled).toBe(true);
    const direct = node(host, "db-type-chart-direct-edit");
    direct.click();
    expect(node(host, "db-type-chart-popover").hidden).toBe(false);
    node(host, "db-type-chart-popover-input").value = "1.25";
    node(host, "db-type-chart-popover-confirm").click();
    expect(store.getCurrent().system.typeChart?.multipliers.fire?.water).toBe(1.25);
    expect(document.activeElement).toBe(direct);
    direct.click(); node(host, "db-type-chart-popover-input").value = "9";
    node(host, "db-type-chart-popover-confirm").click();
    expect(store.getCurrent().system.typeChart?.multipliers.fire?.water).toBe(4);
    const before = structuredClone(store.getCurrent().system.typeChart);
    vi.stubGlobal("confirm", () => false);
    change(host, "db-field-system-type-chart-types", "");
    expect(store.getCurrent().system.typeChart).toEqual(before);
    vi.stubGlobal("confirm", () => true);
    change(host, "db-field-system-type-chart-types", "");
    expect(store.getCurrent().system.typeChart).toBeUndefined();
  });
});
