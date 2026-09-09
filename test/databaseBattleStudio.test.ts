import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderBattleAnimationRecordForm } from "@/editor/panels/databaseAnimationRecordView";
import {
  renderBattleCommandsTab,
  renderBattleScreenTab,
  renderTerrainTab,
} from "@/editor/panels/databaseUtilityRecordViews";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { el } from "@/util/dom";
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
  it("renders animation as a stage, inspector, and timeline instead of one legacy form grid", () => {
    const animation = store.getCurrent().database.battleAnimations[0];
    if (!animation) throw new Error("expected default battle animation");
    const form = el("section") as unknown as FakeElement;

    renderBattleAnimationRecordForm(form as unknown as HTMLElement, animation);

    expect(requireTestId(form, "db-battle-studio-nav")).not.toBeNull();
    expect(requireTestId(form, "db-battle-studio-nav-animations").attrs["aria-current"]).toBe("page");
    expect(requireTestId(form, "db-animation-studio-stage")).not.toBeNull();
    expect(requireTestId(form, "db-animation-studio-inspector")).not.toBeNull();
    expect(requireTestId(form, "db-animation-studio-timeline")).not.toBeNull();
  });

  it("gives battle screen, commands, and terrain their own visual workspace regions", () => {
    const screen = renderHost(renderBattleScreenTab);
    expect(requireTestId(screen, "db-battle-screen-preview-stage")).not.toBeNull();
    expect(requireTestId(screen, "db-battle-screen-inspector")).not.toBeNull();
    expect(requireTestId(screen, "db-battle-screen-troop-strip")).not.toBeNull();

    const commands = renderHost(renderBattleCommandsTab);
    expect(requireTestId(commands, "db-battle-command-preview")).not.toBeNull();
    expect(requireTestId(commands, "db-battle-command-palette")).not.toBeNull();
    expect(requireTestId(commands, "db-battle-command-inspector")).not.toBeNull();

    const terrain = renderHost(renderTerrainTab);
    expect(requireTestId(terrain, "db-terrain-preset-gallery")).not.toBeNull();
    expect(requireTestId(terrain, "db-terrain-preview-stage")).not.toBeNull();
    expect(requireTestId(terrain, "db-terrain-inspector")).not.toBeNull();
  });

  it("moves between the four studio surfaces through the existing in-modal tab switch", async () => {
    storage.set(ACTIVE_TAB_KEY, "battleCommands");
    const { getDatabaseActiveTab, renderDatabasePanel } = await import("@/editor/panels/database");
    const panelRoot = renderHost(renderDatabasePanel);

    requireTestId(panelRoot, "db-battle-studio-nav-terrain").dispatchEvent(new Event("click"));

    expect(getDatabaseActiveTab()).toBe("terrain");
    expect(requireTestId(panelRoot, "db-tab-spatial-tiles").classList.contains("active")).toBe(true);
    expect(requireTestId(panelRoot, "db-battle-studio-nav-terrain").attrs["aria-current"]).toBe("page");
  }, 60_000);
});
