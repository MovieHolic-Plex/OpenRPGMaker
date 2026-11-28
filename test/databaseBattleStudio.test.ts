import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
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
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    },
  });
  (globalThis as unknown as { Image: new () => object }).Image = class {
    addEventListener(): void {}
    set src(_value: string) {}
  };
  store.replace(createBlankProject());
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
});

function renderHost(render: (host: HTMLElement) => void): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  host.className = "database-modal-body";
  render(host as unknown as HTMLElement);
  return host;
}

function requireTestId(root: FakeElement, testid: string): FakeElement {
  const node = findByTestId(root, testid);
  if (!node) throw new Error(`missing ${testid}`);
  return node;
}

describe("database battle studio", () => {
  it("moves between the four studio surfaces through the existing in-modal tab switch", async () => {
    storage.set(ACTIVE_TAB_KEY, "battleCommands");
    const { getDatabaseActiveTab, renderDatabasePanel } = await import("@/editor/panels/database");
    const panelRoot = renderHost(renderDatabasePanel);

    requireTestId(panelRoot, "db-battle-studio-nav-terrain").dispatchEvent(new Event("click"));

    expect(getDatabaseActiveTab()).toBe("terrain");
    expect(requireTestId(panelRoot, "db-tab-spatial-themes").classList.contains("active")).toBe(true);
    expect(requireTestId(panelRoot, "db-battle-studio-nav-terrain").attrs["aria-current"]).toBe("page");
  }, 60_000);
});
