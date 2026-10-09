import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderBattleAnimationRecordForm } from "@/editor/panels/databaseAnimationRecordView";
import { renderBattleScreenTab } from "@/editor/panels/databaseBattleScreenTab";
import {
  renderBattleCommandsTab,
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
    // 옛 셀 애니메이션은 도트 연출의 하위 보기라 스튜디오 줄에는 도트 연출이 선다(2026-10-02).
    expect(findByTestId(form, "db-battle-studio-nav-animations")).toBeNull();
    expect(requireTestId(form, "db-battle-studio-nav-retroChoreographies")).not.toBeNull();
    expect(requireTestId(form, "db-animation-studio-stage")).not.toBeNull();
    expect(requireTestId(form, "db-animation-studio-inspector")).not.toBeNull();
    expect(requireTestId(form, "db-animation-studio-timeline")).not.toBeNull();
  });

  it("gives battle screen, commands, and terrain their own visual workspace regions", () => {
    // 전투 화면은 2026-10-02 가짜 무대 미리보기를 지우고 전투 방식·타격감·꾸미기 세 카드가 됐다.
    const screen = renderHost(renderBattleScreenTab);
    expect(requireTestId(screen, "db-battle-method-card")).not.toBeNull();
    expect(requireTestId(screen, "db-battle-hit-feel-card")).not.toBeNull();
    expect(requireTestId(screen, "db-battle-look-card")).not.toBeNull();
    expect(findByTestId(screen, "db-battle-screen-preview-stage")).toBeNull();

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
