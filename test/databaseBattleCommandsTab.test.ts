import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

const ACTIVE_TAB_KEY = "oprn:database.activeTab";

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
