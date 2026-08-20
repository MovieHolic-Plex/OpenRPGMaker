import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const ACTIVE_TAB_KEY = "rpg-zzu.database.activeTab";

let restoreDom: (() => void) | undefined;
let previousWindow: typeof globalThis.window | undefined;
let storage: Map<string, string>;

beforeEach(() => {
  vi.resetModules();
  restoreDom = installFakeDom();
  previousWindow = globalThis.window;
  storage = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    },
  });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  if (previousWindow === undefined) {
    Reflect.deleteProperty(globalThis, "window");
  } else {
    Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  }
});

function renderPanelHost(render: (host: HTMLElement) => void): FakeElement {
  const panelRoot = document.createElement("div") as unknown as FakeElement;
  panelRoot.className = "database-modal-body";
  render(panelRoot as unknown as HTMLElement);
  return panelRoot;
}

describe("battle commands tab copy and class door", () => {
  it("drops RM2003 path copy, keeps catalog fields, and labels kinds in Korean", async () => {
    const { store } = await import("@/project/store");
    store.replace(createBlankProject());
    storage.set(ACTIVE_TAB_KEY, "battleCommands");

    const { renderDatabasePanel } = await import("@/editor/panels/database");
    const panelRoot = renderPanelHost(renderDatabasePanel);
    const form = findByTestId(panelRoot, "db-detail-form");
    if (!form) throw new Error("missing battle commands form");

    expect(form.textContent).not.toContain("RM2003");
    expect(form.textContent).not.toContain("database.battleCommands");
    expect(findByTestId(form, "db-field-battle-command-name-0")).not.toBeNull();
    expect(findByTestId(form, "db-field-battle-command-skill-0")).not.toBeNull();
    expect(findByTestId(form, "db-picker-battle-command-skill-0")).not.toBeNull();
    expect(findByTestId(form, "db-open-classes-tab")).not.toBeNull();

    const kind = findByTestId(form, "db-field-battle-command-kind-0");
    const labels = kind?.querySelectorAll("option").map((option) => option.textContent) ?? [];
    expect(labels).toContain("공격");
    expect(labels).toContain("특수기능");
    expect(labels).toContain("방어(구형)");
  }, 60_000);

  it("직업으로 점프 uses G006 switchDatabaseActiveTab", async () => {
    const { store } = await import("@/project/store");
    store.replace(createBlankProject());
    storage.set(ACTIVE_TAB_KEY, "battleCommands");

    const { renderDatabasePanel, getDatabaseActiveTab } = await import("@/editor/panels/database");
    const panelRoot = renderPanelHost(renderDatabasePanel);
    findByTestId(panelRoot, "db-open-classes-tab")?.dispatchEvent(new Event("click"));

    expect(getDatabaseActiveTab()).toBe("classes");
    expect(findByTestId(panelRoot, "db-tab-classes")?.classList.contains("active")).toBe(true);
  }, 60_000);
});
