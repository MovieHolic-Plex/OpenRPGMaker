import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  refreshDatabasePanel,
  renderDatabasePanel,
  setDatabaseActiveTab,
} from "@/editor/panels/database";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

/**
 * Task65 DOM channel B (save/refresh reentry).
 * Seam: refreshDatabasePanel → renderActiveTab → body.replaceChildren with focused
 * dirty farmSpatial nameInput → sync change → rerender → nested replaceChildren.
 * Native-r3 a6 pageError:
 * "Failed to execute 'replaceChildren' on 'Element': The node to be removed is no longer a child of this node. Perhaps it was moved in a 'blur' event handler?"
 * Pure UI fixture — not remote proof.
 *
 * RED provenance (guard stripped on agent/life-dom-reentry-20260908, 2026-09-08):
 * NotFoundError: Failed to execute 'replaceChildren'... blur event handler
 */

let restoreDom: (() => void) | undefined;
let previousWindow: typeof globalThis.window | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      },
    },
  });
  store.replace(createBlankProject());
  setDatabaseActiveTab("actors");
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
});

function renderPanel(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  host.className = "database-modal-body";
  renderDatabasePanel(host as unknown as HTMLElement);
  return host;
}

function requireTestId(host: FakeElement, testid: string): FakeElement {
  const control = findByTestId(host, testid);
  if (!control) throw new Error(`missing control ${testid}`);
  return control;
}

function click(host: FakeElement, testid: string): void {
  requireTestId(host, testid).click();
}

function openSpatialWithBuilding(host: FakeElement): string {
  click(host, "db-tab-farm-spatial");
  const addEmpty = findByTestId(host, "db-spatial-empty-add-building-type");
  if (addEmpty) addEmpty.click();
  else click(host, "db-spatial-add-building-type");
  const buildingId = store.getCurrent().database.farmBuildingTypes?.[0]?.id;
  if (!buildingId) throw new Error("building type not created");
  return buildingId;
}

/** FakeDom blur skips change; Chrome fires change then clears focus. */
function armChromeBlur(focused: FakeElement): void {
  focused.blur = () => {
    focused.dispatchEvent(new Event("change"));
    const doc = globalThis.document as unknown as { activeElement?: FakeElement | null };
    if (doc.activeElement === focused) doc.activeElement = null;
  };
}

function armNestedReplaceChildrenGuard(body: FakeElement, focused: FakeElement): {
  readonly maxDepth: () => number;
  readonly nestedAttempts: () => number;
} {
  let depth = 0;
  let maxDepth = 0;
  let nestedAttempts = 0;
  const original = body.replaceChildren.bind(body);
  body.replaceChildren = (...children: FakeElement[]) => {
    depth += 1;
    maxDepth = Math.max(maxDepth, depth);
    if (depth > 1) {
      nestedAttempts += 1;
      depth -= 1;
      throw new DOMException(
        "Failed to execute 'replaceChildren' on 'Element': The node to be removed is no longer a child of this node. Perhaps it was moved in a 'blur' event handler?",
        "NotFoundError",
      );
    }
    try {
      const doc = globalThis.document as unknown as { activeElement?: FakeElement | null };
      if (doc.activeElement === focused) focused.dispatchEvent(new Event("change"));
      return original(...children);
    } finally {
      depth -= 1;
    }
  };
  return { maxDepth: () => maxDepth, nestedAttempts: () => nestedAttempts };
}

describe("database tab render reentry (Task65 DOM channel B)", () => {
  it("Given focused dirty farmSpatial name When refreshDatabasePanel Then no nested replaceChildren and model/UI keep the change commit", () => {
    const host = renderPanel();
    const buildingId = openSpatialWithBuilding(host);
    const nameInput = requireTestId(host, `db-spatial-building-name-${buildingId}`);
    nameInput.focus();
    // Change-only commit (nameInput commits on change; no prior input event).
    nameInput.value = "Dirty Coop Name";
    armChromeBlur(nameInput);

    const bodyEl = host.querySelector(".db-body");
    expect(bodyEl).toBeTruthy();
    const probe = armNestedReplaceChildrenGuard(bodyEl!, nameInput);

    expect(() => refreshDatabasePanel(host as unknown as HTMLElement)).not.toThrow();
    expect(probe.nestedAttempts()).toBe(0);
    expect(probe.maxDepth()).toBeGreaterThanOrEqual(1);

    expect(store.getCurrent().database.farmBuildingTypes?.[0]?.name).toBe("Dirty Coop Name");
    expect(findByTestId(host, `db-spatial-building-name-${buildingId}`)?.value).toBe("Dirty Coop Name");
  });

  it("Given a second dirty edit after the first save-refresh Then later mutation is not dropped", () => {
    const host = renderPanel();
    const buildingId = openSpatialWithBuilding(host);

    const editAndRefresh = (label: string): void => {
      const nameInput = requireTestId(host, `db-spatial-building-name-${buildingId}`);
      nameInput.focus();
      nameInput.value = label;
      armChromeBlur(nameInput);
      const bodyEl = host.querySelector(".db-body");
      expect(bodyEl).toBeTruthy();
      const probe = armNestedReplaceChildrenGuard(bodyEl!, nameInput);
      expect(() => refreshDatabasePanel(host as unknown as HTMLElement)).not.toThrow();
      expect(probe.nestedAttempts()).toBe(0);
      expect(store.getCurrent().database.farmBuildingTypes?.[0]?.name).toBe(label);
      expect(findByTestId(host, `db-spatial-building-name-${buildingId}`)?.value).toBe(label);
    };

    editAndRefresh("First Dirty");
    editAndRefresh("Second Dirty");
  });
});
